// Testovací harness pro background skripty doplňku.
//
// Načítá SKUTEČNÝ Chrome/background.js a Firefox/background.js do vm kontextu
// s namockovaným chrome/browser API, fetchem, storage, časem a alarmy.
// Funkce se netestují přepsané — na konec zdroje se jen připojí řádek, který
// deklarované konstanty a funkce vystaví ven.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export const VARIANTS = ['Chrome', 'Firefox'];

const EXPORTED = [
  'SOURCES', 'STORAGE_KEYS', 'CACHE_TTL', 'MAX_DOMAINS', 'MAX_MERGED_DOMAINS',
  'MAX_DOMAIN_LENGTH', 'MAX_FEED_BYTES', 'BOIT_FEED_URL', 'BOIT_FEED_HEADER', 'SAFELIST',
  'isValidHostname', 'normalizeHostname', 'isRiskyMatch', 'safeFetch',
  'parseDomainsFromHtml', 'isValidBoitFeedDomain', 'parseDomainsFromBoitFeed',
  'fetchOneSource', 'normalizeSourceCache', 'loadSourceCache', 'computeCacheTs',
  'mergeSourceCache', 'fetchAndCacheDomains', 'refreshIfNeeded', 'REPORT_PAGE_URL',
  'isWhitelisted', 'addWhitelist', 'getWhitelist', 'removeWhitelist',
];

/**
 * Převede hodnotu z vm realmu do hostitelského. Pole a objekty vzniklé uvnitř
 * vm mají vlastní prototypy, takže by je deepStrictEqual jinak neuznal za shodné.
 * Zároveň slouží jako klon pro mock storage.
 */
export const plain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

const clone = plain;

export const COI_URL = 'https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/';
export const SOI_URL = 'https://www.soi.sk/informacie-pre-verejnost/internetove-obchody/rizikove-internetove-obchody';
export const BOIT_URL = 'https://spajk-cz.github.io/boit-risk-feed/blacklist.txt';

/** Odpověď fetch mocku. */
export const reply = (body, extra = {}) => ({ status: 200, body, ...extra });
export const httpError = (status) => ({ status, body: '' });
export const timeout = () => ({ abort: true });

/**
 * Načte background skript jedné varianty.
 *
 * @param {'Chrome'|'Firefox'} variant
 * @param {{now?: number, storage?: object, routes?: object}} options
 */
export function loadBackground(variant, options = {}) {
  const filename = `${repoRoot}${variant}/background.js`;
  const source = readFileSync(filename, 'utf8');

  const clock = { now: options.now ?? Date.parse('2026-09-05T09:00:00Z') };
  const storage = clone(options.storage ?? {}) ?? {};
  const routes = new Map(Object.entries(options.routes ?? {}));
  const fetchCalls = [];
  const alarmsCreated = [];
  const tabsCreated = [];
  const listeners = {
    onInstalled: [], onStartup: [], onAlarm: [], onMessage: [],
    tabsActivated: [], tabsUpdated: [],
  };
  const logs = { log: [], warn: [], error: [] };

  class MockDate extends Date {
    static now() { return clock.now; }
  }

  async function mockFetch(url, init) {
    fetchCalls.push({ url, init });
    const route = routes.get(url);
    if (route === undefined) throw new Error('nenamockovaná URL: ' + url);

    const resolved = typeof route === 'function' ? await route() : route;
    if (resolved.abort) {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    }

    const status = resolved.status ?? 200;
    const headers = resolved.headers ?? {};
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name) => headers[String(name).toLowerCase()] ?? null,
      },
      text: async () => resolved.body ?? '',
    };
  }

  const api = {
    runtime: {
      id: 'boit-test',
      lastError: null,
      onInstalled: { addListener: (fn) => listeners.onInstalled.push(fn) },
      onStartup: { addListener: (fn) => listeners.onStartup.push(fn) },
      onMessage: { addListener: (fn) => listeners.onMessage.push(fn) },
    },
    alarms: {
      create: (name, info) => alarmsCreated.push({ name, info }),
      onAlarm: { addListener: (fn) => listeners.onAlarm.push(fn) },
    },
    tabs: {
      get: (id, cb) => { if (cb) cb(undefined); },
      query: async () => [],
      // Podporuje callback (Chrome) i promise (Firefox) styl.
      create: (info, cb) => {
        tabsCreated.push(info);
        if (typeof cb === 'function') { cb({ id: 1 }); return undefined; }
        return Promise.resolve({ id: 1 });
      },
      onActivated: { addListener: (fn) => listeners.tabsActivated.push(fn) },
      onUpdated: { addListener: (fn) => listeners.tabsUpdated.push(fn) },
    },
    action: {
      setIcon: (_a, cb) => { if (cb) cb(); },
      setBadgeText: (_a, cb) => { if (cb) cb(); },
      setBadgeBackgroundColor: (_a, cb) => { if (cb) cb(); },
      setTitle: (_a, cb) => { if (cb) cb(); },
    },
    storage: {
      local: {
        async get(keys) {
          const out = {};
          for (const key of [].concat(keys)) {
            if (Object.prototype.hasOwnProperty.call(storage, key)) out[key] = clone(storage[key]);
          }
          return out;
        },
        async set(values) {
          for (const [key, value] of Object.entries(values)) storage[key] = clone(value);
        },
        async remove(keys) {
          for (const key of [].concat(keys)) delete storage[key];
        },
      },
    },
  };

  const context = vm.createContext({
    chrome: api,
    browser: api,
    fetch: mockFetch,
    setTimeout,
    clearTimeout,
    AbortController,
    TextEncoder,
    URL,
    Date: MockDate,
    console: {
      log: (...args) => logs.log.push(args.join(' ')),
      warn: (...args) => logs.warn.push(args.join(' ')),
      error: (...args) => logs.error.push(args.join(' ')),
    },
  });

  vm.runInContext(`${source}\n;globalThis.__boit = { ${EXPORTED.join(', ')} };\n`, context, { filename });

  return {
    variant,
    bg: context.__boit,
    storage,
    clock,
    routes,
    fetchCalls,
    alarmsCreated,
    tabsCreated,
    listeners,
    logs,
    /** Nastaví nebo přepíše odpověď pro danou URL. */
    route(url, value) { routes.set(url, value); },
    /** Posune mockované hodiny. */
    advance(ms) { clock.now += ms; },
  };
}

/** Feed s hlavičkou a danými řádky. */
export const feed = (...lines) => ['# BOIT risk feed v1', ...lines].join('\n') + '\n';

/** Všechny tři zdroje odpovídají úspěšně. */
export function allSourcesOk({ coi, soi, boit } = {}) {
  return {
    [COI_URL]: reply(coi ?? readFixture('coi.html')),
    [SOI_URL]: reply(soi ?? readFixture('soi.html')),
    [BOIT_URL]: reply(boit ?? feed()),
  };
}

export function readFixture(name) {
  return readFileSync(`${repoRoot}tests/fixtures/${name}`, 'utf8');
}
