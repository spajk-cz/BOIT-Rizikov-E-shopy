// Text varování se skládá podle zdroje shody. Testuje se SKUTEČNÝ kód z
// content.js obou variant — blok se z něj vyřízne a spustí v minimálním DOM.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { repoRoot, VARIANTS } from './harness.mjs';

/** Uzel, který umí jen to, co renderDescription potřebuje. */
class El {
  constructor(tag) { this.tag = tag; this.nodes = []; }
  set textContent(value) { this.nodes = value === '' ? [] : [{ tag: '#text', text: String(value) }]; }
  get textContent() { return this.nodes.map(n => (n.tag === '#text' ? n.text : n.textContent)).join(''); }
  appendChild(node) { this.nodes.push(node); return node; }
  /** Texty zvýrazněných částí. */
  get strongTexts() { return this.nodes.filter(n => n.tag === 'strong').map(n => n.textContent); }
}

/** Vyřízne z content.js blok s popisy a připraví renderDescription. */
function loadRenderer(variant) {
  const source = readFileSync(`${repoRoot}${variant}/content.js`, 'utf8');

  const start = source.indexOf('  const SOURCE_DESCRIPTIONS = {');
  const end = source.indexOf(`  ${variant === 'Chrome' ? 'chrome' : 'browser'}.runtime.sendMessage({ type: 'CHECK_DOMAIN'`);
  assert.ok(start > -1 && end > start, `${variant}: blok s popisy se nepodařilo najít`);

  const block = source.slice(start, end);
  const context = vm.createContext({
    document: {
      createElement: (tag) => new El(tag),
      createTextNode: (text) => ({ tag: '#text', text: String(text) }),
    },
  });
  vm.runInContext(`${block}\n;globalThis.__render = renderDescription;\n`, context, {
    filename: `${variant}/content.js (výřez)`,
  });
  return context.__render;
}

const source = (name, label) => ({ name, label });

for (const variant of VARIANTS) {
  test(`${variant}: znění varování podle zdroje`, async (t) => {
    const render = loadRenderer(variant);
    const describe = (matched) => {
      const el = new El('div');
      render(el, matched);
      return el;
    };

    await t.test('ČTÚ: faktické znění, žádný podvodný e-shop', () => {
      const el = describe([source('CTU', 'ČTÚ')]);

      assert.match(el.textContent, /^Tato stránka je uvedena na oficiálním seznamu blokovaných webů ČTÚ\./);
      assert.match(el.textContent, /nelegální nabídku léčiv/);
      assert.ok(!/podvodn/i.test(el.textContent), 'u ČTÚ se nesmí tvrdit podvod');
      assert.ok(!/rizikových e-shopů/i.test(el.textContent), 'ČTÚ není seznam rizikových e-shopů');
      assert.match(el.textContent, /nejde tedy jen o e-shopy/, 'musí být řečeno, že nejde jen o e-shopy');
      assert.deepEqual(el.strongTexts, ['ČTÚ']);
    });

    await t.test('ČOI: znění o oficiálním seznamu rizikových e-shopů', () => {
      const el = describe([source('COI', 'ČOI')]);

      assert.match(el.textContent, /oficiálním seznamu rizikových e-shopů České obchodní inspekce/);
      assert.ok(!/ČTÚ/.test(el.textContent), 'u ČOI se nesmí zmiňovat ČTÚ');
      assert.deepEqual(el.strongTexts, ['České obchodní inspekce']);
    });

    await t.test('SOI: znění o slovenském úřadu', () => {
      const el = describe([source('SOI', 'SOI')]);
      assert.match(el.textContent, /Slovenskej obchodnej inšpekcie/);
      assert.ok(!/ČTÚ/.test(el.textContent));
    });

    await t.test('BOIT: nevydává se za úřední seznam', () => {
      const el = describe([source('BOIT', 'BOIT')]);

      assert.match(el.textContent, /seznamu rizikových webů, který vede BOIT Cyber Security/);
      assert.ok(!/oficiáln/i.test(el.textContent), 'BOIT seznam není oficiální seznam úřadu');
      assert.ok(!/ČTÚ|inspekce|inšpekcie/.test(el.textContent));
    });

    await t.test('shoda ve dvou seznamech uvede oba', () => {
      const el = describe([source('CTU', 'ČTÚ'), source('BOIT', 'BOIT')]);

      assert.match(el.textContent, /blokovaných webů ČTÚ/);
      assert.match(el.textContent, /vede BOIT Cyber Security/);
      assert.deepEqual(el.strongTexts, ['ČTÚ', 'BOIT Cyber Security']);
    });

    await t.test('neznámý zdroj spadne na obecné znění se všemi seznamy', () => {
      for (const matched of [[], undefined, null, [{}], 'nesmysl']) {
        const el = describe(matched);
        assert.match(el.textContent, /na jednom ze seznamů rizikových webů/);
        assert.deepEqual(el.strongTexts, ['ČOI', 'SOI', 'ČTÚ', 'BOIT']);
      }
    });

    await t.test('upozornění na osobní údaje je vždy na konci', () => {
      for (const matched of [[source('CTU', 'ČTÚ')], [source('COI', 'ČOI')], []]) {
        assert.match(describe(matched).textContent,
          / Před zadáním osobních či platebních údajů doporučujeme zvýšenou opatrnost\.$/);
      }
    });

    await t.test('opakované vykreslení nenaskládá text dvakrát', () => {
      const el = new El('div');
      render(el, [source('CTU', 'ČTÚ')]);
      const first = el.textContent;
      render(el, [source('CTU', 'ČTÚ')]);
      assert.equal(el.textContent, first);
    });

    await t.test('pořadí je stabilní bez ohledu na pořadí shod', () => {
      const a = describe([source('BOIT', 'BOIT'), source('CTU', 'ČTÚ')]).textContent;
      const b = describe([source('CTU', 'ČTÚ'), source('BOIT', 'BOIT')]).textContent;
      assert.equal(a, b);
    });
  });
}
