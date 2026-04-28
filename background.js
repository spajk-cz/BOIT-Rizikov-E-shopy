/**
 * BOIT Rizikové E-shopy — background service worker
 * Security-hardened, Web Store ready
 */

'use strict';

// ─── Konstanty ──────────────────────────────────────────────────────────
const COI_URL = 'https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/';

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
  'coi.gov.cz', 'gov.cz', 'seznam.cz', 'eset.com', 'toplist.cz',
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

function parseDomainsFromHtml(html) {
  const domains = new Set();

  const blockRegex = /<p[^>]*>\s*(?:https?:\/\/)?([a-z0-9][a-z0-9\-_.]+\.[a-z]{2,}(?:\/[^\s<]{0,80})?)\s*<\/p>/gi;
  let m;
  while ((m = blockRegex.exec(html)) !== null) {
    const host = normalizeHostname((m[1] || '').split('/')[0]);
    if (isValidHostname(host) && !SAFELIST.has(host)) domains.add(host);
  }

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n');

  const lines = stripped.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length > 120) continue;
    const candidate = normalizeHostname(line.replace(/^https?:\/\//i, '').split('/')[0]);
    if (isValidHostname(candidate) && !SAFELIST.has(candidate)) {
      domains.add(candidate);
    }
  }

  return [...domains].slice(0, MAX_DOMAINS);
}

// ─── Fetch & cache ──────────────────────────────────────────────────────

async function fetchAndCacheDomains() {
  try {
    const html = await safeFetch(COI_URL);
    const domains = parseDomainsFromHtml(html);
    if (domains.length === 0) {
      console.warn('[BOIT] Parser vrátil 0 domén — cache nepřepisuji.');
      return;
    }
    await chrome.storage.local.set({
      [STORAGE_KEYS.DOMAINS]: domains,
      [STORAGE_KEYS.CACHE_TS]: Date.now()
    });
    console.log('[BOIT] Uloženo ' + domains.length + ' domén.');
  } catch (e) {
    console.error('[BOIT] Fetch chyba:', e.message || e);
  }
}

async function refreshIfNeeded() {
  const r = await chrome.storage.local.get([STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS]);
  const age = r[STORAGE_KEYS.CACHE_TS] ? Date.now() - r[STORAGE_KEYS.CACHE_TS] : Infinity;
  const hasData = Array.isArray(r[STORAGE_KEYS.DOMAINS]) && r[STORAGE_KEYS.DOMAINS].length > 0;
  if (!hasData || age > CACHE_TTL) await fetchAndCacheDomains();
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
  if (entry.until < Date.now()) {
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
  const safeTtl = (typeof ttlMs === 'number' && ttlMs > 0) ? ttlMs : 24 * 3600 * 1000;
  list[host] = { until: Date.now() + safeTtl };
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

function buildCoiMailto(hostname, signals) {
  const host = normalizeHostname(hostname);
  if (!isValidHostname(host)) return null;

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

  return 'mailto:podatelna@coi.gov.cz?subject=' + subject + '&body=' + body;
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
      title: isRisky ? "BOIT: Rizikový e-shop (dle ČOI)" : "BOIT Rizikové E-shopy — ochrana aktivní"
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
      const r = await chrome.storage.local.get([STORAGE_KEYS.DOMAINS]);
      const risky = isRiskyMatch(hostname, r[STORAGE_KEYS.DOMAINS] || []);
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
        const r = await chrome.storage.local.get([STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS]);
        const risky = isRiskyMatch(hostname, r[STORAGE_KEYS.DOMAINS] || []);
        const whitelisted = await isWhitelisted(hostname);
        const effective = risky && !whitelisted;
        if (sender.tab?.id) setIconForTab(sender.tab.id, effective);
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

    case 'REPORT_COI': {
      const mailtoUrl = buildCoiMailto(msg.hostname, msg.signals);
      if (!mailtoUrl) {
        sendResponse({ ok: false, error: 'invalid_hostname' });
        return false;
      }
      chrome.tabs.create({ url: mailtoUrl }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true });
        }
      });
      return true;
    }

    case 'FORCE_REFRESH': {
      chrome.storage.local.remove([STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS])
        .then(() => fetchAndCacheDomains())
        .then(() => sendResponse({ ok: true }));
      return true;
    }

    case 'GET_STATUS': {
      chrome.storage.local.get([STORAGE_KEYS.DOMAINS, STORAGE_KEYS.CACHE_TS]).then(r => {
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
