<div align="center">

# 🛡️ BOIT Rizikové E-shopy

**Chrome rozšíření, které vás varuje před podvodnými e-shopy ze seznamu České obchodní inspekce — a detekuje další podvodné signály přímo na stránce.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v1.6.3-D3FD22?style=for-the-badge&logo=googlechrome&logoColor=black)](https://chromewebstore.google.com/detail/boit-rizikov%C3%A9-e-shopy/pmjfmpoofdklhmceaadcoilkkhpmaapb)
[![License: MIT](https://img.shields.io/badge/License-MIT-FF2D78?style=for-the-badge)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-B44FE8?style=for-the-badge)](https://developer.chrome.com/docs/extensions/develop/migrate)
[![Made by BOIT](https://img.shields.io/badge/Made%20by-BOIT%20Cyber%20Security-D3FC23?style=for-the-badge)](https://boit.cz)

### \#DělámeČeskoBezpečnější

</div>

---

## 🎯 O co jde

Před každýma Vánocema varujeme na školeních lidi před rizikovými e-shopy. Roky jsme k tomu používali databázi ČOI + jeden starší prohlížečový doplněk — ten ale dávno není udržovaný. Tak jsme postavili nový.

**BOIT Rizikové E-shopy** v reálném čase porovnává navštívené weby s [oficiálním seznamem rizikových e-shopů České obchodní inspekce](https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/). Když na takový web přijdete, obrazovka se zabluruje a uvidíte výrazné varování. Plus k tomu navíc **detekuje další podvodné signály** — chybějící IČO, podezřelé TLD, jen bankovní převod, extrémní slevy a další.

> Žádné trackery. Žádná analytika. Žádná data ven. Všechno běží lokálně ve vašem prohlížeči.

---

## ✨ Co umí

### 🔍 Detekce a varování
- 🛑 **Kontrola proti seznamu ČOI** — porovnání domény při každé návštěvě
- ⚡ **Výrazné varování** — blur stránky + neon overlay v BOIT designu
- 🎯 **7 typů detekce podvodných signálů** přímo na stránce:
  - Nešifrované spojení (HTTP)
  - Chybějící IČO provozovatele
  - Chybějící kontaktní e-mail / telefon
  - Chybějící obchodní podmínky / reklamační řád
  - Podezřelá TLD (`.top`, `.xyz`, `.click`, …)
  - Pouze bankovní převod jako forma platby
  - Extrémní slevy (70 % a víc)

### 🎨 UI/UX
- 🟢 **Dynamická ikonka v toolbaru** — zelená = ok, růžová s vykřičníkem = pozor
- 📊 **Počítadlo ochrany** — kolikrát vás rozšíření varovalo (anonymně, lokálně)
- 📂 **Rozbalovací detaily** — přehledné varování, podrobnosti pod „Více detailů"
- 🎭 **Cyberpunk vizuál** — BOIT brand identity, JetBrains Mono, neon palette

### 🛠️ Akce
- ⏸️ **Whitelist na 24 h** — pokud víte, že je web v pořádku
- 📧 **Nahlášení ČOI jedním klikem** — předvyplněný e-mail s detekovanými signály
- 🔄 **Automatická aktualizace seznamu** — každých 6 hodin

### 🔒 Bezpečnost a soukromí
- 🚫 **Žádné trackery, žádná analytika, žádné reklamy**
- 🏠 **Vše běží lokálně** — jediná síťová operace je stažení seznamu z `coi.gov.cz`
- 🛡️ **Hardened proti bypass pokusům**:
  - Closed Shadow DOM (`mode: 'closed'`) — stránka se nedostane k vnitřkům overlaye
  - MutationObserver — pokud stránka odstraní overlay, znovu se vloží
  - Blur přes injected `<style>` s `!important` — nelze přepsat z `element.style`
  - `isTrusted` validace na všech tlačítkách — synthetic clicks z page scriptu jsou ignorovány

---

## 📦 Instalace

### Z Chrome Web Store (doporučeno)

[![Get on Chrome Web Store](https://img.shields.io/badge/Get%20it%20on-Chrome%20Web%20Store-D3FD22?style=for-the-badge&logo=googlechrome&logoColor=black)](https://chromewebstore.google.com/detail/boit-rizikov%C3%A9-e-shopy/pmjfmpoofdklhmceaadcoilkkhpmaapb)

### Lokální instalace (developer mode)

```bash
git clone https://github.com/BOITCyberSecurity/rizikove-eshopy.git
```

1. Otevři `chrome://extensions/`
2. Zapni **Developer mode** (vpravo nahoře)
3. Klikni **Load unpacked**
4. Vyber složku s rozbaleným repozitářem
5. Hotovo ✓

Funguje na všech Chromium prohlížečích — **Chrome, Edge, Brave, Vivaldi, Opera, Arc**.
Firefox verze je v plánu (Manifest V3 API se mírně liší).

---

## 🏗️ Pod kapotou

### Stack

- **Manifest V3** (vyžaduje Chrome 110+)
- **Vanilla JavaScript** (žádné build nástroje, žádné dependencies)
- **Service Worker** pro background tasks
- **Content Script** s isolated world

### Architektura

```
boit-rizikove-eshopy/
├── manifest.json         # MV3 manifest, CSP, permissions
├── background.js         # Service worker — fetch, cache, message routing
├── content.js            # Detekce + injection overlay
├── popup.html/css/js     # Toolbar popup UI
├── icons/                # Ikonky safe/risky × 4 velikosti
├── PRIVACY.md            # Privacy policy
└── LICENSE               # MIT
```

### Datový tok

```
┌─────────────┐  fetch každých 6h   ┌──────────────────┐
│ coi.gov.cz  │ ◀────────────────── │ background.js    │
└─────────────┘                     │ (service worker) │
                                    └────────┬─────────┘
                                             │ chrome.storage.local
                                             ▼
┌─────────────┐  CHECK_DOMAIN       ┌──────────────────┐
│ content.js  │ ──────────────────▶ │ message handler  │
│ (každý web) │ ◀────────────────── │ → cached domains │
└──────┬──────┘   isRisky?          └──────────────────┘
       │
       ▼ injectWarning() v shadow DOM
   ┌─────────────────┐
   │ varovný overlay │
   └─────────────────┘
```

### Permissions

| Permission | Důvod |
|---|---|
| `storage` | Cache seznamu ČOI, nastavení, statistiky — vše lokálně |
| `alarms` | Periodická aktualizace seznamu (6h interval) |
| `tabs` | Aktualizace ikonky a stavu pro aktivní tab |
| `host_permissions: coi.gov.cz` | Stahování oficiálního seznamu |
| `content_scripts` na všech webech | Kontrola domény proti seznamu |

---

## 🔐 Privacy

**Tato extension nesbírá, neukládá ani nepřenáší žádné osobní údaje.** Všechna data zůstávají v prohlížeči.

Jediná síťová operace je stažení seznamu domén z `coi.gov.cz` (každých 6 hodin) — bez cookies, bez identifikátorů (`credentials: 'omit'`).

Plné znění viz [`PRIVACY.md`](PRIVACY.md).

---

## 🧪 Bypass test suite

Chcete si ověřit, že hardening funguje? V repozitáři je `bypass-test.js` — open-source test suite, kterou si můžete pustit v konzoli na rizikovém e-shopu. Otestuje 7 různých pokusů obejít overlay (smazání hostu, blur reset, querySelector na tlačítka, syntetické clicky atd.). Všechny by měly selhat.

```js
// V konzoli na stránce s overlay
fetch('https://raw.githubusercontent.com/.../bypass-test.js')
  .then(r => r.text())
  .then(eval);
```

---

## 🤝 Contributing

PRs welcome! Pár pravidel:

- 🔒 **Bezpečnost před features** — žádný kód co by snížil hardening overlaye
- 🎨 **BOIT design system** — drž se palety (`#D3FD22`, `#FF2D78`, `#B44FE8`, `#00F5FF`) a typografie (JetBrains Mono)
- 📦 **Žádné runtime dependencies** — vanilla JS, žádné npm balíčky v extension build
- 🧪 **Test bypass scénářů** — pokud měníš overlay, zkus si pustit `bypass-test.js`

Issues a feature requesty vítány. Zvlášť pokud najdete:
- Bypass overlaye, kterou jsme nezachytili
- False-positive na legitimním e-shopu
- Chybu v parseru ČOI seznamu

---

## 🗺️ Roadmap

- [x] v1.0 — MVP: detekce + overlay
- [x] v1.5 — Heatmap signálů, počítadlo, report tlačítko
- [x] v1.6 — Closed Shadow DOM hardening
- [ ] v1.7 — Detekce typosquatu (Levenshtein vůči TOP 100 CZ e-shopů)
- [ ] v1.8 — Whois lookup pro nedávno zaregistrované domény
- [ ] v2.0 — Firefox port (Manifest V3)
- [ ] v2.x — Crowdsourced report API (volitelný opt-in)

---

## 👥 Tým

Vytvořeno v [BOIT Cyber Security s.r.o.](https://boit.cz) — etický hacking, penetrační testy, sociální inženýrství, školení.

**Hlavní autor:** Pavel „Spajk" Matějíček ([LinkedIn](https://www.linkedin.com/in/spajk/) · [spajk.cz](https://spajk.cz))

Posloucháte podcast **„Místo kyberčinu"** od O2? My ho děláme. 🎙️

---

## 📜 License

MIT — viz [`LICENSE`](LICENSE).

To znamená: použij, fork, modifikuj, prodávej. Jen na nás laskavě nezapomeň. 🤝

---

## 🌐 Links

- 🌍 **Web:** [boit.cz](https://boit.cz)
- 🛠️ **Další BOIT nástroje:** [boit.cz/nastroje](https://boit.cz/nastroje)
- 🐦 **LinkedIn:** [BOIT Cyber Security](https://www.linkedin.com/company/boit-cyber-security/)
- 📧 **Kontakt:** info@boit.cz
- 🛡️ **Zdroj dat:** [coi.gov.cz/rizikove-e-shopy](https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/)

---

<div align="center">

**Sdílej dál — čím víc lidí ho má, tím méně peněz teče podvodníkům.**

### \#DělámeČeskoBezpečnější

</div>
