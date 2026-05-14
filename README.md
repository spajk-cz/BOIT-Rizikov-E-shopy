<div align="center">

<p>
  <img src="https://lh3.googleusercontent.com/ljcAgmvfLT6gKeOU6OBVOw_YUWzP6s3M-pOJgrcx8i8KQM1d_UbZ5cO8NBHkWxwTIc535h4fKYCVbN3wlfT0WJ4k3A=s1600-w1600-h1000" alt="BOIT Rizikové E-shopy screenshot" width="100%" />
</p>

# BOIT Rizikové E-shopy

**Prohlížečové rozšíření, které vás varuje před podvodnými e-shopy ze seznamů České obchodní inspekce (ČOI) a Slovenskej obchodnej inšpekcie (SOI) — a detekuje další podezřelé signály přímo na stránce.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v1.7.0-D3FD22?style=for-the-badge&logo=googlechrome&logoColor=black)](https://chromewebstore.google.com/detail/boit-rizikov%C3%A9-e-shopy/pmjfmpoofdklhmceaadcoilkkhpmaapb)
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

**BOIT Rizikové E-shopy** v reálném čase porovnává navštívené weby s oficiálními seznamy rizikových e-shopů:

- 🇨🇿 [**Česká obchodní inspekce**](https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/) (ČOI)
- 🇸🇰 [**Slovenská obchodná inšpekcia**](https://www.soi.sk/informacie-pre-verejnost/internetove-obchody/rizikove-internetove-obchody) (SOI)

Když na takový web přijdete, obrazovka se zabluruje a uvidíte výrazné varování. Navíc rozšíření **detekuje další podvodné signály** — chybějící IČO, podezřelé TLD, jen bankovní převod, extrémní slevy a další.

> Žádné trackery. Žádná analytika. Žádná data ven. Všechno běží lokálně ve vašem prohlížeči.

***

## Co umí

### Detekce a varování
- **Kontrola proti seznamům ČOI a SOI** — porovnání domény při každé návštěvě
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

### Akce
- **Whitelist na 24 h** — pokud víte, že je web v pořádku
- **Smart nahlášení podvodu** — `.sk` doména → SOI, ostatní → ČOI (jedním klikem, předvyplněný e-mail)
- **Automatická aktualizace seznamů** — paralelně oba zdroje každých 6 hodin

### Bezpečnost a soukromí
- **Žádné trackery, žádná analytika, žádné reklamy**
- **Vše běží lokálně** — jediné síťové operace jsou stažení seznamů z `coi.gov.cz` a `soi.sk`
- **Hardened proti bypass pokusům**:
  - Closed Shadow DOM (`mode: 'closed'`) — stránka se nedostane k vnitřkům overlaye
  - MutationObserver — pokud stránka odstraní overlay, znovu se vloží
  - Blur přes injected `<style>` s `!important` — nelze přepsat z `element.style`
  - `isTrusted` validace na všech tlačítkách — synthetic clicks z page scriptu jsou ignorovány

***

## Instalace

### Z Chrome Web Store (doporučeno)

[![Get on Chrome Web Store](https://img.shields.io/badge/Get%20it%20on-Chrome%20Web%20Store-D3FD22?style=for-the-badge&logo=googlechrome&logoColor=black)](https://chromewebstore.google.com/detail/boit-rizikov%C3%A9-e-shopy/pmjfmpoofdklhmceaadcoilkkhpmaapb)

### Lokální instalace (developer mode)

```bash
git clone  https://github.com/spajk-cz/BOIT-Rizikov-E-shopy.git
```

1. Otevři `chrome://extensions/`
2. Zapni **Developer mode** (vpravo nahoře)
3. Klikni **Load unpacked**
4. Vyber složku s rozbaleným repozitářem
5. Hotovo

Funguje na všech Chromium prohlížečích — **Chrome, Edge, Brave, Vivaldi, Opera, Arc**.
Firefox verze je v plánu (Manifest V3 API se mírně liší).

***

## Pod kapotou

### Stack

- **Manifest V3** (vyžaduje Chrome 110+)
- **Vanilla JavaScript** (žádné build nástroje, žádné dependencies)
- **Service Worker** pro background tasks
- **Content Script** s isolated world + closed Shadow DOM

### Architektura

```text
boit-rizikove-eshopy/
├── manifest.json         # MV3 manifest, CSP, permissions
├── background.js         # Service worker — fetch, cache, message routing
├── content.js            # Detekce + injection overlay (hardened)
├── popup.html/css/js     # Toolbar popup UI
├── icons/                # Ikonky safe/risky × 4 velikosti
├── PRIVACY.md            # Privacy policy
└── LICENSE               # MIT
```

### Datový tok

```text
┌─────────────┐                     ┌──────────────────┐
│ coi.gov.cz  │ ──┐                 │                  │
└─────────────┘   │  fetch každých  │ background.js    │
                  ├─ 6h, paralelně ─▶│ (service worker) │
┌─────────────┐   │   Promise.all   │                  │
│  soi.sk     │ ──┘                 └────────┬─────────┘
└─────────────┘                              │ merge → chrome.storage.local
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
| `storage` | Cache seznamů ČOI/SOI, nastavení, statistiky — vše lokálně |
| `alarms` | Periodická aktualizace seznamů (6h interval) |
| `tabs` | Aktualizace ikonky a stavu pro aktivní tab |
| `host_permissions: coi.gov.cz` | Stahování oficiálního seznamu ČOI |
| `host_permissions: www.soi.sk` | Stahování oficiálního seznamu SOI |
| `content_scripts` na všech webech | Kontrola domény proti seznamům |

***

## Privacy

**Tato extension nesbírá, neukládá ani nepřenáší žádné osobní údaje.** Všechna data zůstávají v prohlížeči.

Jediné síťové operace jsou stažení seznamů domén z `coi.gov.cz` a `www.soi.sk` (každých 6 hodin) — bez cookies, bez identifikátorů (`credentials: 'omit'`).

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
- [x] **v1.7** — 🇸🇰 Slovenská obchodná inšpekcia (SOI) jako druhý zdroj dat
- [ ] **v1.8** — Detekce typosquatu (Levenshtein vůči TOP 100 CZ/SK e-shopů)
- [ ] **v1.9** — Whois lookup pro nedávno zaregistrované domény
- [ ] **v2.0** — Firefox port (Manifest V3)
- [ ] **v2.x** — Crowdsourced report API (volitelný opt-in)

***

## Changelog

### v1.7.0 (současná)
- 🇸🇰 **Přidána podpora SOI** (Slovenská obchodná inšpekcia) jako druhý zdroj dat
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
- **Zdroj dat (CZ):** [coi.gov.cz/rizikove-e-shopy](https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/)
- **Zdroj dat (SK):** [soi.sk/rizikove-internetove-obchody](https://www.soi.sk/informacie-pre-verejnost/internetove-obchody/rizikove-internetove-obchody)

***

<div align="center">

**Sdílej dál — čím víc lidí ho má, tím méně peněz teče podvodníkům.**

### \#DělámeČeskoBezpečnější

</div>