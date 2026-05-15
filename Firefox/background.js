/**
 * BOIT Rizikové E-shopy — background event page (Firefox MV3)
 * Security-hardened, AMO ready
 *
 * Pozn. k Firefox MV3:
 *   • Background běží jako EVENT PAGE (non-persistent), ne service worker.
 *   • Top-level listenery musí být registrované synchronně (jsou).
 *   • Používáme `browser.*` (Promise-based API); `chrome.*` ve FF je callback-only,
 *     takže by `await chrome.storage.local.get(...)` selhal.
 */

'use strict';

// ─── Konstanty ──────────────────────────────────────────────────────────
const SOURCES = Object.freeze([
  { name: 'COI', url: 'https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/' },
  { name: 'SOI', url: 'https://www.soi.sk/informacie-pre-verejnost/internetove-obchody/rizikove-internetove-obchody' }
]);

const STORAGE_KEYS = Object.freeze({
  DOMAINS:      'boit_rizikove_domains',
  CACHE_TS:     'boit_rizikove_ts',
  STATS_BLOCKS: 'boit_stats_blocked',
  STATS_SEEN:   'boit_stats_seen_domains',
  WHITELIST:    'boit_whitelist',
});

const CACHE_TTL = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT = 15000;
const MAX_DOMAIN_LENGTH = 253;
const MAX_DOMAINS = 5000;

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
  if (!hostname || !riskyList || riskyList.length === 0) return false;
  if (SAFELIST.has(hostname)) return false;
  for (const d of riskyList) {
    if (hostname === d) return true;
    if (hostname.endsWith('.' + d)) return true;
  }
  return false;
}

async function safeFetch(url, timeoutMs = FETCH_TIMEOUT) {
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
    return await res.text();
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

// ─── Fetch & cache ──────────────────────────────────────────────────────

async function fetchOneSource(source) {
  try {
    const html = await safeFetch(source.url);
    const domains = parseDomainsFromHtml(html);
    console.log('[BOIT] ' + source.name + ': ' + domains.length + ' domén');
    return domains;
  } catch (e) {
    console.error('[BOIT] ' + source.name + ' fetch chyba:', e.message || e);
    return [];
  }
}

async function fetchAndCacheDomains() {
  // Paralelně všechny zdroje
  const results = await Promise.all(SOURCES.map(fetchOneSource));

  // Merge do unique setu
  const merged = new Set();
  for (const arr of results) {
    for (const d of arr) merged.add(d);
  }

  if (merged.size === 0) {
    console.warn('[BOIT] Žádný zdroj nevrátil domény — cache nepřepisuji.');
    return;
  }

  const domains = [...merged].slice(0, MAX_DOMAINS);
  await browser.storage.local.set({
    [STORAGE_KEYS.DOMAINS]: domains,
    [STORAGE_KEYS.CACHE_TS]: Date.now()
  });
  console.log('[BOIT] Celkem uloženo ' + domains.length + ' unikátních domén (ČOI + SOI).');
}

async function refreshIfNeeded() {
  const r = await browser.storage.local.get([STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS]);
  const age = r[STORAGE_KEYS.CACHE_TS] ? Date.now() - r[STORAGE_KEYS.CACHE_TS] : Infinity;
  const hasData = Array.isArray(r[STORAGE_KEYS.DOMAINS]) && r[STORAGE_KEYS.DOMAINS].length > 0;
  if (!hasData || age > CACHE_TTL) await fetchAndCacheDomains();
}

// ─── Statistiky ─────────────────────────────────────────────────────────

async function recordBlock(hostname) {
  const r = await browser.storage.local.get([STORAGE_KEYS.STATS_BLOCKS, STORAGE_KEYS.STATS_SEEN]);
  const total = (r[STORAGE_KEYS.STATS_BLOCKS] || 0) + 1;
  const seen = new Set(r[STORAGE_KEYS.STATS_SEEN] || []);
  seen.add(hostname);
  await browser.storage.local.set({
    [STORAGE_KEYS.STATS_BLOCKS]: total,
    [STORAGE_KEYS.STATS_SEEN]: [...seen].slice(-500)
  });
}

async function getStats() {
  const r = await browser.storage.local.get([STORAGE_KEYS.STATS_BLOCKS, STORAGE_KEYS.STATS_SEEN]);
  return {
    totalBlocks:   r[STORAGE_KEYS.STATS_BLOCKS] || 0,
    uniqueDomains: (r[STORAGE_KEYS.STATS_SEEN] || []).length
  };
}

// ─── Whitelist ──────────────────────────────────────────────────────────

async function isWhitelisted(hostname) {
  const r = await browser.storage.local.get([STORAGE_KEYS.WHITELIST]);
  const list = r[STORAGE_KEYS.WHITELIST] || {};
  const entry = list[hostname];
  if (!entry) return false;
  if (entry.until && entry.until < Date.now()) {
    delete list[hostname];
    await browser.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });
    return false;
  }
  return true;
}

async function addWhitelist(hostname, ttlMs) {
  const host = normalizeHostname(hostname);
  if (!isValidHostname(host)) return false;
  const r = await browser.storage.local.get([STORAGE_KEYS.WHITELIST]);
  const list = r[STORAGE_KEYS.WHITELIST] || {};
  list[host] = { until: ttlMs ? Date.now() + ttlMs : null };
  await browser.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });
  return true;
}

async function getWhitelist() {
  const r = await browser.storage.local.get([STORAGE_KEYS.WHITELIST]);
  const list = r[STORAGE_KEYS.WHITELIST] || {};
  const now = Date.now();
  let changed = false;

  for (const [host, entry] of Object.entries(list)) {
    if (!isValidHostname(host) || (entry && entry.until && entry.until < now)) {
      delete list[host];
      changed = true;
    }
  }

  if (changed) await browser.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });

  return Object.entries(list)
    .map(([hostname, entry]) => ({ hostname, until: entry?.until || null }))
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
}

async function removeWhitelist(hostname) {
  const host = normalizeHostname(hostname);
  if (!isValidHostname(host)) return false;
  const r = await browser.storage.local.get([STORAGE_KEYS.WHITELIST]);
  const list = r[STORAGE_KEYS.WHITELIST] || {};
  const existed = Object.prototype.hasOwnProperty.call(list, host);
  delete list[host];
  await browser.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list });
  return existed;
}

function buildReportMailto(hostname, signals, email) {
  const host = normalizeHostname(hostname);
  if (!isValidHostname(host)) return null;

  // Default email pokud nebyl předán nebo je neplatný
  const ALLOWED_EMAILS = new Set(['podatelna@coi.gov.cz', 'info@soi.sk']);
  const reportEmail = ALLOWED_EMAILS.has(email) ? email : 'podatelna@coi.gov.cz';

  const safeSignals = Array.isArray(signals)
    ? signals
        .map(s => typeof s?.title === 'string' ? s.title.trim() : '')
        .filter(Boolean)
        .slice(0, 10)
    : [];

  const subject = encodeURIComponent('Podezřelý e-shop: ' + host);
  const body = encodeURIComponent(
    'Dobrý den,\n\n' +
    'rád bych upozornil na podezřelý e-shop: https://' + host + '\n\n' +
    'Zjištěná rizika:\n' +
    (safeSignals.length ? safeSignals.map(s => '- ' + s).join('\n') : '(žádná automatická detekce)') +
    '\n\nDěkuji.'
  );

  return 'mailto:' + reportEmail + '?subject=' + subject + '&body=' + body;
}

// ─── Ikonka ─────────────────────────────────────────────────────────────

/**
 * Nastaví ikonku/badge/title pro daný tab. Volá se fire-and-forget,
 * vnitřní chyby (zavřený tab, no permission) jsou tiše ignorovány —
 * to není stav, který by uživatel měl řešit.
 */
async function setIconForTab(tabId, isRisky) {
  if (typeof tabId !== 'number') return;

  let tab;
  try {
    tab = await browser.tabs.get(tabId);
  } catch (e) {
    return; // tab zmizel mezi onActivated a get
  }
  if (!tab) return;

  const base = isRisky ? 'icon-risky' : 'icon-safe';
  const path = {
    16:  'icons/' + base + '-16.png',
    32:  'icons/' + base + '-32.png',
    48:  'icons/' + base + '-48.png',
    128: 'icons/' + base + '-128.png'
  };

  // Každý browser.action.* může selhat, pokud se tab mezitím zavřel —
  // chyby jen spolkneme, jinak by byl ve Firefoxu unhandled promise rejection.
  const swallow = () => {};
  browser.action.setIcon({ tabId, path }).catch(swallow);
  browser.action.setBadgeText({ tabId, text: isRisky ? '!' : '' }).catch(swallow);
  browser.action.setBadgeBackgroundColor({ tabId, color: '#FF2D78' }).catch(swallow);
  browser.action.setTitle({
    tabId,
    title: isRisky ? 'BOIT: Rizikový e-shop (dle ČOI/SOI)' : 'BOIT Rizikové E-shopy — ochrana aktivní'
  }).catch(swallow);
}

async function checkTabAndUpdateIcon(tabId) {
  if (typeof tabId !== 'number') return;

  let tab;
  try {
    tab = await browser.tabs.get(tabId);
  } catch (e) {
    return;
  }
  if (!tab) return;

  if (!tab.url || !tab.url.startsWith('http')) {
    await setIconForTab(tabId, false);
    return;
  }

  try {
    const hostname = normalizeHostname(new URL(tab.url).hostname);
    const r = await browser.storage.local.get([STORAGE_KEYS.DOMAINS]);
    const risky = isRiskyMatch(hostname, r[STORAGE_KEYS.DOMAINS] || []);
    const whitelisted = await isWhitelisted(hostname);
    await setIconForTab(tabId, risky && !whitelisted);
  } catch (e) {
    // špatná URL nebo storage error — ignorujeme, ikonka prostě zůstane výchozí
  }
}

// ─── Events ─────────────────────────────────────────────────────────────
// Listenery REGISTROVÁNY SYNCHRONNĚ na top-levelu — důležité pro event page
// ve Firefoxu, aby věděl, jaké eventy mají background probouzet.

browser.runtime.onInstalled.addListener(() => {
  refreshIfNeeded();
  browser.alarms.create('boit_refresh', { periodInMinutes: 360 });
});

browser.runtime.onStartup.addListener(() => {
  refreshIfNeeded();
});

browser.alarms.onAlarm.addListener((a) => {
  if (a.name === 'boit_refresh') refreshIfNeeded();
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  checkTabAndUpdateIcon(tabId);
});

browser.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete' || info.url) checkTabAndUpdateIcon(tabId);
});

// ─── Message handler ────────────────────────────────────────────────────
// Vrací `true` pro asynchronní `sendResponse` (kompatibilní vzor pro FF i Chrome).

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== browser.runtime.id) {
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
        const r = await browser.storage.local.get([STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS]);
        const risky = isRiskyMatch(hostname, r[STORAGE_KEYS.DOMAINS] || []);
        const whitelisted = await isWhitelisted(hostname);
        const effective = risky && !whitelisted;
        if (sender.tab?.id) await setIconForTab(sender.tab.id, effective);
        sendResponse({
          isRisky: risky,
          whitelisted,
          domainCount: (r[STORAGE_KEYS.DOMAINS] || []).length,
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
      (async () => {
        const ok = await addWhitelist(msg.hostname, ttl);
        if (sender.tab?.id) await checkTabAndUpdateIcon(sender.tab.id);
        sendResponse({ ok });
      })();
      return true;
    }

    case 'WHITELIST_REMOVE': {
      (async () => {
        const ok = await removeWhitelist(msg.hostname);
        if (sender.tab?.id) await checkTabAndUpdateIcon(sender.tab.id);
        sendResponse({ ok });
      })();
      return true;
    }

    case 'WHITELIST_GET': {
      getWhitelist().then(items => sendResponse({ items }));
      return true;
    }

    case 'REPORT_COI': {
      const mailtoUrl = buildReportMailto(msg.hostname, msg.signals, msg.email);
      if (!mailtoUrl) {
        sendResponse({ ok: false, error: 'invalid_hostname' });
        return false;
      }
      browser.tabs.create({ url: mailtoUrl })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err?.message || 'create_failed' }));
      return true;
    }

    case 'FORCE_REFRESH': {
      browser.storage.local.remove([STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS])
        .then(() => fetchAndCacheDomains())
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err?.message || 'refresh_failed' }));
      return true;
    }

    case 'GET_STATUS': {
      browser.storage.local.get([STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS]).then(r => {
        sendResponse({
          domainCount: (r[STORAGE_KEYS.DOMAINS] || []).length,
          cacheAge: r[STORAGE_KEYS.CACHE_TS] ? Date.now() - r[STORAGE_KEYS.CACHE_TS] : null
        });
      });
      return true;
    }

    default:
      sendResponse({ error: 'unknown_type' });
      return false;
  }
});
