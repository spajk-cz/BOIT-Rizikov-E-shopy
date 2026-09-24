// Identita doplňku: název, hashtag, odkazy a čistě bílé okno ve světlém režimu.
// Hlídá, aby se starý název, hashtag nebo neexistující odkaz nevrátily.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { repoRoot, VARIANTS } from './harness.mjs';

const read = (relative) => readFileSync(`${repoRoot}${relative}`, 'utf8');
const manifest = (variant) => JSON.parse(read(`${variant}/manifest.json`));

const NAME = 'BOIT Rizikové weby';
const HASHTAG = '#BezpečnějšíČesko';
const RETIRED = ['BOIT Rizikové E-shopy', 'DělámeČeskoBezpečnější', 'nastroje/podvodne-weby'];

/** Všechny textové soubory ve složce varianty (bez obrázků). */
function textFiles(dir) {
  const out = [];
  for (const name of readdirSync(`${repoRoot}${dir}`)) {
    const relative = join(dir, name);
    if (statSync(`${repoRoot}${relative}`).isDirectory()) out.push(...textFiles(relative));
    else if (!/\.(png|jpe?g|gif|ico|zip)$/i.test(name)) out.push(relative);
  }
  return out;
}

for (const variant of VARIANTS) {
  test(`${variant}: identita doplňku`, async (t) => {
    await t.test('manifest nese nový název i popis', () => {
      const m = manifest(variant);
      assert.equal(m.name, NAME);
      assert.equal(m.short_name, NAME);
      assert.equal(m.action.default_title, NAME);
      assert.match(m.description, /rizikových webů/);
      assert.ok(m.description.length <= 132, 'krátký popis se musí vejít do limitu obchodů');
    });

    await t.test('popup, overlay i tooltip ikony používají nový název a hashtag', () => {
      assert.ok(read(`${variant}/popup.html`).includes(`<title>${NAME}</title>`));
      assert.ok(read(`${variant}/popup.html`).includes(HASHTAG));
      assert.ok(read(`${variant}/content.js`).includes(HASHTAG));
      assert.ok(read(`${variant}/background.js`).includes(`${NAME} — ochrana aktivní`));
    });

    await t.test('patička varování odkazuje jen na existující web', () => {
      assert.ok(read(`${variant}/content.js`).includes("'<div class=\"boit-footer-sub\">BOIT Cyber Security · boit.cz</div>',"));
    });

    await t.test('starý název, hashtag ani mrtvý odkaz nikde v balíčku', () => {
      for (const file of textFiles(variant)) {
        const src = read(file);
        for (const retired of RETIRED) assert.ok(!src.includes(retired), `${file} obsahuje „${retired}"`);
      }
    });

    await t.test('ID doplňku se přejmenováním nemění', () => {
      if (variant === 'Firefox') {
        assert.equal(manifest(variant).browser_specific_settings.gecko.id, 'rizikove-eshopy@boit.cz');
      }
    });
  });
}

test('dokumentace používá nový název a hashtag', () => {
  for (const file of ['README.md', 'NAHLASENI.md', 'PRIVACY.md']) {
    const src = read(file);
    for (const retired of RETIRED) assert.ok(!src.includes(retired), `${file} obsahuje „${retired}"`);
  }
  assert.ok(read('README.md').startsWith('<div align="center">'));
  assert.match(read('README.md'), new RegExp(`^# ${NAME}$`, 'm'));
});

test('světlý režim: okno doplňku je bílé i na rizikovém webu', () => {
  const css = read('Chrome/popup.css');
  const lightBlocks = css.match(/--risky-bg:\s*([^;]+);/g).slice(1);
  assert.equal(lightBlocks.length, 2, 'oba světlé bloky musí nastavovat --risky-bg');
  for (const declaration of lightBlocks) assert.match(declaration, /#FFFFFF/i);
});
