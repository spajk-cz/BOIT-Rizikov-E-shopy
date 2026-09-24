/**
 * BOIT Rizikové weby — background service worker
 * Security-hardened, Web Store ready
 */

'use strict';

// ─── Konstanty ──────────────────────────────────────────────────────────
const BOIT_FEED_URL = 'https://spajk-cz.github.io/boit-risk-feed/blacklist.txt';

// Stránka projektu s kontaktem pro nahlášení domény i žádost o vyřazení.
// Otevírá se bez parametrů, aby se kontrolovaná doména nikam neodeslala.
const REPORT_PAGE_URL = 'https://github.com/spajk-cz/BOIT-Rizikov-E-shopy/blob/main/NAHLASENI.md';

const SOURCES = Object.freeze([
  { name: 'COI',  label: 'ČOI',  format: 'html',    url: 'https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/' },
  { name: 'SOI',  label: 'SOI',  format: 'html',    url: 'https://www.soi.sk/informacie-pre-verejnost/internetove-obchody/rizikove-internetove-obchody' },
  { name: 'CTU',  label: 'ČTÚ',  format: 'ctu-csv', url: 'https://ctu.gov.cz/vyhledavaci-databaze/blokovane-weby/csv' },
  { name: 'BOIT', label: 'BOIT', format: 'text',    url: BOIT_FEED_URL }
]);

// Zdroje, které musí být znovu načtené, než zahodíme přechodovou cache ze starší verze.
const LEGACY_SOURCE_NAMES = Object.freeze(['COI', 'SOI']);

const STORAGE_KEYS = Object.freeze({
  DOMAINS:      'boit_rizikove_domains',
  CACHE_TS:     'boit_rizikove_ts',
  SOURCE_CACHE: 'boit_source_cache',
  STATS_BLOCKS: 'boit_stats_blocked',
  STATS_SEEN:   'boit_stats_seen_domains',
  WHITELIST:    'boit_whitelist',
});

const CACHE_TTL = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT = 15000;
const MAX_DOMAIN_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

// Strop na jeden zdroj. ČTÚ seznam je řádově větší než ČOI/SOI a dál roste.
const MAX_DOMAINS = 20000;

// Sjednocení smí být až součet limitů jednotlivých zdrojů. Kdybychom drželi
// limit jednoho zdroje i pro výsledek, mohl by poslední zdroj za hranicí
// tiše vypadnout celý.
const MAX_MERGED_DOMAINS = MAX_DOMAINS * SOURCES.length;

// Datový kontrakt BOIT feedu, viz repozitář boit-risk-feed. Vlastní limit,
// nižší než obecný strop na zdroj, protože ho drží i validátor feedu.
const BOIT_FEED_HEADER = '# BOIT risk feed v1';
const MAX_BOIT_FEED_DOMAINS = 5000;
const MAX_FEED_BYTES = 2 * 1024 * 1024;

// ČTÚ CSV má dnes zhruba 400 kB; strop nechává rezervu, ale odpověď ohraničuje.
const MAX_CSV_BYTES = 8 * 1024 * 1024;

const SAFELIST = Object.freeze(new Set([
  'coi.gov.cz', 'gov.cz', 'soi.sk', 'gov.sk', 'slovensko.sk',
  'seznam.cz', 'eset.com', 'toplist.cz',
  'google.com', 'facebook.com', 'mapy.cz', 'czso.cz'
]));

// ─── Utility ────────────────────────────────────────────────────────────

function isValidHostname(s) {
  if (typeof s !== 'string') return false;
  if (s.length === 0 || s.length > MAX_DOMAIN_LENGTH) return false;
  if (!s.includes('.')) return false;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(s);
}

function normalizeHostname(s) {
  if (typeof s !== 'string') return '';
  return s.trim().toLowerCase().replace(/^www\./, '');
}

function isRiskyMatch(hostname, riskyList) {
  if (!hostname || !riskyList) return false;
  if (SAFELIST.has(hostname)) return false;

  const set = riskyList instanceof Set ? riskyList : new Set(riskyList);
  if (set.size === 0) return false;

  // Projdeme hostname a jeho nadřazené domény — položka platí i pro subdomény.
  // Konstantní počet kroků podle počtu labelů, ne průchod celým seznamem.
  // Poslední label (např. "com") se netestuje, cyklus končí dřív; do seznamu
  // se stejně nedostane, všechny parsery vyžadují nejméně dva labely.
  let candidate = hostname;
  while (candidate.includes('.')) {
    if (set.has(candidate)) return true;
    candidate = candidate.slice(candidate.indexOf('.') + 1);
  }
  return false;
}

// Sloučený seznam je velký, proto si Set držíme mezi voláními a přestavujeme
// ho až po skutečné změně dat.
let matchSetCache = { key: null, set: null };

function riskySet(domains, cacheTs) {
  const key = String(cacheTs) + ':' + domains.length;
  if (matchSetCache.key !== key) matchSetCache = { key, set: new Set(domains) };
  return matchSetCache.set;
}

/** Vrátí zdroje, které danou doménu vedou. Prázdné pole = zdroj neznáme. */
function matchingSources(hostname, cache) {
  const matched = [];
  for (const source of SOURCES) {
    const entry = cache.sources[source.name];
    if (entry && isRiskyMatch(hostname, entry.domains)) {
      matched.push({ name: source.name, label: source.label });
    }
  }
  return matched;
}

async function safeFetch(url, timeoutMs = FETCH_TIMEOUT, maxBytes = 0) {
  if (!/^https:\/\//i.test(url)) throw new Error('pouze HTTPS');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-cache',
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    if (maxBytes > 0) {
      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) {
        throw new Error('odpověď je větší než ' + maxBytes + ' B');
      }
    }

    const text = await res.text();

    if (maxBytes > 0 && new TextEncoder().encode(text).length > maxBytes) {
      throw new Error('odpověď je větší než ' + maxBytes + ' B');
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Parser ─────────────────────────────────────────────────────────────

/**
 * Tries to extract a domain candidate from a single string token.
 * Returns normalized hostname or null.
 */
function extractDomainFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  // Vyhodíme markdown linky [text](url) → vezmeme jen text
  let t = token.replace(/\]\([^)]*\)/g, '').replace(/[\[\]]/g, '');
  // Vyhodíme protokol a path
  t = t.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].split('#')[0];
  // Trim a normalize
  const host = normalizeHostname(t.trim());
  if (!isValidHostname(host)) return null;
  if (SAFELIST.has(host)) return null;
  return host;
}

function parseDomainsFromHtml(html) {
  const domains = new Set();

  // 1) <p> bloky — typicky ČOI struktura
  const blockRegex = /<p[^>]*>\s*(?:https?:\/\/)?([a-z0-9][a-z0-9\-_.]+\.[a-z]{2,}(?:\/[^\s<]{0,80})?)\s*<\/p>/gi;
  let m;
  while ((m = blockRegex.exec(html)) !== null) {
    const host = extractDomainFromToken(m[1]);
    if (host) domains.add(host);
  }

  // 2) <a> linky uvnitř <li> — typicky SOI struktura, kde text odkazu obsahuje doménu/y
  //    Příklad: <a href="...">www.foo.sk, bar.sk [PDF, 198 KB]</a>
  const linkRegex = /<a[^>]*>([^<]+)<\/a>/gi;
  while ((m = linkRegex.exec(html)) !== null) {
    const linkText = m[1];
    // Vystřihneme [PDF...] / [DOCX...] suffix
    const cleanText = linkText.replace(/\[(PDF|DOCX|DOC|XLS|XLSX)[^\]]*\]/gi, '').trim();
    // Multi-domain: split po čárkách / středníkách / mezerách (jen pokud jsou tam tečky)
    const tokens = cleanText.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    for (const tok of tokens) {
      const host = extractDomainFromToken(tok);
      if (host) domains.add(host);
    }
  }

  // 3) Plaintext fallback — strip HTML, jdi po řádcích
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n');

  const lines = stripped.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length > 200) continue;
    // Pokud obsahuje čárky, zkusíme split (multi-domain řádky z SOI)
    const tokens = line.includes(',') ? line.split(',').map(s => s.trim()) : [line];
    for (const tok of tokens) {
      // Ignorujeme příliš dlouhé řádky ale po splitu už by měly být krátké
      if (tok.length > 120) continue;
      const host = extractDomainFromToken(tok);
      if (host) domains.add(host);
    }
  }

  return [...domains].slice(0, MAX_DOMAINS);
}

// ─── BOIT feed ──────────────────────────────────────────────────────────
// Vlastní přísný parser. Tolerantní HTML parser výše umí i TXT, ale zahazuje
// z URL cestu a některé chyby ignoruje. U ručně i strojově spravovaného BOIT
// feedu naopak chceme chybný obsah odmítnout celý.

function isValidBoitFeedDomain(value) {
  if (typeof value !== 'string') return false;
  if (value !== value.trim()) return false;
  if (value.length === 0 || value.length > MAX_DOMAIN_LENGTH) return false;
  if (/[^\x21-\x7e]/.test(value)) return false;           // mimo ASCII, mezera, řídicí znak
  if (/[A-Z]/.test(value)) return false;                  // musí být lowercase
  if (/[#/?&@:*[\]()<>]/.test(value)) return false;       // URL, query, port, e-mail, wildcard, markdown
  if (value.startsWith('www.')) return false;             // publikuje se bez www.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return false; // IP adresa

  const labels = value.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (label.length === 0 || label.length > MAX_LABEL_LENGTH) return false;
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) return false;
  }
  return /^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/.test(labels[labels.length - 1]);
}

/**
 * Rozparsuje BOIT feed. Při jakékoli závadě vyhodí výjimku, aby volající mohl
 * odmítnout celou odpověď a nechat poslední funkční cache.
 * Samotná hlavička bez domén je platná prázdná aktualizace.
 */
function parseDomainsFromBoitFeed(text) {
  if (typeof text !== 'string') throw new Error('feed není text');

  // UTF-8 BOM při čtení zahodíme.
  const body = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const lines = body.split(/\r?\n/);

  if (lines[0] !== BOIT_FEED_HEADER) throw new Error('chybí hlavička feedu');

  const domains = [];
  const seen = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (line.startsWith('#')) continue;

    if (!isValidBoitFeedDomain(line)) {
      throw new Error('neplatný řádek ' + (i + 1));
    }
    // Safelist má přednost před feedem a nelze ho vzdáleně měnit.
    if (SAFELIST.has(line)) continue;
    if (seen.has(line)) continue;

    seen.add(line);
    domains.push(line);
  }

  if (domains.length > MAX_BOIT_FEED_DOMAINS) {
    throw new Error('feed překročil limit ' + MAX_BOIT_FEED_DOMAINS + ' domén');
  }
  return domains;
}

// ─── ČTÚ CSV ────────────────────────────────────────────────────────────
// Seznam blokovaných webů ČTÚ: nepovolené internetové hry, nelegální nabídka
// léčiv a další kategorie. Nejde tedy jen o e-shopy.

/** Minimální CSV parser podle RFC 4180. Zvládne uvozovky, čárky i CRLF. */
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch !== '"') { field += ch; continue; }
      if (text[i + 1] === '"') { field += '"'; i++; continue; }
      inQuotes = false;
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }

  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Bezpečně vytáhne hostname ze záznamu ČTÚ. Vrací null pro vše, co nemá být
 * v seznamu — hlavně pro odkazy na konkrétní stránku, aby jeden blokovaný
 * článek neoznačil celý jinak legitimní web.
 */
function hostnameFromCtuUrl(raw) {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return null;

  // Bez schématu by se URL() pokusil hodnotu vyložit jinak.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : 'https://' + value;

  let url;
  try {
    url = new URL(withScheme);
  } catch (e) {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  // IP adresu do seznamu domén nepouštíme, stejně jako u BOIT feedu.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)) return null;
  // Koncové lomítko je stále jen doména, konkrétní cesta už ne.
  if (url.pathname && url.pathname !== '/') return null;

  const host = normalizeHostname(url.hostname);
  return isValidHostname(host) ? host : null;
}

/**
 * Rozparsuje CSV ČTÚ. Bere jen platné záznamy, tedy s prázdným DATUM_VYMAZU.
 * Vadný jednotlivý řádek přeskočí, ale rozbitou strukturu celého CSV odmítne,
 * aby zůstal poslední funkční seznam.
 */
function parseDomainsFromCtuCsv(text) {
  if (typeof text !== 'string') throw new Error('CSV není text');

  const body = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const rows = parseCsvRows(body);
  if (rows.length === 0) throw new Error('prázdné CSV');

  const header = rows[0].map(h => h.trim().toUpperCase());
  const urlIndex = header.indexOf('URL');
  const removedIndex = header.indexOf('DATUM_VYMAZU');
  if (urlIndex === -1 || removedIndex === -1) {
    throw new Error('CSV nemá očekávané sloupce URL a DATUM_VYMAZU');
  }

  const domains = [];
  const seen = new Set();
  let truncated = false;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= urlIndex) continue;

    // Vyplněné datum výmazu znamená, že záznam už neplatí.
    if (removedIndex < row.length && (row[removedIndex] || '').trim() !== '') continue;

    const host = hostnameFromCtuUrl(row[urlIndex]);
    if (!host) continue;
    if (SAFELIST.has(host)) continue;
    if (seen.has(host)) continue;

    seen.add(host);
    domains.push(host);

    if (domains.length >= MAX_DOMAINS) { truncated = true; break; }
  }

  if (truncated) {
    console.warn('[BOIT] ČTÚ seznam dosáhl stropu ' + MAX_DOMAINS + ' domén a byl oříznut.');
  }
  if (domains.length === 0) throw new Error('CSV neobsahuje žádnou platnou doménu');
  return domains;
}

// ─── Fetch & cache ──────────────────────────────────────────────────────

/**
 * Načte jeden zdroj. Vrací výsledek se stavem, aby volající uměl odlišit
 * úspěch, úspěšný prázdný BOIT seznam a chybu.
 */
const MAX_BYTES_BY_FORMAT = Object.freeze({ text: MAX_FEED_BYTES, 'ctu-csv': MAX_CSV_BYTES });

async function fetchOneSource(source) {
  try {
    const body = await safeFetch(source.url, FETCH_TIMEOUT, MAX_BYTES_BY_FORMAT[source.format] || 0);

    let domains;
    if (source.format === 'text') {
      domains = parseDomainsFromBoitFeed(body);
    } else if (source.format === 'ctu-csv') {
      domains = parseDomainsFromCtuCsv(body);
    } else {
      domains = parseDomainsFromHtml(body);
      // Prázdný výsledek HTML parseru bereme konzervativně jako chybu — spíš se
      // změnila struktura stránky, než že by úřad zrušil celý seznam.
      if (domains.length === 0) throw new Error('parser nenašel žádnou doménu');
    }

    console.log('[BOIT] ' + source.name + ': ' + domains.length + ' domén');
    return { name: source.name, ok: true, domains };
  } catch (e) {
    console.error('[BOIT] ' + source.name + ' fetch chyba:', e.message || e);
    return { name: source.name, ok: false, domains: [] };
  }
}

/** Uvede uloženou per-source cache do známého tvaru; cizí data ignoruje. */
function normalizeSourceCache(raw) {
  const cache = { version: 1, sources: {}, legacy: null };
  if (!raw || typeof raw !== 'object') return cache;

  const sources = raw.sources && typeof raw.sources === 'object' ? raw.sources : {};
  for (const source of SOURCES) {
    const entry = sources[source.name];
    if (entry && Array.isArray(entry.domains) && typeof entry.ts === 'number') {
      cache.sources[source.name] = { domains: entry.domains.filter(isValidHostname), ts: entry.ts };
    }
  }

  if (raw.legacy && Array.isArray(raw.legacy.domains) && raw.legacy.domains.length > 0) {
    cache.legacy = {
      domains: raw.legacy.domains.filter(isValidHostname),
      ts: typeof raw.legacy.ts === 'number' ? raw.legacy.ts : 0
    };
  }
  return cache;
}

/**
 * Načte per-source cache. Při aktualizaci ze starší verze převezme původní
 * sloučený seznam jako `legacy` — neznámá stará data nelze poctivě přiřadit
 * konkrétnímu zdroji, ale ani je nechceme uživateli zahodit.
 */
async function loadSourceCache() {
  const r = await chrome.storage.local.get([
    STORAGE_KEYS.SOURCE_CACHE, STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS
  ]);
  const cache = normalizeSourceCache(r[STORAGE_KEYS.SOURCE_CACHE]);

  const hasPerSource = Object.keys(cache.sources).length > 0;
  const oldDomains = Array.isArray(r[STORAGE_KEYS.DOMAINS])
    ? r[STORAGE_KEYS.DOMAINS].filter(isValidHostname)
    : [];

  if (!hasPerSource && !cache.legacy && oldDomains.length > 0) {
    cache.legacy = {
      domains: oldDomains,
      ts: typeof r[STORAGE_KEYS.CACHE_TS] === 'number' ? r[STORAGE_KEYS.CACHE_TS] : 0
    };
  }
  return cache;
}

/** Konzervativní stáří celého seznamu — nejstarší úspěch, který v něm je. */
function computeCacheTs(cache) {
  const stamps = SOURCES
    .map(source => cache.sources[source.name])
    .filter(Boolean)
    .map(entry => entry.ts);
  if (cache.legacy) stamps.push(cache.legacy.ts);
  return stamps.length > 0 ? Math.min(...stamps) : null;
}

/** Poskládá sloučený seznam z platných per-source cache. */
function mergeSourceCache(cache) {
  const merged = [];
  const seen = new Set();

  const addAll = (list) => {
    for (const domain of list) {
      if (merged.length >= MAX_MERGED_DOMAINS) return;
      if (seen.has(domain)) continue;
      seen.add(domain);
      merged.push(domain);
    }
  };

  for (const source of SOURCES) {
    const entry = cache.sources[source.name];
    if (entry) addAll(entry.domains);
  }
  if (cache.legacy) addAll(cache.legacy.domains);

  return merged;
}

// Jedna sdílená promise pro probíhající refresh, aby pomalejší starší
// požadavek nepřepsal novější výsledek.
let refreshInFlight = null;

function fetchAndCacheDomains() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doFetchAndCache().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function doFetchAndCache() {
  const cache = await loadSourceCache();
  const results = await Promise.all(SOURCES.map(fetchOneSource));
  const now = Date.now();

  const refreshed = [];
  const failed = [];

  for (const result of results) {
    if (result.ok) {
      // Úspěch přepíše cache jen svého zdroje.
      cache.sources[result.name] = { domains: result.domains, ts: now };
      refreshed.push(result.name);
    } else {
      // Při chybě zůstává dosavadní seznam i datum posledního úspěchu.
      failed.push(result.name);
    }
  }

  // Přechodový fallback vyřadíme, jakmile máme čerstvá data z obou původních zdrojů.
  if (cache.legacy && LEGACY_SOURCE_NAMES.every(name => cache.sources[name])) {
    cache.legacy = null;
  }

  const merged = mergeSourceCache(cache);
  const cacheTs = computeCacheTs(cache);

  const write = { [STORAGE_KEYS.SOURCE_CACHE]: cache };
  if (merged.length > 0 || refreshed.length > 0) {
    write[STORAGE_KEYS.DOMAINS] = merged;
    write[STORAGE_KEYS.CACHE_TS] = cacheTs;
  }
  await chrome.storage.local.set(write);

  const status = {
    refreshed,
    failed,
    partial: failed.length > 0,
    complete: failed.length === 0,
    domainCount: merged.length,
    migrating: Boolean(cache.legacy)
  };

  if (status.complete) {
    console.log('[BOIT] Uloženo ' + merged.length + ' unikátních domén (' + refreshed.join(' + ') + ').');
  } else {
    console.warn('[BOIT] Částečná obnova. Načteno: ' + (refreshed.join(', ') || 'nic') +
      '; selhalo: ' + failed.join(', ') + '. Poslední funkční data zůstávají.');
  }
  return status;
}

async function refreshIfNeeded() {
  const r = await chrome.storage.local.get([
    STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS, STORAGE_KEYS.SOURCE_CACHE
  ]);
  const cache = normalizeSourceCache(r[STORAGE_KEYS.SOURCE_CACHE]);

  // Po aktualizaci doplňku chybí cache nového zdroje i při čerstvém seznamu.
  const missingSource = SOURCES.some(source => !cache.sources[source.name]);
  const age = typeof r[STORAGE_KEYS.CACHE_TS] === 'number'
    ? Date.now() - r[STORAGE_KEYS.CACHE_TS]
    : Infinity;
  const hasData = Array.isArray(r[STORAGE_KEYS.DOMAINS]) && r[STORAGE_KEYS.DOMAINS].length > 0;

  // Hraniční stáří přesně TTL je už splatné.
  if (!hasData || missingSource || age >= CACHE_TTL) await fetchAndCacheDomains();
}

// ─── Statistiky ─────────────────────────────────────────────────────────

async function recordBlock(hostname) {
  const r = await chrome.storage.local.get([STORAGE_KEYS.STATS_BLOCKS, STORAGE_KEYS.STATS_SEEN]);
  const total = (r[STORAGE_KEYS.STATS_BLOCKS] || 0) + 1;
  const seen = new Set(r[STORAGE_KEYS.STATS_SEEN] || []);
  seen.add(hostname);
  await chrome.storage.local.set({
    [STORAGE_KEYS.STATS_BLOCKS]: total,
    [STORAGE_KEYS.STATS_SEEN]: [...seen].slice(-500)
  });
}

async function getStats() {
  const r = await chrome.storage.local.get([STORAGE_KEYS.STATS_BLOCKS, STORAGE_KEYS.STATS_SEEN]);
  return {
    totalBlocks:   r[STORAGE_KEYS.STATS_BLOCKS] || 0,
    uniqueDomains: (r[STORAGE_KEYS.STATS_SEEN] || []).length
  };
}

// ─── Whitelist ──────────────────────────────────────────────────────────

async function isWhitelisted(hostname) {
  const r = await chrome.storage.local.get([STORAGE_KEYS.WHITELIST]);
  const list = r[STORAGE_KEYS.WHITELIST] || {};
  const entry = list[hostname];
  if (!entry) return false;
  if (entry.until && entry.until < Date.now()) {
    delete list[hostname];
    await chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });
    return false;
  }
  return true;
}

async function addWhitelist(hostname, ttlMs) {
  const host = normalizeHostname(hostname);
  if (!isValidHostname(host)) return false;
  const r = await chrome.storage.local.get([STORAGE_KEYS.WHITELIST]);
  const list = r[STORAGE_KEYS.WHITELIST] || {};
  list[host] = { until: ttlMs ? Date.now() + ttlMs : null };
  await chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });
  return true;
}

async function getWhitelist() {
  const r = await chrome.storage.local.get([STORAGE_KEYS.WHITELIST]);
  const list = r[STORAGE_KEYS.WHITELIST] || {};
  const now = Date.now();
  let changed = false;

  for (const [host, entry] of Object.entries(list)) {
    if (!isValidHostname(host) || (entry && entry.until && entry.until < now)) {
      delete list[host];
      changed = true;
    }
  }

  if (changed) await chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });

  return Object.entries(list)
    .map(([hostname, entry]) => ({ hostname, until: entry?.until || null }))
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
}

async function removeWhitelist(hostname) {
  const host = normalizeHostname(hostname);
  if (!isValidHostname(host)) return false;
  const r = await chrome.storage.local.get([STORAGE_KEYS.WHITELIST]);
  const list = r[STORAGE_KEYS.WHITELIST] || {};
  const existed = Object.prototype.hasOwnProperty.call(list, host);
  delete list[host];
  await chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });
  return existed;
}

// ─── Ikonka ─────────────────────────────────────────────────────────────

function consumeLastError() {
  if (chrome.runtime.lastError) {
    void chrome.runtime.lastError.message;
    return true;
  }
  return false;
}

function setIconForTab(tabId, isRisky) {
  if (typeof tabId !== "number") return;

  chrome.tabs.get(tabId, (tab) => {
    if (consumeLastError() || !tab) return;

    const base = isRisky ? "icon-risky" : "icon-safe";
    const path = {
      16:  "icons/" + base + "-16.png",
      32:  "icons/" + base + "-32.png",
      48:  "icons/" + base + "-48.png",
      128: "icons/" + base + "-128.png"
    };

    chrome.action.setIcon({ tabId, path }, consumeLastError);
    chrome.action.setBadgeText({ tabId, text: isRisky ? "!" : "" }, consumeLastError);
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#FF2D78" }, consumeLastError);
    chrome.action.setTitle({
      tabId,
      title: isRisky ? "BOIT: Web na seznamu rizikových webů" : "BOIT Rizikové weby — ochrana aktivní"
    }, consumeLastError);
  });
}

function checkTabAndUpdateIcon(tabId) {
  if (typeof tabId !== "number") return;

  chrome.tabs.get(tabId, (tab) => {
    if (consumeLastError() || !tab) return;

    (async () => {
      if (!tab.url || !tab.url.startsWith("http")) {
        setIconForTab(tabId, false);
        return;
      }
      const hostname = normalizeHostname(new URL(tab.url).hostname);
      const r = await chrome.storage.local.get([STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS]);
      const risky = isRiskyMatch(hostname, riskySet(r[STORAGE_KEYS.DOMAINS] || [], r[STORAGE_KEYS.CACHE_TS]));
      const whitelisted = await isWhitelisted(hostname);
      setIconForTab(tabId, risky && !whitelisted);
    })().catch(() => {});
  });
}

// ─── Events ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  refreshIfNeeded();
  chrome.alarms.create('boit_refresh', { periodInMinutes: 360 });
});

chrome.runtime.onStartup.addListener(refreshIfNeeded);

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'boit_refresh') refreshIfNeeded();
});

chrome.tabs.onActivated.addListener(({ tabId }) => checkTabAndUpdateIcon(tabId));
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete' || info.url) checkTabAndUpdateIcon(tabId);
});

// ─── Message handler ────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ error: 'unauthorized' });
    return false;
  }
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
    sendResponse({ error: 'invalid' });
    return false;
  }

  switch (msg.type) {
    case 'CHECK_DOMAIN': {
      const hostname = normalizeHostname(msg.hostname);
      if (!isValidHostname(hostname)) {
        sendResponse({ isRisky: false, invalid: true });
        return false;
      }
      (async () => {
        const r = await chrome.storage.local.get([
          STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS, STORAGE_KEYS.SOURCE_CACHE
        ]);
        const domains = r[STORAGE_KEYS.DOMAINS] || [];
        const risky = isRiskyMatch(hostname, riskySet(domains, r[STORAGE_KEYS.CACHE_TS]));
        const whitelisted = await isWhitelisted(hostname);
        const effective = risky && !whitelisted;
        if (sender.tab?.id) setIconForTab(sender.tab.id, effective);
        sendResponse({
          isRisky: risky,
          whitelisted,
          // Zdroj shody dohledáváme jen při skutečné shodě, ať nemusíme na každé
          // navštívené stránce procházet všechny per-source seznamy.
          matchedSources: risky
            ? matchingSources(hostname, normalizeSourceCache(r[STORAGE_KEYS.SOURCE_CACHE]))
            : [],
          domainCount: domains.length,
          cacheAge: r[STORAGE_KEYS.CACHE_TS] ? Date.now() - r[STORAGE_KEYS.CACHE_TS] : null
        });
      })();
      return true;
    }

    case 'RECORD_BLOCK': {
      const hostname = normalizeHostname(msg.hostname);
      if (isValidHostname(hostname)) recordBlock(hostname);
      sendResponse({ ok: true });
      return false;
    }

    case 'GET_STATS': {
      getStats().then(sendResponse);
      return true;
    }

    case 'WHITELIST_ADD': {
      const ttl = typeof msg.hours === 'number' && msg.hours > 0 && msg.hours <= 24 * 365
        ? msg.hours * 3600 * 1000 : null;
      addWhitelist(msg.hostname, ttl).then(ok => {
        if (sender.tab?.id) checkTabAndUpdateIcon(sender.tab.id);
        sendResponse({ ok });
      });
      return true;
    }

    case 'WHITELIST_REMOVE': {
      removeWhitelist(msg.hostname).then(ok => {
        if (sender.tab?.id) checkTabAndUpdateIcon(sender.tab.id);
        sendResponse({ ok });
      });
      return true;
    }

    case 'WHITELIST_GET': {
      getWhitelist().then(items => sendResponse({ items }));
      return true;
    }

    case 'OPEN_REPORT_PAGE': {
      // Otevře pouze pevnou stránku projektu. Žádný parametr, žádná doména,
      // žádné signály — o kontrolovaném webu se ven nedostane nic.
      chrome.tabs.create({ url: REPORT_PAGE_URL }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true });
        }
      });
      return true;
    }

    case 'FORCE_REFRESH': {
      // Cache se předem NEMAŽE. Když všechny zdroje selžou, data zůstanou
      // a odpověď to přizná místo hlášení úspěchu.
      fetchAndCacheDomains()
        .then(status => sendResponse({ ok: status.refreshed.length > 0, ...status }))
        .catch(err => sendResponse({ ok: false, error: err?.message || 'refresh_failed' }));
      return true;
    }

    case 'GET_STATUS': {
      chrome.storage.local.get([
        STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS, STORAGE_KEYS.SOURCE_CACHE
      ]).then(r => {
        const cache = normalizeSourceCache(r[STORAGE_KEYS.SOURCE_CACHE]);
        sendResponse({
          domainCount: (r[STORAGE_KEYS.DOMAINS] || []).length,
          cacheAge: r[STORAGE_KEYS.CACHE_TS] ? Date.now() - r[STORAGE_KEYS.CACHE_TS] : null,
          migrating: Boolean(cache.legacy),
          sources: SOURCES.map(source => {
            const entry = cache.sources[source.name];
            return {
              name: source.name,
              label: source.label,
              loaded: Boolean(entry),
              count: entry ? entry.domains.length : 0,
              ts: entry ? entry.ts : null
            };
          })
        });
      });
      return true;
    }

    default:
      sendResponse({ error: 'unknown_type' });
      return false;
  }
});
