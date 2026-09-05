// Testy background skriptů obou variant doplňku.
// Stejná sada běží proti Chrome/background.js i Firefox/background.js.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadBackground, allSourcesOk, feed, reply, httpError, timeout, readFixture, plain,
  VARIANTS, COI_URL, SOI_URL, BOIT_URL,
} from './harness.mjs';

/** deepEqual, který snese hodnoty vzniklé uvnitř vm realmu. */
const eq = (actual, expected, message) => assert.deepEqual(plain(actual), plain(expected), message);

const NOW = Date.parse('2026-09-05T09:00:00Z');

/** Storage se všemi třemi zdroji už načtenými. */
function seeded(now, { coi = ['coi-a.example'], soi = ['soi-a.example'], boit = ['rt.com'] } = {}) {
  return {
    boit_source_cache: {
      version: 1,
      sources: {
        COI: { domains: coi, ts: now },
        SOI: { domains: soi, ts: now },
        BOIT: { domains: boit, ts: now },
      },
      legacy: null,
    },
    boit_rizikove_domains: [...coi, ...soi, ...boit],
    boit_rizikove_ts: now,
  };
}

for (const variant of VARIANTS) {
  // ── B5: platný TXT, prázdný seznam, CRLF, www., subdomény, punycode, dedup ──

  test(`${variant}: BOIT feed — platné vstupy`, async (t) => {
    const { bg } = loadBackground(variant, { routes: allSourcesOk() });

    await t.test('běžný seznam', () => {
      eq(bg.parseDomainsFromBoitFeed(feed('rt.com', 'podvod.example')),
        ['rt.com', 'podvod.example']);
    });

    await t.test('samotná hlavička je platná prázdná aktualizace', () => {
      eq(bg.parseDomainsFromBoitFeed(feed()), []);
      eq(bg.parseDomainsFromBoitFeed('# BOIT risk feed v1'), []);
    });

    await t.test('CRLF', () => {
      eq(
        bg.parseDomainsFromBoitFeed('# BOIT risk feed v1\r\nrt.com\r\n\r\n# pozn\r\npodvod.example\r\n'),
        ['rt.com', 'podvod.example']);
    });

    await t.test('UTF-8 BOM', () => {
      eq(bg.parseDomainsFromBoitFeed('﻿' + feed('rt.com')), ['rt.com']);
    });

    await t.test('komentáře a prázdné řádky', () => {
      eq(bg.parseDomainsFromBoitFeed(feed('# hlavička sekce', '', 'rt.com', '')), ['rt.com']);
    });

    await t.test('punycode a subdomény', () => {
      eq(
        bg.parseDomainsFromBoitFeed(feed('xn--pklad-9ta5m.example', 'shop.podvod.example')),
        ['xn--pklad-9ta5m.example', 'shop.podvod.example']);
    });

    await t.test('duplicitu klient tiše deduplikuje', () => {
      eq(bg.parseDomainsFromBoitFeed(feed('rt.com', 'rt.com')), ['rt.com']);
    });

    await t.test('doména ze safelistu se z feedu nepřijme', () => {
      eq(bg.parseDomainsFromBoitFeed(feed('seznam.cz', 'rt.com')), ['rt.com']);
    });
  });

  // ── B5: chybějící hlavička, HTML, neplatné řádky, limity ──

  test(`${variant}: BOIT feed — odmítnutí celé odpovědi`, async (t) => {
    const { bg } = loadBackground(variant, { routes: allSourcesOk() });
    const rejects = (input, re) => assert.throws(() => bg.parseDomainsFromBoitFeed(input), re);

    await t.test('chybějící hlavička', () => rejects('rt.com\n', /hlavička/));
    await t.test('prázdný soubor', () => rejects('', /hlavička/));
    await t.test('HTML chybová stránka', () => rejects(readFixture('github-404.html'), /hlavička/));
    await t.test('jiná verze hlavičky', () => rejects('# BOIT risk feed v2\n', /hlavička/));

    const badLines = [
      ['URL s cestou', 'https://podvod.example/kosik'],
      ['samotná cesta', 'podvod.example/kosik'],
      ['port', 'podvod.example:8080'],
      ['e-mail', 'info@podvod.example'],
      ['wildcard', '*.podvod.example'],
      ['IP adresa', '203.0.113.10'],
      ['velká písmena', 'Podvod.example'],
      ['úvodní www.', 'www.podvod.example'],
      ['komentář za doménou', 'podvod.example # důvod'],
      ['chybný label', 'pod_vod.example'],
      ['pomlčka na konci labelu', 'podvod-.example'],
      ['jeden label', 'localhost'],
      ['mimo ASCII', 'příklad.example'],
      ['odsazení', '  podvod.example'],
      ['prázdný label', 'podvod..example'],
      ['příliš dlouhý label', 'a'.repeat(64) + '.example'],
    ];
    for (const [name, line] of badLines) {
      await t.test(name + ' odmítne celý feed', () => {
        rejects(feed('rt.com', line), /neplatný řádek/);
      });
    }

    await t.test('překročení limitu počtu domén', () => {
      const many = Array.from({ length: bg.MAX_DOMAINS + 1 }, (_, i) => `d${i}.example`);
      rejects(feed(...many), /limit/);
    });
  });

  // ── B5: HTTP 200, 404, timeout, limity velikosti ──

  test(`${variant}: načtení zdroje`, async (t) => {
    const boitSource = () => loadBackground(variant, { routes: allSourcesOk() }).bg.SOURCES.find(s => s.name === 'BOIT');

    await t.test('HTTP 200 s platným feedem', async () => {
      const { bg } = loadBackground(variant, { routes: allSourcesOk({ boit: feed('rt.com') }) });
      const result = await bg.fetchOneSource(boitSource());
      eq(result, { name: 'BOIT', ok: true, domains: ['rt.com'] });
    });

    await t.test('prázdný feed s hlavičkou je úspěch', async () => {
      const { bg } = loadBackground(variant, { routes: allSourcesOk({ boit: feed() }) });
      const result = await bg.fetchOneSource(boitSource());
      assert.equal(result.ok, true);
      eq(result.domains, []);
    });

    await t.test('HTTP 404 je chyba', async () => {
      const { bg } = loadBackground(variant, { routes: { ...allSourcesOk(), [BOIT_URL]: httpError(404) } });
      const result = await bg.fetchOneSource(boitSource());
      assert.equal(result.ok, false);
    });

    await t.test('timeout je chyba', async () => {
      const { bg } = loadBackground(variant, { routes: { ...allSourcesOk(), [BOIT_URL]: timeout() } });
      const result = await bg.fetchOneSource(boitSource());
      assert.equal(result.ok, false);
    });

    await t.test('HTML místo feedu je chyba', async () => {
      const { bg } = loadBackground(variant, {
        routes: { ...allSourcesOk(), [BOIT_URL]: reply(readFixture('github-404.html')) },
      });
      const result = await bg.fetchOneSource(boitSource());
      assert.equal(result.ok, false);
    });

    await t.test('deklarovaná velikost nad 2 MiB je chyba', async () => {
      const { bg } = loadBackground(variant, {
        routes: { ...allSourcesOk(), [BOIT_URL]: reply(feed('rt.com'), { headers: { 'content-length': String(3 * 1024 * 1024) } }) },
      });
      const result = await bg.fetchOneSource(boitSource());
      assert.equal(result.ok, false);
    });

    await t.test('skutečné tělo nad 2 MiB je chyba i bez content-length', async () => {
      const big = feed(...Array.from({ length: 90000 }, (_, i) => `d${i}.example`));
      const { bg } = loadBackground(variant, { routes: { ...allSourcesOk(), [BOIT_URL]: reply(big) } });
      const result = await bg.fetchOneSource(boitSource());
      assert.equal(result.ok, false);
    });

    await t.test('safeFetch odmítne jiné schéma než HTTPS', async () => {
      const { bg } = loadBackground(variant, { routes: allSourcesOk() });
      await assert.rejects(() => bg.safeFetch('http://spajk-cz.github.io/x.txt'), /HTTPS/);
    });

    await t.test('prázdný výsledek HTML parseru je konzervativně chyba', async () => {
      const { bg } = loadBackground(variant, { routes: { ...allSourcesOk(), [COI_URL]: reply('<html><body>nic</body></html>') } });
      const coi = bg.SOURCES.find(s => s.name === 'COI');
      const result = await bg.fetchOneSource(coi);
      assert.equal(result.ok, false);
    });

    await t.test('fetch nikam neposílá cookies', async () => {
      const h = loadBackground(variant, { routes: allSourcesOk() });
      await h.bg.fetchAndCacheDomains();
      for (const call of h.fetchCalls) assert.equal(call.init.credentials, 'omit');
    });
  });

  // ── B5: shody, subdomény, safelist, whitelist ──

  test(`${variant}: vyhodnocení domény`, async (t) => {
    const h = loadBackground(variant, {
      now: NOW,
      routes: allSourcesOk({ boit: feed('rt.com') }),
    });
    await h.bg.fetchAndCacheDomains();
    const list = h.storage.boit_rizikove_domains;

    await t.test('ČOI-only shoda', () => {
      assert.equal(h.bg.isRiskyMatch('coi-podvod-jedna.example', list), true);
    });
    await t.test('SOI-only shoda', () => {
      assert.equal(h.bg.isRiskyMatch('soi-podvod-tri.example', list), true);
    });
    await t.test('BOIT-only shoda', () => {
      assert.equal(h.bg.isRiskyMatch('rt.com', list), true);
    });
    await t.test('rodičovská doména zahrnuje subdomény', () => {
      assert.equal(h.bg.isRiskyMatch('francais.rt.com', list), true);
      assert.equal(h.bg.isRiskyMatch('a.b.rt.com', list), true);
    });
    await t.test('podobný nesouvisející hostname se nechytá', () => {
      assert.equal(h.bg.isRiskyMatch('notrt.com', list), false);
      assert.equal(h.bg.isRiskyMatch('rt.com.example', list), false);
      assert.equal(h.bg.isRiskyMatch('rt.company', list), false);
    });
    await t.test('www. se normalizuje', () => {
      assert.equal(h.bg.isRiskyMatch(h.bg.normalizeHostname('www.rt.com'), list), true);
      assert.equal(h.bg.isRiskyMatch(h.bg.normalizeHostname('WWW.RT.COM'), list), true);
    });
    await t.test('bezpečné domény zůstávají bezpečné', () => {
      for (const safe of ['seznam.cz', 'google.com', 'coi.gov.cz', 'example.org']) {
        assert.equal(h.bg.isRiskyMatch(safe, list), false, safe);
      }
    });
  });

  test(`${variant}: whitelist`, async (t) => {
    await t.test('trvalé povolení', async () => {
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk() });
      assert.equal(await h.bg.addWhitelist('rt.com', null), true);
      assert.equal(await h.bg.isWhitelisted('rt.com'), true);
      assert.equal(await h.bg.removeWhitelist('rt.com'), true);
      assert.equal(await h.bg.isWhitelisted('rt.com'), false);
    });

    await t.test('dočasné povolení na 24 h vyprší', async () => {
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk() });
      await h.bg.addWhitelist('rt.com', 24 * 3600 * 1000);
      assert.equal(await h.bg.isWhitelisted('rt.com'), true);
      h.advance(23 * 3600 * 1000);
      assert.equal(await h.bg.isWhitelisted('rt.com'), true);
      h.advance(2 * 3600 * 1000);
      assert.equal(await h.bg.isWhitelisted('rt.com'), false);
    });

    await t.test('whitelist normalizuje www.', async () => {
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk() });
      await h.bg.addWhitelist('www.rt.com', null);
      assert.equal(await h.bg.isWhitelisted('rt.com'), true);
    });
  });

  // ── B5: výpadky zdrojů ──

  test(`${variant}: výpadky zdrojů`, async (t) => {
    for (const broken of ['COI', 'SOI', 'BOIT']) {
      await t.test(`výpadek ${broken} nesmaže jeho poslední data`, async () => {
        const h = loadBackground(variant, {
          now: NOW,
          routes: allSourcesOk({ boit: feed('rt.com') }),
        });
        await h.bg.fetchAndCacheDomains();
        const before = [...h.storage.boit_rizikove_domains];

        const url = { COI: COI_URL, SOI: SOI_URL, BOIT: BOIT_URL }[broken];
        h.route(url, httpError(500));
        h.advance(60_000);

        const status = await h.bg.fetchAndCacheDomains();
        eq(status.failed, [broken]);
        assert.equal(status.partial, true);
        assert.equal(status.complete, false);
        eq(h.storage.boit_rizikove_domains, before, 'seznam se nesmí zmenšit');
        assert.equal(h.storage.boit_source_cache.sources[broken].ts, NOW,
          'datum posledního úspěchu se nesmí přepsat časem neúspěchu');
      });
    }

    await t.test('výpadek všech zdrojů ponechá data a nehlásí úspěch', async () => {
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk({ boit: feed('rt.com') }) });
      await h.bg.fetchAndCacheDomains();
      const before = [...h.storage.boit_rizikove_domains];

      h.route(COI_URL, httpError(500));
      h.route(SOI_URL, timeout());
      h.route(BOIT_URL, httpError(404));
      h.advance(60_000);

      const status = await h.bg.fetchAndCacheDomains();
      eq(status.refreshed, []);
      assert.equal(status.complete, false);
      eq(h.storage.boit_rizikove_domains, before);
      assert.equal(h.storage.boit_rizikove_ts, NOW, 'stáří se nesmí tvářit jako čerstvé');
    });

    await t.test('ruční obnova nemaže cache předem', async () => {
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk({ boit: feed('rt.com') }) });
      await h.bg.fetchAndCacheDomains();
      const before = [...h.storage.boit_rizikove_domains];

      h.route(COI_URL, httpError(500));
      h.route(SOI_URL, httpError(500));
      h.route(BOIT_URL, httpError(500));

      // Stejná cesta, kterou používá FORCE_REFRESH.
      const status = await h.bg.fetchAndCacheDomains();
      assert.equal(status.refreshed.length, 0);
      eq(h.storage.boit_rizikove_domains, before);
    });

    await t.test('restart s uloženou cache nestahuje znovu', async () => {
      const h = loadBackground(variant, { now: NOW, storage: seeded(NOW), routes: allSourcesOk() });
      await h.bg.refreshIfNeeded();
      assert.equal(h.fetchCalls.length, 0);
      eq(h.storage.boit_rizikove_domains, ['coi-a.example', 'soi-a.example', 'rt.com']);
    });
  });

  // ── B5: migrace ze starší verze ──

  test(`${variant}: migrace ze starší instalace`, async (t) => {
    const legacyStorage = {
      boit_rizikove_domains: ['stary-podvod.example', 'druhy-stary.example'],
      boit_rizikove_ts: NOW - 3600_000,
    };

    await t.test('stará sloučená cache přežije nedostupné ČOI i SOI', async () => {
      const h = loadBackground(variant, {
        now: NOW,
        storage: { ...legacyStorage },
        routes: { [COI_URL]: httpError(500), [SOI_URL]: httpError(500), [BOIT_URL]: reply(feed('rt.com')) },
      });
      const status = await h.bg.fetchAndCacheDomains();

      eq(status.refreshed, ['BOIT']);
      assert.equal(status.migrating, true, 'legacy fallback musí zůstat');
      assert.ok(h.storage.boit_rizikove_domains.includes('stary-podvod.example'));
      assert.ok(h.storage.boit_rizikove_domains.includes('rt.com'));
      assert.equal(h.storage.boit_source_cache.legacy.domains.length, 2);
      assert.equal(h.storage.boit_source_cache.sources.COI, undefined,
        'neznámá stará data se nesmí falešně přiřadit zdroji');
    });

    await t.test('po zotavení ČOI i SOI se fallback vyřadí', async () => {
      const h = loadBackground(variant, {
        now: NOW,
        storage: { ...legacyStorage },
        routes: { [COI_URL]: httpError(500), [SOI_URL]: httpError(500), [BOIT_URL]: reply(feed('rt.com')) },
      });
      await h.bg.fetchAndCacheDomains();

      h.route(COI_URL, reply(readFixture('coi.html')));
      h.route(SOI_URL, reply(readFixture('soi.html')));
      h.advance(60_000);
      const status = await h.bg.fetchAndCacheDomains();

      assert.equal(status.complete, true);
      assert.equal(status.migrating, false);
      assert.equal(h.storage.boit_source_cache.legacy, null);
      assert.ok(!h.storage.boit_rizikove_domains.includes('stary-podvod.example'),
        'po plném zotavení už stará neznámá data nemají zůstávat');
    });

    await t.test('aktualizace s čerstvou starou cache stejně zkusí nový zdroj', async () => {
      const h = loadBackground(variant, {
        now: NOW,
        storage: { boit_rizikove_domains: ['stary-podvod.example'], boit_rizikove_ts: NOW - 60_000 },
        routes: allSourcesOk({ boit: feed('rt.com') }),
      });
      await h.bg.refreshIfNeeded();
      assert.ok(h.fetchCalls.some(c => c.url === BOIT_URL), 'BOIT se musí zkusit i při čerstvé staré cache');
      assert.ok(h.storage.boit_rizikove_domains.includes('rt.com'));
    });
  });

  // ── B5: odebrání domény z feedu ──

  test(`${variant}: odebrání domény z BOIT feedu`, async (t) => {
    await t.test('odebraná doména zmizí po úspěšné obnově', async () => {
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk({ boit: feed('rt.com', 'druhy.example') }) });
      await h.bg.fetchAndCacheDomains();
      assert.ok(h.storage.boit_rizikove_domains.includes('druhy.example'));

      h.route(BOIT_URL, reply(feed('rt.com')));
      h.advance(60_000);
      await h.bg.fetchAndCacheDomains();

      assert.ok(h.storage.boit_rizikove_domains.includes('rt.com'));
      assert.ok(!h.storage.boit_rizikove_domains.includes('druhy.example'));
    });

    await t.test('odebrání poslední domény nechá platný prázdný feed', async () => {
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk({ boit: feed('rt.com') }) });
      await h.bg.fetchAndCacheDomains();

      h.route(BOIT_URL, reply(feed()));
      h.advance(60_000);
      const status = await h.bg.fetchAndCacheDomains();

      assert.equal(status.complete, true);
      eq(h.storage.boit_source_cache.sources.BOIT.domains, []);
      assert.ok(!h.storage.boit_rizikove_domains.includes('rt.com'));
      // ČOI/SOI záznamy zůstávají.
      assert.ok(h.storage.boit_rizikove_domains.includes('coi-podvod-jedna.example'));
    });

    await t.test('záznam vedený i jiným zdrojem zůstane', async () => {
      const shared = 'coi-podvod-jedna.example';
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk({ boit: feed(shared) }) });
      await h.bg.fetchAndCacheDomains();

      h.route(BOIT_URL, reply(feed()));
      h.advance(60_000);
      await h.bg.fetchAndCacheDomains();

      assert.ok(h.storage.boit_rizikove_domains.includes(shared),
        'doména musí zůstat, protože ji dál uvádí ČOI');
    });
  });

  // ── B5: limity sloučeného seznamu ──

  test(`${variant}: limity sloučeného seznamu`, async (t) => {
    await t.test('sjednocení smí přesáhnout 5 000 a nesmí utnout konec BOIT feedu', async () => {
      const boitDomains = Array.from({ length: 5000 }, (_, i) => `boit${i}.example`);
      const last = boitDomains[boitDomains.length - 1];
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk({ boit: feed(...boitDomains) }) });

      await h.bg.fetchAndCacheDomains();
      const list = h.storage.boit_rizikove_domains;

      assert.equal(list.length, 5006, 'ČOI 3 + SOI 3 + BOIT 5000');
      assert.ok(list.length > h.bg.MAX_DOMAINS, 'seznam se nesmí utnout na 5 000');
      assert.ok(list.includes(last), 'poslední položka BOIT feedu musí přežít');
      assert.ok(list.includes('coi-podvod-jedna.example'));
    });

    await t.test('limit sjednocení je součet limitů zdrojů', () => {
      const { bg } = loadBackground(variant, { routes: allSourcesOk() });
      assert.equal(bg.MAX_MERGED_DOMAINS, bg.MAX_DOMAINS * bg.SOURCES.length);
      assert.equal(bg.MAX_MERGED_DOMAINS, 15000);
    });
  });

  // ── B5: TTL, alarmy, souběh ──

  test(`${variant}: obnova, TTL a souběh`, async (t) => {
    await t.test('stáří přesně TTL je splatné', async () => {
      const h = loadBackground(variant, { now: NOW, storage: seeded(NOW - 6 * 3600 * 1000), routes: allSourcesOk() });
      await h.bg.refreshIfNeeded();
      assert.equal(h.fetchCalls.length, 3, 'na hranici TTL se má obnovovat');
    });

    await t.test('těsně pod TTL se neobnovuje', async () => {
      const h = loadBackground(variant, { now: NOW, storage: seeded(NOW - 6 * 3600 * 1000 + 1000), routes: allSourcesOk() });
      await h.bg.refreshIfNeeded();
      assert.equal(h.fetchCalls.length, 0);
    });

    await t.test('alarm se registruje při instalaci a spouští obnovu', async () => {
      const h = loadBackground(variant, { now: NOW, storage: seeded(NOW), routes: allSourcesOk() });
      assert.equal(h.listeners.onInstalled.length, 1);
      assert.equal(h.listeners.onAlarm.length, 1);
      assert.equal(h.listeners.onStartup.length, 1);

      h.listeners.onInstalled[0]();
      eq(h.alarmsCreated, [{ name: 'boit_refresh', info: { periodInMinutes: 360 } }]);

      h.advance(6 * 3600 * 1000);
      await h.listeners.onAlarm[0]({ name: 'boit_refresh' });
      await new Promise(r => setImmediate(r));
      assert.equal(h.fetchCalls.length, 3, 'alarm musí obnovu skutečně spustit');
    });

    await t.test('cizí alarm obnovu nespouští', async () => {
      const h = loadBackground(variant, { now: NOW, storage: seeded(NOW), routes: allSourcesOk() });
      await h.listeners.onAlarm[0]({ name: 'neco_jineho' });
      await new Promise(r => setImmediate(r));
      assert.equal(h.fetchCalls.length, 0);
    });

    await t.test('souběžné požadavky sdílí jeden refresh', async () => {
      let resolveCoi;
      const gate = new Promise(r => { resolveCoi = r; });
      const h = loadBackground(variant, {
        now: NOW,
        routes: {
          ...allSourcesOk({ boit: feed('rt.com') }),
          [COI_URL]: async () => { await gate; return reply(readFixture('coi.html')); },
        },
      });

      const first = h.bg.fetchAndCacheDomains();
      const second = h.bg.fetchAndCacheDomains();
      assert.equal(first, second, 'druhé volání musí dostat tutéž promise');

      resolveCoi();
      const [a, b] = await Promise.all([first, second]);
      eq(a, b);
      assert.equal(h.fetchCalls.filter(c => c.url === COI_URL).length, 1, 'ČOI se stáhla jen jednou');
    });

    await t.test('po dokončení lze spustit další refresh', async () => {
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk({ boit: feed('rt.com') }) });
      await h.bg.fetchAndCacheDomains();
      await h.bg.fetchAndCacheDomains();
      assert.equal(h.fetchCalls.filter(c => c.url === BOIT_URL).length, 2);
    });
  });

  // ── B5: zachování HTML parserů ──

  test(`${variant}: HTML parsery ČOI/SOI beze změny`, async (t) => {
    const { bg } = loadBackground(variant, { routes: allSourcesOk() });

    await t.test('ČOI fixture', () => {
      const domains = bg.parseDomainsFromHtml(readFixture('coi.html'));
      for (const d of ['coi-podvod-jedna.example', 'coi-podvod-dva.example', 'coi-podvod-tri.example']) {
        assert.ok(domains.includes(d), 'chybí ' + d);
      }
      assert.ok(!domains.includes('coi.gov.cz'), 'safelist se nesmí zařadit');
      assert.ok(!domains.includes('google.com'), 'safelist se nesmí zařadit');
    });

    await t.test('SOI fixture včetně multi-domain řádku a [PDF] suffixu', () => {
      const domains = bg.parseDomainsFromHtml(readFixture('soi.html'));
      for (const d of ['soi-podvod-jedna.example', 'soi-podvod-dva.example', 'soi-podvod-tri.example']) {
        assert.ok(domains.includes(d), 'chybí ' + d);
      }
      assert.ok(!domains.includes('soi.sk'));
    });

    await t.test('BOIT feed se HTML parserem nezpracovává', async () => {
      const h = loadBackground(variant, { now: NOW, routes: allSourcesOk({ boit: feed('rt.com') }) });
      const boit = h.bg.SOURCES.find(s => s.name === 'BOIT');
      assert.equal(boit.format, 'text');
      // Tolerantní parser by z chybné URL udělal hostname; přísný ji odmítne.
      assert.ok(h.bg.parseDomainsFromHtml('https://podvod.example/kosik').includes('podvod.example'));
      assert.throws(() => h.bg.parseDomainsFromBoitFeed(feed('https://podvod.example/kosik')));
    });
  });

  // ── Konfigurace zdroje ──

  test(`${variant}: konfigurace zdrojů`, async (t) => {
    const { bg } = loadBackground(variant, { routes: allSourcesOk() });

    await t.test('tři zdroje, ČOI/SOI beze změny', () => {
      eq(bg.SOURCES.map(s => s.name), ['COI', 'SOI', 'BOIT']);
      assert.equal(bg.SOURCES[0].url, COI_URL);
      assert.equal(bg.SOURCES[1].url, SOI_URL);
    });

    await t.test('BOIT ukazuje na ověřenou produkční URL přes HTTPS', () => {
      assert.equal(bg.BOIT_FEED_URL, BOIT_URL);
      assert.ok(bg.BOIT_FEED_URL.startsWith('https://'));
    });

    await t.test('detekce dál čte původní klíč', () => {
      assert.equal(bg.STORAGE_KEYS.DOMAINS, 'boit_rizikove_domains');
      assert.equal(bg.STORAGE_KEYS.SOURCE_CACHE, 'boit_source_cache');
    });

    await t.test('poškozená per-source cache se ignoruje, ne zhroutí', () => {
      for (const junk of [null, 'nesmysl', 42, { sources: 'ne' }, { sources: { BOIT: { domains: 'ne' } } }]) {
        const cache = bg.normalizeSourceCache(junk);
        eq(cache.sources, {});
        assert.equal(cache.legacy, null);
      }
    });
  });
}

// ── Tlačítko „Nahlásit" — otevírá stránku projektu, ne mailto na ČOI ──

for (const variant of VARIANTS) {
  test(`${variant}: nahlášení otevírá stránku projektu`, async (t) => {
    const REPORT_URL = 'https://github.com/spajk-cz/BOIT-Rizikov-E-shopy/blob/main/NAHLASENI.md';

    /** Zavolá message listener a počká na odpověď. */
    function send(h, message, sender = { id: 'boit-test' }) {
      return new Promise((resolve) => {
        const returned = h.listeners.onMessage[0](message, sender, resolve);
        if (returned !== true) resolve(undefined);
      });
    }

    await t.test('konstanta ukazuje na stránku projektu přes HTTPS', () => {
      const { bg } = loadBackground(variant, { routes: allSourcesOk() });
      assert.equal(bg.REPORT_PAGE_URL, REPORT_URL);
      assert.ok(bg.REPORT_PAGE_URL.startsWith('https://'));
    });

    await t.test('OPEN_REPORT_PAGE otevře záložku a potvrdí úspěch', async () => {
      const h = loadBackground(variant, { routes: allSourcesOk() });
      const res = await send(h, { type: 'OPEN_REPORT_PAGE' });

      eq(h.tabsCreated, [{ url: REPORT_URL }]);
      eq(res, { ok: true });
    });

    await t.test('v URL není doména, query ani mailto', async () => {
      const h = loadBackground(variant, { routes: allSourcesOk() });
      await send(h, { type: 'OPEN_REPORT_PAGE', hostname: 'rt.com', signals: [{ title: 'x' }] });

      const url = h.tabsCreated[0].url;
      assert.equal(url, REPORT_URL, 'handler nesmí do URL nic přidat');
      assert.ok(!url.includes('?'), 'žádný query parametr');
      assert.ok(!url.includes('rt.com'), 'kontrolovaná doména se nesmí odeslat');
      assert.ok(!url.startsWith('mailto:'), 'už žádné mailto');
    });

    await t.test('původní REPORT_COI už neexistuje', async () => {
      const h = loadBackground(variant, { routes: allSourcesOk() });
      const res = await send(h, { type: 'REPORT_COI', hostname: 'rt.com' });

      eq(res, { error: 'unknown_type' });
      eq(h.tabsCreated, []);
    });

    await t.test('zpráva z cizího rozšíření se odmítne', async () => {
      const h = loadBackground(variant, { routes: allSourcesOk() });
      const res = await send(h, { type: 'OPEN_REPORT_PAGE' }, { id: 'cizi-doplnek' });

      eq(res, { error: 'unauthorized' });
      eq(h.tabsCreated, []);
    });
  });
}
