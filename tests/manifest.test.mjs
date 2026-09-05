// Kontrola obou manifestů a shody produkční feed URL s host_permissions a CSP.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadBackground, allSourcesOk, repoRoot, VARIANTS, BOIT_URL } from './harness.mjs';

const read = (relative) => readFileSync(`${repoRoot}${relative}`, 'utf8');
const manifest = (variant) => JSON.parse(read(`${variant}/manifest.json`));

const feedOrigin = new URL(BOIT_URL).origin;          // https://spajk-cz.github.io
const feedHostPermission = `${feedOrigin}/*`;

test('manifesty', async (t) => {
  for (const variant of VARIANTS) {
    await t.test(`${variant}: platný JSON a MV3`, () => {
      const m = manifest(variant);
      assert.equal(m.manifest_version, 3);
      assert.equal(typeof m.version, 'string');
      assert.match(m.version, /^\d+\.\d+\.\d+$/);
    });

    await t.test(`${variant}: host permission pro feed`, () => {
      const m = manifest(variant);
      assert.ok(m.host_permissions.includes(feedHostPermission),
        `host_permissions musí obsahovat ${feedHostPermission}`);
      assert.ok(m.host_permissions.includes('https://coi.gov.cz/*'), 'ČOI se nesmí ztratit');
      assert.ok(m.host_permissions.includes('https://www.soi.sk/*'), 'SOI se nesmí ztratit');
    });

    await t.test(`${variant}: CSP connect-src obsahuje origin feedu`, () => {
      const csp = manifest(variant).content_security_policy.extension_pages;
      const connectSrc = csp.split(';').map(s => s.trim()).find(s => s.startsWith('connect-src'));
      assert.ok(connectSrc, 'connect-src musí existovat');
      assert.ok(connectSrc.split(/\s+/).includes(feedOrigin), `connect-src musí obsahovat ${feedOrigin}`);
    });

    await t.test(`${variant}: žádné rozvolnění oprávnění`, () => {
      const m = manifest(variant);
      const raw = JSON.stringify(m);
      assert.ok(!raw.includes('*.github.io'), 'žádný wildcard přes celý github.io');
      assert.ok(!raw.includes('raw.githubusercontent.com'), 'žádný alternativní host');
      assert.ok(!m.host_permissions.includes('<all_urls>'), 'žádný <all_urls>');
      assert.deepEqual([...m.permissions].sort(), ['alarms', 'storage', 'tabs'],
        'žádná nová API permission');

      const csp = m.content_security_policy.extension_pages;
      const scriptSrc = csp.split(';').map(s => s.trim()).find(s => s.startsWith('script-src'));
      assert.equal(scriptSrc, "script-src 'self'", 'script-src se nesmí rozšiřovat');
    });
  }

  await t.test('Chrome používá service worker, Firefox event page', () => {
    assert.equal(manifest('Chrome').background.service_worker, 'background.js');
    assert.deepEqual(manifest('Firefox').background.scripts, ['background.js']);
    assert.equal(manifest('Firefox').browser_specific_settings.gecko.id, 'rizikove-eshopy@boit.cz',
      'ID produkčního doplňku se nesmí měnit');
  });
});

test('shoda verzí napříč soubory', async (t) => {
  const chromeVersion = manifest('Chrome').version;

  await t.test('oba manifesty mají stejnou verzi', () => {
    assert.equal(manifest('Firefox').version, chromeVersion);
  });

  await t.test('verze je vyšší než původní 1.7.0', () => {
    const [major, minor] = chromeVersion.split('.').map(Number);
    assert.ok(major > 1 || (major === 1 && minor >= 8), `verze ${chromeVersion} musí být alespoň 1.8.0`);
  });

  for (const variant of VARIANTS) {
    await t.test(`${variant}: patička popupu ukazuje verzi z manifestu`, () => {
      assert.match(read(`${variant}/popup.html`),
        new RegExp(`class="footer-sub">v${chromeVersion.replace(/\./g, '\\.')}<`));
    });

    await t.test(`${variant}: patička overlaye ukazuje verzi z manifestu`, () => {
      assert.match(read(`${variant}/content.js`),
        new RegExp(`boit-footer-right">v${chromeVersion.replace(/\./g, '\\.')}<`));
    });
  }
});

test('feed URL je v kódu i v manifestu shodná', async (t) => {
  for (const variant of VARIANTS) {
    await t.test(variant, () => {
      const { bg } = loadBackground(variant, { routes: allSourcesOk() });
      const m = manifest(variant);

      assert.equal(bg.BOIT_FEED_URL, BOIT_URL);
      assert.ok(bg.BOIT_FEED_URL.startsWith(feedOrigin + '/'),
        'fetch URL musí ležet pod originem z manifestu');
      assert.ok(m.host_permissions.includes(feedHostPermission));
      assert.ok(m.content_security_policy.extension_pages.includes(feedOrigin));
    });
  }
});

test('texty nemluví o BOIT jako o úřadu', async (t) => {
  for (const variant of VARIANTS) {
    await t.test(variant, () => {
      const content = read(`${variant}/content.js`);
      const popup = read(`${variant}/popup.html`);

      assert.ok(!content.includes('oficiálním seznamu'),
        'tvrzení o oficiálním seznamu neplatí pro BOIT záznamy');
      assert.ok(!content.includes('Provozovatel není ověřitelný'),
        'automatické tvrzení o provozovateli neplatí bez dalšího dokazování');
      assert.ok(!content.includes('ČOI · Rizikový e-shop'), 'eyebrow musí být obecný');
      assert.ok(!popup.includes('evidována v seznamu ČOI'), 'popup nesmí tvrdit jen ČOI');

      // Nový text musí zmínit všechny tři zdroje.
      for (const name of ['ČOI', 'SOI', 'BOIT']) {
        assert.ok(content.includes(name), `overlay musí zmínit ${name}`);
      }
    });
  }
});

test('nahlášení míří na stránku projektu, ne na úřad', async (t) => {
  const REPORT_URL = 'https://github.com/spajk-cz/BOIT-Rizikov-E-shopy/blob/main/NAHLASENI.md';
  const CONTACT = 'doplnek@boit.cz';

  await t.test('NAHLASENI.md existuje a nese kontaktní e-mail', () => {
    const page = read('NAHLASENI.md');
    assert.ok(page.includes(CONTACT), 'stránka musí obsahovat kontaktní e-mail');
    assert.match(page, /vyřazení/i, 'stránka musí řešit i žádost o vyřazení');
    assert.match(page, /nahlásit podvodný web/i, 'stránka musí řešit i nahlášení domény');
  });

  for (const variant of VARIANTS) {
    await t.test(`${variant}: content.js i background.js drží stejnou URL`, () => {
      for (const file of [`${variant}/content.js`, `${variant}/background.js`]) {
        const src = read(file);
        assert.ok(src.includes(`const REPORT_PAGE_URL = '${REPORT_URL}';`),
          `${file} musí mít shodnou konstantu REPORT_PAGE_URL`);
      }
    });

    await t.test(`${variant}: po mailto na úřad nezůstala stopa`, () => {
      for (const file of [`${variant}/content.js`, `${variant}/background.js`]) {
        const src = read(file);
        for (const gone of ['REPORT_COI', 'buildReportMailto', 'podatelna@coi.gov.cz', 'info@soi.sk', 'mailto:']) {
          assert.ok(!src.includes(gone), `${file} nesmí obsahovat ${gone}`);
        }
      }
    });

    await t.test(`${variant}: overlay ukazuje kontakt a nemá dynamický label úřadu`, () => {
      const src = read(`${variant}/content.js`);
      assert.ok(src.includes(CONTACT), 'overlay má ukázat kontaktní e-mail');
      assert.ok(!src.includes("hostname.endsWith('.sk') ? 'SOI'"),
        'dynamický ČOI/SOI label tlačítka už nemá existovat');
    });
  }
});
