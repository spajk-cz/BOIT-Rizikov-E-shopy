// Barevné téma popupu a overlaye. Testuje se SKUTEČNÝ kód — skripty popupu
// se spouští v minimálním DOM, z content.js se vyřezávají jen potřebné bloky.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { repoRoot, VARIANTS, plain } from './harness.mjs';

const read = (relative) => readFileSync(`${repoRoot}${relative}`, 'utf8');
const THEME_STORAGE_KEY = 'boit_ui_theme';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

// ──────────────────────────────────────────────────────────────────────
// Pomocné funkce
// ──────────────────────────────────────────────────────────────────────

/** WCAG 2.x kontrastní poměr dvou barev #RRGGBB. */
function contrast(a, b) {
  const luminance = (hex) => {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Deklarace custom properties z CSS bloku jako { '--name': 'value' }. */
function declarations(block) {
  const out = {};
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[match[1]] = match[2].trim();
  return out;
}

/** Obsah bloku { … } začínajícího selektorem (bez vnořených bloků). */
function blockAfter(css, selector) {
  const start = css.indexOf(selector);
  assert.ok(start > -1, `blok ${selector} musí existovat`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

/** Minimální DOM pro theme-toggle.js a theme-init.js. */
function createPopupDom({ stored, mirror, storageFails = false, localStorageFails = false } = {}) {
  const storage = stored === undefined ? {} : { [THEME_STORAGE_KEY]: stored };
  const local = new Map(mirror === undefined ? [] : [[THEME_STORAGE_KEY, mirror]]);
  const handlers = {};
  let focused = null;

  const options = ['auto', 'light', 'dark'].map(value => ({
    dataset: { themeValue: value },
    attrs: {},
    tabIndex: 0,
    setAttribute(name, v) { this.attrs[name] = v; },
    closest() { return this; },
    focus() { focused = value; },
  }));

  const group = {
    querySelectorAll: () => options,
    addEventListener: (type, fn) => { handlers[type] = fn; },
  };

  const root = { dataset: {} };
  const api = {
    storage: {
      local: {
        async get(keys) {
          if (storageFails) throw new Error('storage nedostupný');
          const out = {};
          for (const key of [].concat(keys)) if (key in storage) out[key] = storage[key];
          return out;
        },
        async set(values) {
          if (storageFails) throw new Error('storage nedostupný');
          Object.assign(storage, values);
        },
      },
    },
  };

  const failing = () => { throw new Error('localStorage nedostupný'); };
  const context = vm.createContext({
    chrome: api,
    browser: api,
    document: {
      documentElement: root,
      getElementById: (id) => (id === 'themeSwitch' ? group : null),
    },
    localStorage: localStorageFails
      ? { getItem: failing, setItem: failing, removeItem: failing }
      : {
        getItem: (key) => (local.has(key) ? local.get(key) : null),
        setItem: (key, value) => local.set(key, String(value)),
        removeItem: (key) => local.delete(key),
      },
  });

  return {
    context,
    storage,
    local,
    root,
    run(file) { vm.runInContext(read(file), context, { filename: file }); },
    click(value) { handlers.click({ target: options.find(o => o.dataset.themeValue === value) }); },
    key(name) { handlers.keydown({ key: name, preventDefault() {} }); },
    checked() { return options.filter(o => o.attrs['aria-checked'] === 'true').map(o => o.dataset.themeValue); },
    tabbable() { return options.filter(o => o.tabIndex === 0).map(o => o.dataset.themeValue); },
    get focused() { return focused; },
  };
}

/** Palety overlaye z content.js (vyříznuté a vyhodnocené ve vm). */
function loadOverlayTokens(variant) {
  const source = read(`${variant}/content.js`);
  const start = source.indexOf('  const OVERLAY_DARK_TOKENS = {');
  const end = source.indexOf('  /** Převede paletu na deklarace custom properties. */');
  assert.ok(start > -1 && end > start, `${variant}: palety overlaye se nepodařilo najít`);

  const context = vm.createContext({});
  vm.runInContext(`${source.slice(start, end)}\n;globalThis.__tokens = { dark: OVERLAY_DARK_TOKENS, light: OVERLAY_LIGHT_TOKENS };`,
    context, { filename: `${variant}/content.js (palety)` });
  return plain(context.__tokens);
}

/** Blok "Téma overlaye" z content.js s namockovaným storage. */
function loadOverlayTheme(variant, { stored, storageFails = false } = {}) {
  const source = read(`${variant}/content.js`);
  const start = source.indexOf("  const THEME_STORAGE_KEY = 'boit_ui_theme';");
  const end = source.indexOf('  // Detekce rizikových signálů');
  assert.ok(start > -1 && end > start, `${variant}: blok tématu overlaye se nepodařilo najít`);

  const api = {
    storage: {
      local: {
        async get() {
          if (storageFails) throw new Error('storage nedostupný');
          return stored === undefined ? {} : { [THEME_STORAGE_KEY]: stored };
        },
      },
    },
  };
  const context = vm.createContext({ chrome: api, browser: api });
  vm.runInContext(`${source.slice(start, end)}\n;globalThis.__theme = { readThemePreference, applyOverlayTheme };`,
    context, { filename: `${variant}/content.js (téma)` });
  return context.__theme;
}

// ──────────────────────────────────────────────────────────────────────
// Popup: CSS tokeny
// ──────────────────────────────────────────────────────────────────────

test('popup.css: tokeny tmavého a světlého režimu', async (t) => {
  const css = read('Chrome/popup.css');
  const dark = declarations(blockAfter(css, ':root {'));
  const lightBySystem = declarations(blockAfter(css, ':root:not([data-theme="dark"]) {'));
  const lightManual = declarations(blockAfter(css, ':root[data-theme="light"] {'));

  await t.test('světlý blok podle prohlížeče a ruční světlý blok jsou shodné', () => {
    assert.deepEqual(lightBySystem, lightManual);
  });

  await t.test('světlý režim přepisuje každý tematický token tmavého režimu', () => {
    const brandConstants = ['--green', '--purple'];
    const themed = Object.keys(dark).filter(name => !brandConstants.includes(name)).sort();
    assert.deepEqual(Object.keys(lightManual).sort(), themed);
  });

  await t.test('světlý režim nastavuje color-scheme', () => {
    assert.match(blockAfter(css, ':root[data-theme="light"] {'), /color-scheme:\s*light/);
    assert.match(blockAfter(css, ':root {'), /color-scheme:\s*dark/);
  });

  await t.test('text ve světlém režimu splňuje WCAG AA (4.5:1) na obou plochách', () => {
    for (const name of ['--text', '--text-dim', '--text-mute', '--accent-text', '--logo',
      '--purple-2', '--cyan', '--pink', '--yellow']) {
      for (const surface of ['--bg', '--bg-2']) {
        const ratio = contrast(lightManual[name], lightManual[surface]);
        assert.ok(ratio >= 4.5, `${name} na ${surface}: ${ratio.toFixed(2)} < 4.5`);
      }
    }
  });

  await t.test('text na zelené výplni je čitelný v obou režimech', () => {
    assert.ok(contrast(dark['--on-accent'], dark['--accent-fill']) >= 4.5);
    assert.ok(contrast(lightManual['--on-accent'], lightManual['--accent-fill']) >= 4.5);
  });

  await t.test('neonová zelená se ve světlém režimu nepoužívá jako barva textu', () => {
    assert.notEqual(lightManual['--accent-text'].toUpperCase(), '#D3FD22');
    assert.match(lightManual['--marker'], /#D3FD22/, 'brand zůstává vidět přes zvýrazňovač');
  });

  await t.test('žádná barva mimo tokeny v pravidlech (kromě bloků s tokeny)', () => {
    const rules = css
      .replace(/:root\s*\{[^}]*\}/g, '')
      .replace(/@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme="dark"\]\)\s*\{[^}]*\}\s*\}/g, '')
      .replace(/:root\[data-theme="light"\]\s*\{[^}]*\}/g, '');
    const hardcoded = rules.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) || [];
    assert.deepEqual(hardcoded, [], 'barvy mají jít přes tokeny, jinak se světlý režim rozbije');
  });
});

// ──────────────────────────────────────────────────────────────────────
// Popup: markup a parita variant
// ──────────────────────────────────────────────────────────────────────

test('popup: markup přepínače a načítání skriptů', async (t) => {
  const html = read('Chrome/popup.html');

  await t.test('theme-init.js běží v <head> před stylem', () => {
    const head = html.slice(0, html.indexOf('</head>'));
    const init = head.indexOf('<script src="theme-init.js"></script>');
    assert.ok(init > -1, 'theme-init.js musí být v <head>');
    assert.ok(init < head.indexOf('popup.css'), 'theme-init.js musí být před popup.css');
  });

  await t.test('theme-toggle.js se načte před popup.js', () => {
    const toggle = html.indexOf('<script src="theme-toggle.js"></script>');
    assert.ok(toggle > -1 && toggle < html.indexOf('<script src="popup.js"></script>'));
  });

  await t.test('přepínač je přístupná radio skupina se třemi volbami', () => {
    assert.match(html, /id="themeSwitch" role="radiogroup" aria-label="Barevný režim"/);
    const values = [...html.matchAll(/role="radio" data-theme-value="(\w+)"/g)].map(m => m[1]);
    assert.deepEqual(values, ['auto', 'light', 'dark']);
    assert.equal((html.match(/aria-checked="true"/g) || []).length, 1, 'výchozí je právě jedna volba');
  });

  await t.test('žádný inline skript (CSP script-src \'self\')', () => {
    assert.ok(!/<script>(?!<\/script>)/.test(html) && !/<script(?![^>]*\bsrc=)[^>]*>/.test(html));
  });

  await t.test('Chrome a Firefox mají shodný popup.css, popup.html a theme-init.js', () => {
    for (const file of ['popup.css', 'popup.html', 'theme-init.js']) {
      assert.equal(read(`Firefox/${file}`), read(`Chrome/${file}`), `${file} se mezi variantami rozešel`);
    }
  });

  await t.test('theme-toggle.js se liší jen API namespacem', () => {
    const chrome = read('Chrome/theme-toggle.js');
    const firefox = read('Firefox/theme-toggle.js');
    assert.ok(!chrome.includes('browser.'), 'Chrome varianta používá chrome.*');
    assert.ok(!firefox.includes('chrome.'), 'Firefox varianta používá browser.*');
    assert.equal(firefox.replace(/browser\./g, 'chrome.'), chrome);
  });

  await t.test('popup i overlay čtou stejný klíč ve storage', () => {
    for (const variant of VARIANTS) {
      for (const file of ['theme-init.js', 'theme-toggle.js', 'content.js']) {
        assert.ok(read(`${variant}/${file}`).includes(`const THEME_STORAGE_KEY = '${THEME_STORAGE_KEY}';`),
          `${variant}/${file} musí používat klíč ${THEME_STORAGE_KEY}`);
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// Popup: chování skriptů
// ──────────────────────────────────────────────────────────────────────

test('theme-init.js aplikuje ručně zvolené téma synchronně', async (t) => {
  await t.test('uložený světlý i tmavý režim se nastaví na <html>', () => {
    for (const theme of ['light', 'dark']) {
      const dom = createPopupDom({ mirror: theme });
      dom.run('Chrome/theme-init.js');
      assert.equal(dom.root.dataset.theme, theme);
    }
  });

  await t.test('auto, nesmysl ani prázdná hodnota atribut nenastaví', () => {
    for (const mirror of [undefined, 'auto', 'neon', '']) {
      const dom = createPopupDom({ mirror });
      dom.run('Chrome/theme-init.js');
      assert.equal(dom.root.dataset.theme, undefined);
    }
  });

  await t.test('nedostupný localStorage nic neshodí', () => {
    const dom = createPopupDom({ localStorageFails: true });
    assert.doesNotThrow(() => dom.run('Chrome/theme-init.js'));
    assert.equal(dom.root.dataset.theme, undefined);
  });
});

for (const variant of VARIANTS) {
  test(`${variant}: theme-toggle.js`, async (t) => {
    const file = `${variant}/theme-toggle.js`;

    await t.test('bez uložené volby je výchozí Auto', async () => {
      const dom = createPopupDom();
      dom.run(file);
      await tick();
      assert.deepEqual(dom.checked(), ['auto']);
      assert.deepEqual(dom.tabbable(), ['auto']);
      assert.equal(dom.root.dataset.theme, undefined);
    });

    await t.test('uložená volba se načte a zrcadlí do localStorage', async () => {
      const dom = createPopupDom({ stored: 'light' });
      dom.run(file);
      await tick();
      assert.deepEqual(dom.checked(), ['light']);
      assert.equal(dom.root.dataset.theme, 'light');
      assert.equal(dom.local.get(THEME_STORAGE_KEY), 'light');
    });

    await t.test('neplatná uložená hodnota spadne na Auto', async () => {
      const dom = createPopupDom({ stored: '<script>' , mirror: 'dark' });
      dom.run(file);
      await tick();
      assert.deepEqual(dom.checked(), ['auto']);
      assert.equal(dom.root.dataset.theme, undefined);
      assert.ok(!dom.local.has(THEME_STORAGE_KEY), 'zastaralá kopie se musí smazat');
    });

    await t.test('kliknutí uloží volbu, Auto atribut i kopii odstraní', async () => {
      const dom = createPopupDom();
      dom.run(file);
      await tick();

      dom.click('dark');
      await tick();
      assert.equal(dom.root.dataset.theme, 'dark');
      assert.equal(dom.storage[THEME_STORAGE_KEY], 'dark');
      assert.equal(dom.local.get(THEME_STORAGE_KEY), 'dark');
      assert.deepEqual(dom.checked(), ['dark']);

      dom.click('auto');
      await tick();
      assert.equal(dom.root.dataset.theme, undefined);
      assert.equal(dom.storage[THEME_STORAGE_KEY], 'auto');
      assert.ok(!dom.local.has(THEME_STORAGE_KEY));
    });

    await t.test('šipky přepínají dokola a přesouvají fokus', async () => {
      const dom = createPopupDom({ stored: 'dark' });
      dom.run(file);
      await tick();

      dom.key('ArrowRight');
      assert.deepEqual(dom.checked(), ['auto']);
      assert.equal(dom.focused, 'auto');

      dom.key('ArrowLeft');
      assert.deepEqual(dom.checked(), ['dark']);

      dom.key('Enter'); // jiné klávesy volbu nemění
      assert.deepEqual(dom.checked(), ['dark']);
    });

    await t.test('nedostupné úložiště nechá přepínač fungovat', async () => {
      const dom = createPopupDom({ storageFails: true, localStorageFails: true });
      dom.run(file);
      await tick();
      assert.deepEqual(dom.checked(), ['auto']);
      dom.click('light');
      await tick();
      assert.equal(dom.root.dataset.theme, 'light');
    });
  });
}

// ──────────────────────────────────────────────────────────────────────
// Overlay
// ──────────────────────────────────────────────────────────────────────

for (const variant of VARIANTS) {
  test(`${variant}: téma overlaye`, async (t) => {
    const source = read(`${variant}/content.js`);
    const { dark, light } = loadOverlayTokens(variant);

    await t.test('obě palety mají stejné tokeny', () => {
      assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
    });

    await t.test('každý použitý token je definovaný', () => {
      const used = new Set([...source.matchAll(/var\(--boit-([\w-]+)\)/g)].map(m => m[1]));
      for (const name of used) assert.ok(name in dark, `--boit-${name} není v paletě`);
    });

    await t.test('světlá paleta platí podle prohlížeče, při ruční volbě i při tisku', () => {
      assert.ok(source.includes("'  .boit-backdrop:not([data-theme=\"dark\"]) {',"));
      assert.ok(source.includes("'.boit-backdrop[data-theme=\"light\"] {',"));
      assert.match(source, /'@media print \{',\n\s*'  \.boit-backdrop \{',\n\s*tokenDeclarations\(OVERLAY_LIGHT_TOKENS\)/);
    });

    await t.test('Odejít: tmavý zelené, světlý růžové, text čitelný', () => {
      assert.equal(dark['leave-fill'], '#D3FD22');
      assert.equal(light['leave-fill'], '#FF2D78');
      assert.ok(contrast(dark['on-leave'], dark['leave-fill']) >= 4.5);
      assert.ok(contrast(light['on-leave'], light['leave-fill']) >= 4.5);
    });

    await t.test('ve světlém režimu nejsou dvě růžová tlačítka', () => {
      assert.ok(!/C4104F|FF2D78/i.test(light['proceed-text']));
      assert.ok(!/C4104F|FF2D78/i.test(light['proceed-border']));
    });

    await t.test('text ve světlém režimu splňuje WCAG AA na kartě', () => {
      for (const name of ['text', 'text-dim', 'text-mute', 'domain', 'accent-text', 'purple', 'cyan', 'pink', 'yellow']) {
        const ratio = contrast(light[name], light.card);
        assert.ok(ratio >= 4.5, `${name}: ${ratio.toFixed(2)} < 4.5`);
      }
    });

    await t.test('neznámá nebo chybějící volba znamená Auto', async () => {
      for (const stored of [undefined, 'auto', 'neon', 42]) {
        assert.equal(await loadOverlayTheme(variant, { stored }).readThemePreference(), 'auto');
      }
      assert.equal(await loadOverlayTheme(variant, { storageFails: true }).readThemePreference(), 'auto');
      assert.equal(await loadOverlayTheme(variant, { stored: 'light' }).readThemePreference(), 'light');
    });

    await t.test('applyOverlayTheme nastaví jen povolené hodnoty', () => {
      const { applyOverlayTheme } = loadOverlayTheme(variant);
      const attrs = {};
      const backdrop = {
        setAttribute: (name, value) => { attrs[name] = value; },
        removeAttribute: (name) => { delete attrs[name]; },
      };
      applyOverlayTheme(backdrop, 'dark');
      assert.equal(attrs['data-theme'], 'dark');
      applyOverlayTheme(backdrop, '"><img>');
      assert.equal(attrs['data-theme'], undefined);
    });

    await t.test('posluchač změny tématu se při zavření overlaye odebere', () => {
      const api = variant === 'Chrome' ? 'chrome' : 'browser';
      assert.ok(source.includes(`${api}.storage.onChanged.addListener(onThemeChange);`));
      assert.ok(source.includes(`${api}.storage.onChanged.removeListener(onThemeChange);`));
    });
  });
}
