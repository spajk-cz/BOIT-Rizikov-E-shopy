# Zdroje ikon

Useknutý čtverec převzatý z písmen loga BOIT (roh useknutý o 15,25 % strany) a v něm oko.
Znak je v obou stavech stejný, stav nese barva: bezpečný web = tmavá dlaždice s neonovým
obrysem a okem, rizikový web = celá dlaždice růžová a Chrome přidá štítek „!".

| Soubor | Použití |
|---|---|
| `icon-{safe,risky}-16.svg` | 16 px v liště — pixel art kreslený po pixelech (zmenšená vektorová kresba se na 16 px slévá) |
| `icon-{safe,risky}.svg` | 32 a 48 px — kresba až k okraji |
| `icon-{safe,risky}-128.svg` | 128 px pro obchody — kresba 96 × 96 a 16 px průhledný okraj podle doporučení Chrome Web Store |

PNG v `Chrome/icons/` a `Firefox/icons/` se z těchto SVG renderují v Chromiu v přesné velikosti
(`deviceScaleFactor: 1`, průhledné pozadí). Názvy souborů se nemění, `background.js` je beze změny.
