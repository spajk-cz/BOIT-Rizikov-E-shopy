<div align="center">

<p>
  <img src="https://lh3.googleusercontent.com/ljcAgmvfLT6gKeOU6OBVOw_YUWzP6s3M-pOJgrcx8i8KQM1d_UbZ5cO8NBHkWxwTIc535h4fKYCVbN3wlfT0WJ4k3A=s1600-w1600-h1000" alt="BOIT Rizikové E-shopy screenshot" width="100%" />
</p>

# BOIT Rizikové E-shopy

**Prohlížečové rozšíření, které vás varuje před rizikovými weby ze seznamů České obchodní inspekce (ČOI), Slovenskej obchodnej inšpekcie (SOI), Českého telekomunikačního úřadu (ČTÚ) a ze seznamu BOIT — a detekuje další podezřelé signály přímo na stránce.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v1.10.0-D3FD22?style=for-the-badge&logo=googlechrome&logoColor=black)](https://chromewebstore.google.com/detail/boit-rizikov%C3%A9-e-shopy/pmjfmpoofdklhmceaadcoilkkhpmaapb)
[![Firefox Add-on](https://img.shields.io/badge/Firefox%20Add--on-v1.10.0-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/cs/firefox/addon/boit-rizikov%C3%A9-e-shopy/)
[![License: MIT](https://img.shields.io/badge/License-MIT-FF2D78?style=for-the-badge)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-B44FE8?style=for-the-badge)](https://developer.chrome.com/docs/extensions/develop/migrate)
[![Made by BOIT](https://img.shields.io/badge/Made%20by-BOIT%20Cyber%20Security-D3FC23?style=for-the-badge)](https://boit.cz)

🇨🇿 + 🇸🇰  ·  **\#DělámeČeskoBezpečnější**

</div>

***

## Psali o nás

> **[Tento český doplněk do prohlížeče upozorní na pochybné e-shopy dříve, než přijdete o peníze](https://www.zive.cz/clanky/tento-cesky-doplnek-do-prohlizece-upozorni-na-pochybne-e-shopy-drive-nez-prijdete-o-penize/sc-3-a-240930/default.aspx)** *— Živě.cz*

***

## O co jde

Před každýma Vánocema varujeme na školeních lidi před rizikovými e-shopy. Roky jsme k tomu používali databázi ČOI + jeden starší prohlížečový doplněk — ten ale dávno není udržovaný. Tak jsme postavili nový. A od verze 1.7 podporujeme i **slovenský trh** přes seznam SOI.

**BOIT Rizikové E-shopy** v reálném čase porovnává navštívené weby se čtyřmi seznamy:

- 🇨🇿 [**Česká obchodní inspekce**](https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/) (ČOI) — oficiální seznam úřadu
- 🇸🇰 [**Slovenská obchodná inšpekcia**](https://www.soi.sk/informacie-pre-verejnost/internetove-obchody/rizikove-internetove-obchody) (SOI) — oficiální seznam úřadu
- 🏛️ [**Český telekomunikační úřad**](https://ctu.gov.cz/vyhledavaci-databaze/blokovane-weby) (ČTÚ) — oficiální seznam blokovaných webů
- 🛡️ [**BOIT seznam**](https://github.com/spajk-cz/boit-risk-feed) — vlastní seznam vedený BOIT Cyber Security

Seznam ČTÚ nejsou jen e-shopy: vedle nepovolených internetových her obsahuje i stránky
s nelegální nabídkou léčivých přípravků a další kategorie. Varování u záznamu z ČTÚ to
říká přesně, místo aby web označilo za „podvodný e-shop".

BOIT **není úřad** a jeho seznam není úřední rozhodnutí. Je to vlastní seznam, který spravujeme
veřejně v [samostatném repozitáři](https://github.com/spajk-cz/boit-risk-feed), kde je u každé
změny vidět důvod i historie. Zařazení na kterýkoli ze seznamů je varování, nikoli zákaz.

Když na takový web přijdete, obrazovka se zabluruje a uvidíte výrazné varování. Navíc rozšíření **detekuje další podvodné signály** — chybějící IČO, podezřelé TLD, jen bankovní převod, extrémní slevy a další.

***
> Žádné trackery. Žádná analytika. Žádná data ven. Všechno běží lokálně ve vašem prohlížeči.

***

## Co umí

### Detekce a varování
- **Kontrola proti seznamům ČOI, SOI, ČTÚ a BOIT** — porovnání domény při každé návštěvě, lokálně
- **Varování říká, který seznam** doménu vede — text se skládá podle skutečného zdroje shody
- **Výrazné varování** — blur stránky + neon overlay v BOIT designu
- **7 typů detekce podvodných signálů** přímo na stránce:
  - Nešifrované spojení (HTTP)
  - Chybějící IČO provozovatele
  - Chybějící kontaktní e-mail / telefon
  - Chybějící obchodní podmínky / reklamační řád
  - Podezřelá TLD (`.top`, `.xyz`, `.click`, `.shop`, …)
  - Pouze bankovní převod jako forma platby
  - Extrémní slevy (70% a víc)

### UI/UX
- **Dynamická ikonka v toolbaru** — zelená = ok, růžová s vykřičníkem = pozor
- **Počítadlo ochrany** — kolikrát vás rozšíření varovalo (anonymně, lokálně)
- **Rozbalovací detaily** — přehledné varování, podrobnosti pod „Více detailů"
- **Cyberpunk vizuál** — BOIT brand identity, JetBrains Mono, neon palette
- **Tmavý i světlý režim** — popup i varování se řídí tématem prohlížeče, v popupu jde přepnout ručně (`A` / `☀` / `☾`); při tisku varování se vždy použije světlá varianta

### Akce
- **Whitelist na 24 h** — pokud víte, že je web v pořádku
- **Nahlášení a odvolání** — jedním klikem na [stránku projektu](NAHLASENI.md) s kontaktem `doplnek@boit.cz`; odkaz je bez parametrů, kontrolovaná doména se nikam neodesílá
- **Automatická aktualizace seznamů** — paralelně všechny čtyři zdroje každých 6 hodin; výpadek jednoho zdroje nesmaže data ostatních

### Bezpečnost a soukromí
- **Žádné trackery, žádná analytika, žádné reklamy**
- **Vše běží lokálně** — jediné síťové operace jsou stažení seznamů z `coi.gov.cz`, `soi.sk`, `ctu.gov.cz` a `spajk-cz.github.io`
- **Firefox AMO „no data collected" badge** — manifest deklaruje `data_collection_permissions: ["none"]`, takže Firefox uživateli při instalaci i v `about:addons` explicitně potvrzuje, že žádná data nesbíráme
- **Hardened proti bypass pokusům**:
  - Closed Shadow DOM (`mode: 'closed'`) — stránka se nedostane k vnitřkům overlaye
  - MutationObserver — pokud stránka odstraní overlay, znovu se vloží
  - Blur přes injected `<style>` s `!important` — nelze přepsat z `element.style`
  - `isTrusted` validace na všech tlačítkách — synthetic clicks z page scriptu jsou ignorovány

***

## Instalace

### Z Chrome Web Store

[![Get on Chrome Web Store](https://img.shields.io/badge/Get%20it%20on-Chrome%20Web%20Store-D3FD22?style=for-the-badge&logo=googlechrome&logoColor=black)](https://chromewebstore.google.com/detail/boit-rizikov%C3%A9-e-shopy/pmjfmpoofdklhmceaadcoilkkhpmaapb)

Pro **Chrome, Edge, Brave, Vivaldi, Opera, Arc** a další Chromium prohlížeče.

### Z addons.mozilla.org 🦊

[![Firefox Add-on](https://img.shields.io/badge/Get%20it%20on-Firefox%20Add--ons-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white)](https://addons.mozilla.org/cs/firefox/addon/boit-rizikov%C3%A9-e-shopy/)

Pro **Firefox 140+** (desktop) a **Firefox for Android 142+**.

### Lokální instalace (developer mode)

```bash
git clone https://github.com/spajk-cz/BOIT-Rizikov-E-shopy.git
```

**Chrome / Chromium prohlížeče:**

1. Otevři `chrome://extensions/`
2. Zapni **Developer mode** (vpravo nahoře)
3. Klikni **Load unpacked**
4. Vyber složku s rozbaleným repozitářem
5. Hotovo

**Firefox:**

1. Otevři `about:debugging#/runtime/this-firefox`
2. Klikni **Load Temporary Add-on…**
3. Vyber soubor `manifest.json` v rozbaleném repozitáři
4. Doplněk poběží do restartu prohlížeče (pro permanentní instalaci je třeba signed build z AMO)

***

## Pod kapotou

### Stack

- **Manifest V3** (Chrome 110+, Firefox 140+ desktop, Firefox for Android 142+)
- **Vanilla JavaScript** (žádné build nástroje, žádné dependencies)
- **Non-persistent background script** (service worker v Chromium, event page ve Firefoxu)
- **Content Script** s isolated world + closed Shadow DOM

### Architektura

```text
boit-rizikove-eshopy/
├── manifest.json         # MV3 manifest, CSP, permissions
├── background.js         # Background — fetch, cache, message routing
├── content.js            # Detekce + injection overlay (hardened)
├── popup.html/css/js     # Toolbar popup UI
├── theme-init.js         # Ručně zvolené téma ještě před vykreslením popupu
├── theme-toggle.js       # Přepínač Auto / Světlý / Tmavý
├── icons/                # Ikonky safe/risky × 4 velikosti
├── PRIVACY.md            # Privacy policy
└── LICENSE               # MIT

NAHLASENI.md              # Kontakt pro nahlášení domény i žádost o vyřazení

tests/                    # Node testy obou variant (background, texty varování, téma)
docs/                     # Testovací protokol
```

### Zdroje dat a cache

Každý zdroj má vlastní cache (`boit_source_cache`) s posledním platným seznamem a časem
posledního **úspěšného** načtení. Po každé obnově se sloučený seznam skládá znovu z těchto
per-source cache do původního klíče `boit_rizikove_domains`, takže:

- výpadek jednoho zdroje nesmaže data ostatních a nepřepíše jejich datum úspěchu,
- doména odebraná z BOIT feedu po úspěšné obnově zmizí — pokud ji neuvádí jiný zdroj,
- ruční obnova nikdy nemaže cache předem; když selžou všechny zdroje, data zůstanou
  a popup to označí jako částečnou obnovu, ne jako úspěch.

Seznam ČTÚ se stahuje jako CSV. Berou se jen záznamy s prázdným `DATUM_VYMAZU` a hostname
se z hodnoty tahá přes `URL()`, ne řetězcovými operacemi. Záznam mířící na konkrétní stránku
se **přeskočí** — jeden blokovaný článek nesmí označit celý jinak legitimní web. Rozbité CSV
(chybějící sloupce, HTML místo dat) se odmítne celé a zůstane poslední funkční seznam.

BOIT feed se čte přísným parserem podle pevného kontraktu (povinná hlavička
`# BOIT risk feed v1`, jedna doména na řádek, žádné URL, porty, wildcardy ani IP adresy).
Při jakémkoli neplatném řádku se odmítne celá odpověď a použije se poslední funkční cache.
Hlavička bez domén je naopak platná prázdná aktualizace. Formát a validátor jsou popsané
v repozitáři [boit-risk-feed](https://github.com/spajk-cz/boit-risk-feed).

### Testy

```bash
node --test tests/*.test.mjs
```

Testy načítají skutečné `Chrome/background.js` i `Firefox/background.js` do `node:vm`
s namockovaným `chrome`/`browser` API, fetchem, storage, časem a alarmy — netestují
přepsané kopie. Testy tématu spouští skutečné skripty popupu v minimálním DOM a hlídají,
že světlá paleta pokrývá všechny tokeny a splňuje kontrast WCAG AA. Žádné runtime
závislosti, stačí Node.

### Datový tok

```text
┌─────────────┐                     ┌──────────────────┐
│ coi.gov.cz  │ ──┐                 │                  │
└─────────────┘   │                 │ background.js    │
┌─────────────┐   │  fetch každých  │ (event page /    │
│  soi.sk     │ ──┼─ 6h,paralelně ─▶│  service worker) │
└─────────────┘   │   Promise.all   │                  │
┌─────────────┐   │                 └────────┬─────────┘
│ ctu.gov.cz  │ ──┤                          │ per-source cache
└─────────────┘   │                          │ → merge → storage.local
┌─────────────┐   │                          │
│ BOIT feed   │ ──┘                          │
                                             ▼
┌─────────────┐  CHECK_DOMAIN       ┌──────────────────┐
│ content.js  │ ──────────────────▶ │ message handler  │
│ (každý web) │ ◀────────────────── │ → cached domains │
└──────┬──────┘   isRisky?          └──────────────────┘
       │
       ▼ injectWarning() — closed shadow DOM + MutationObserver
   ┌─────────────────┐
   │ varovný overlay │
   └─────────────────┘
```

### Permissions

| Permission | Důvod |
|---|---|
| `storage` | Cache seznamů, nastavení (včetně barevného režimu), statistiky — vše lokálně |
| `alarms` | Periodická aktualizace seznamů (6h interval) |
| `tabs` | Aktualizace ikonky a stavu pro aktivní tab |
| `host_permissions: coi.gov.cz` | Stahování oficiálního seznamu ČOI |
| `host_permissions: www.soi.sk` | Stahování oficiálního seznamu SOI |
| `host_permissions: ctu.gov.cz` | Stahování seznamu blokovaných webů ČTÚ |
| `host_permissions: spajk-cz.github.io` | Stahování BOIT seznamu (GitHub Pages) |
| `content_scripts` na všech webech | Kontrola domény proti seznamům |

***

## Privacy

**Tato extension nesbírá, neukládá ani nepřenáší žádné osobní údaje.** Všechna data zůstávají v prohlížeči.

Jediné síťové operace jsou stažení seznamů domén z `coi.gov.cz`, `www.soi.sk`, `ctu.gov.cz` a `spajk-cz.github.io` (každých 6 hodin) — bez cookies, bez identifikátorů (`credentials: 'omit'`). Stahuje se vždy celý seznam, nikdy se neposílá dotaz na konkrétní navštívenou doménu.

Plné znění viz [`PRIVACY.md`](PRIVACY.md).

***

## Contributing

PRs welcome! Pár pravidel:

- **Bezpečnost před features** — žádný kód co by snížil hardening overlaye
- **Žádné runtime dependencies** — vanilla JS, žádné npm balíčky v extension build
- **Test bypass scénářů** — pokud měníš overlay, zkus si pustit `bypass-test.js`

Issues a feature requesty vítány. Zvlášť pokud najdete:
- Bypass overlaye, kterou jsme nezachytili
- False-positive na legitimním e-shopu
- Chybu v parseru ČOI / SOI seznamu

***

## Roadmap

- [x] **v1.0** — MVP: detekce + overlay
- [x] **v1.5** — Heatmap signálů, počítadlo, report tlačítko
- [x] **v1.6** — Closed Shadow DOM hardening
- [x] **v1.7** — 🇸🇰 SOI integrace + 🦊 Firefox / Firefox for Android port (Manifest V3)
- [x] **v1.8** — 🛡️ Vlastní BOIT seznam jako třetí zdroj + odolná per-source cache
- [x] **v1.9** — 🏛️ Seznam blokovaných webů ČTÚ jako čtvrtý zdroj
- [x] **v1.10** — 🌗 Tmavý a světlý režim podle prohlížeče + ruční přepínač
- [ ] **v2.0** — Detekce typosquatu (Levenshtein vůči TOP 100 CZ/SK e-shopů)
- [ ] **v2.1** — Whois lookup pro nedávno zaregistrované domény
- [ ] **v2.2** — Crowdsourced report API (volitelný opt-in)

***

## Changelog

### v1.10.0 (současná)
- 🌗 **Tmavý a světlý režim** — popup i varovací overlay se řídí tématem prohlížeče (`prefers-color-scheme`)
- 🎚️ **Přepínač v hlavičce popupu** `A | ☀ | ☾` — Auto podle prohlížeče, nebo ručně světlý či tmavý; volba platí i pro overlay a projeví se na otevřeném varování okamžitě
- ♿ Přepínač je přístupná radio skupina (ovládání šipkami, `aria-checked`); ručně zvolené téma při otevření popupu neproblikne
- 🎨 Světlá paleta splňuje kontrast WCAG AA — neonová zelená se v textu nahrazuje zvýrazňovačem, tlačítko „Odejít" je ve světlém režimu růžové
- 🖨️ Při tisku stránky s varováním se vždy použije světlá varianta
- 🔒 Hardening overlaye beze změny (closed Shadow DOM, MutationObserver, `isTrusted`); žádná nová oprávnění

### v1.9.0
- 🏛️ **Přidán seznam blokovaných webů ČTÚ** jako čtvrtý zdroj — nepovolené internetové hry, nelegální nabídka léčiv a další kategorie
- 🔒 CSV parser bez závislostí; hostname se tahá přes `URL()`, záznam s konkrétní cestou se přeskočí, aby jeden blokovaný článek neoznačil celý legitimní web
- ✍️ **Text varování se skládá podle zdroje shody** — u záznamu z ČTÚ se místo „podvodný e-shop" uvádí, že jde o oficiální seznam blokovaných webů ČTÚ
- ⚡ Porovnání domény přes `Set` a nadřazené domény místo průchodu celým seznamem; seznam je po přidání ČTÚ řádově větší
- 📈 Strop na jeden zdroj zvednut z 5 000 na 20 000 domén; BOIT feed si drží vlastní limit 5 000 podle svého kontraktu

### v1.8.0
- 🛡️ **Přidán BOIT seznam** jako třetí zdroj dat — vlastní feed spravovaný veřejně v repozitáři [boit-risk-feed](https://github.com/spajk-cz/boit-risk-feed)
- 🔒 Přísný parser feedu s pevným datovým kontraktem: chybný obsah odmítne celou odpověď místo tichého „opravování"
- 💾 **Per-source cache** — výpadek jednoho zdroje už nesmaže data ostatních; ruční obnova nemaže cache předem
- ♻️ Doména odebraná z BOIT feedu po úspěšné obnově zmizí, pokud ji neuvádí ČOI ani SOI
- 📊 Popup rozliší **částečnou obnovu** od plného úspěchu a ukáže, který zdroj se nenačetl
- 🔧 Opraveno tiché oříznutí sloučeného seznamu na 5 000 položek, kvůli kterému mohl třetí zdroj celý vypadnout
- ⚑ **Tlačítko „Nahlásit" už neposílá mailto na ČOI/SOI** — otevře [stránku projektu](NAHLASENI.md) s kontaktem `doplnek@boit.cz` pro nahlášení domény i pro žádost o vyřazení; odkaz je bez parametrů, takže se kontrolovaná doména nikam neodesílá
- ✍️ Texty varování už netvrdí, že jde vždy o „oficiální seznam" nebo o neověřitelného provozovatele — platí i pro doménu nalezenou jen v BOIT seznamu
- ✅ Node testy background skriptů obou variant (bez runtime závislostí)

### v1.7.0
- 🇸🇰 **Přidána podpora SOI** (Slovenská obchodná inšpekcia) jako druhý zdroj dat
- 🦊 **Firefox port** — doplněk dostupný i pro Firefox 140+ (desktop) a Firefox for Android 142+
- 🔒 Firefox manifest deklaruje `data_collection_permissions: ["none"]` — explicitní "no data collected" badge v installeru
- 🔧 Refactored parser: nová strategie pro `<a>` link strukturu (SOI), multi-domain split po čárkách
- 🎯 Smart routing nahlášení podvodu: `.sk` → SOI, ostatní → ČOI
- 🎨 Popup UI: dva oddělené odkazy pro ČOI (CZ) a SOI (SK)

### v1.6.x
- Closed Shadow DOM hardening + MutationObserver
- Blur přes injected `<style>` s `!important`
- `isTrusted` validace na tlačítkách

### v1.5.x
- Heatmap rizikových signálů (7 typů detekce)
- Počítadlo "BOIT tě ochránil ×"
- Report tlačítko s předvyplněným e-mailem

***

## Tým

Vytvořeno v [BOIT Cyber Security s.r.o.](https://boit.cz) — etický hacking, penetrační testy, sociální inženýrství, školení.

**Hlavní autor:** Pavel „Spajk" Matějíček ([LinkedIn](https://www.linkedin.com/in/spajk/) · [spajk.cz](https://spajk.cz))

Posloucháte podcast **„Místo kyberčinu"** od O2? My ho děláme.

***

## License

MIT — viz [`LICENSE`](LICENSE).

To znamená: použij, fork, modifikuj, prodávej. Jen na nás laskavě nezapomeň.

***

## Links

- **Web:** [boit.cz](https://boit.cz)
- **Další BOIT nástroje:** [boit.cz/nastroje](https://boit.cz/nastroje)
- **LinkedIn:** [BOIT Cyber Security](https://www.linkedin.com/company/boit-cz/)
- **Kontakt:** [info@boit.cz](mailto:info@boit.cz)
- **Nahlášení domény / žádost o vyřazení:** [doplnek@boit.cz](mailto:doplnek@boit.cz) · [NAHLASENI.md](NAHLASENI.md)
- **Zdroj dat (CZ):** [coi.gov.cz/rizikove-e-shopy](https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/)
- **Zdroj dat (SK):** [soi.sk/rizikove-internetove-obchody](https://www.soi.sk/informacie-pre-verejnost/internetove-obchody/rizikove-internetove-obchody)
- **Zdroj dat (ČTÚ):** [ctu.gov.cz/blokovane-weby](https://ctu.gov.cz/vyhledavaci-databaze/blokovane-weby)
- **Zdroj dat (BOIT):** [boit-risk-feed](https://github.com/spajk-cz/boit-risk-feed) · [blacklist.txt](https://spajk-cz.github.io/boit-risk-feed/blacklist.txt)

***

<div align="center">

**Sdílej dál — čím víc lidí ho má, tím méně peněz teče podvodníkům.**

### \#DělámeČeskoBezpečnější

</div>