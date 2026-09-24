# Testovací protokol — BOIT Rizikové weby (v1.11.0)

Datum: 24. 9. 2026 · větev `main`, commit `1e334dd` · Node v22.22.2 · git 2.43.0 ·
Chromium 141.0.7390.37 (Playwright 1.63.0) · web-ext 10.7.0

Rozlišení stavů v tomto protokolu:
**PROŠLO** = spuštěno a prošlo · **SELHALO** = spuštěno a selhalo · **NEPROVEDENO** = neběželo.

Předchozí verze protokolu (v1.9.0 z 5. 9. 2026, v1.10.0 z 24. 9. 2026) jsou v historii
gitu. Výsledky ověření produkčních zdrojů z 5. 9. jsou níže převzaté a označené datem.

---

## Co se změnilo

### v1.11.0 proti 1.10.0

| Oblast | Změna |
|---|---|
| Název | **BOIT Rizikové weby** (dřív BOIT Rizikové E-shopy) v manifestu, titulku, tooltipu ikony a dokumentaci; krátký popis mluví o rizikových webech. Gecko ID `rizikove-eshopy@boit.cz` beze změny |
| Ikony | oko v useknutém čtverci z loga BOIT; 16 px jako pixel art, 128 px s okrajem pro obchody; zdroje v `design/icons` |
| Popup | ve světlém režimu čistě bílé okno i na rizikovém webu (`--risky-bg` `#FFFFFF`) |
| Overlay | z patičky odstraněn odkaz na neexistující `boit.cz/nastroje/podvodne-weby` |
| Hashtag | `#BezpečnějšíČesko` místo `#DělámeČeskoBezpečnější` |
| `background.js` | jen komentář a text tooltipu ikony; logika stahování beze změny |
| Oprávnění a CSP | **beze změny** |

### v1.10.0 proti 1.9.0

| Oblast | Změna |
|---|---|
| Popup | Barvy přes tokeny, světlá paleta, přepínač `A \| ☀ \| ☾`, nové `theme-init.js` a `theme-toggle.js` |
| Overlay (`content.js`) | Barvy přes tokeny `--boit-*`, světlá a tisková varianta, načtení volby ze `storage.local`, živá změna tématu |
| `background.js` | **beze změny** (prázdný diff proti 1.9.0 v obou variantách) |
| Oprávnění a CSP | **beze změny** — žádná nová permission, `script-src 'self'` zůstává |
| Úložiště | nový klíč `boit_ui_theme` v `storage.local` (`auto` / `light` / `dark`), kopie v `localStorage` popupu |

---

## Automatické testy

```bash
node --test tests/*.test.mjs
```

**PROŠLO — 411 testů, 0 selhání** (v1.10.0: 385, v1.9.0: 331). Nových 26 testů je v
`tests/branding.test.mjs` (identita a ikony), 54 testů tématu v `tests/theme.test.mjs`.

Testy načítají skutečné skripty obou variant do `node:vm` — background s
namockovaným `chrome`/`browser` API, fetchem, `storage.local`, časem a alarmy;
skripty popupu (`theme-init.js`, `theme-toggle.js`) v minimálním DOM stubu;
z `content.js` se vyřezávají jen potřebné bloky (znění varování, palety overlaye,
čtení tématu). Netestují se přepsané kopie funkcí.

Že testy identity opravdu hlídají, bylo ověřeno obráceně: na kopii se starým hashtagem
v `content.js` a růžovým `--risky-bg` ve Firefox `popup.css` selhaly odpovídající testy.
Stejně i u testů tématu: na kopii kódu se
záměrně rozjetým světlým blokem v `popup.css`, natvrdo zadanou barvou v pravidle
a zeleným tlačítkem „Odejít" ve světlém overlayi **selhaly** přesně odpovídající
testy.

### Co je pokryté

| Oblast | Případy |
|---|---|
| Identita | nový název v `name`, `short_name`, `default_title`, titulku popupu i tooltipu ikony; popis o rizikových webech a do 132 znaků; hashtag v popupu i overlayi; patička varování jen s `boit.cz`; **nikde** v balíčcích ani v README/NAHLASENI/PRIVACY starý název, hashtag či mrtvý odkaz; gecko ID beze změny |
| Ikony | všech 8 PNG má správné rozměry, Chrome a Firefox mají bajtově shodné ikony, zdrojová SVG existují, cesty z manifestu vedou na existující soubory |
| Světlý popup | oba světlé bloky nastavují `--risky-bg` na `#FFFFFF` |
| Téma — popup CSS | světlý blok podle prohlížeče a ruční světlý blok jsou shodné, světlý režim přepisuje každý tematický token, `color-scheme` v obou režimech, žádná barva mimo tokeny v pravidlech, neon `#D3FD22` se ve světlém režimu nepoužívá jako barva textu (zůstává ve zvýrazňovači) |
| Téma — kontrast | všechen text světlého popupu ≥ 4.5:1 na `--bg` i `--bg-2`, text na zelené výplni v obou režimech, všechen text světlého overlaye ≥ 4.5:1 na kartě, text tlačítka „Odejít" v obou režimech |
| Téma — markup | `theme-init.js` v `<head>` před `popup.css`, `theme-toggle.js` před `popup.js`, radio skupina se třemi volbami a právě jednou zaškrtnutou, žádný inline skript (CSP) |
| Téma — parita | `popup.css`, `popup.html`, `theme-init.js` shodné mezi Chrome a Firefox, `theme-toggle.js` se liší jen API namespacem, popup i overlay čtou stejný klíč `boit_ui_theme` |
| Téma — `theme-init.js` | uložený světlý/tmavý se nastaví synchronně, `auto`/nesmysl/prázdné atribut nenastaví, nedostupný `localStorage` nic neshodí |
| Téma — `theme-toggle.js` (obě varianty) | výchozí Auto, načtení uložené volby a zrcadlení do `localStorage`, neplatná hodnota spadne na Auto a smaže zastaralou kopii, kliknutí ukládá a Auto atribut i kopii odstraní, šipky přepínají dokola a přesouvají fokus, jiné klávesy nic nemění, nedostupné úložiště nechá přepínač fungovat |
| Téma — overlay (obě varianty) | obě palety mají stejné tokeny, každý použitý `var(--boit-*)` je definovaný, světlá paleta platí podle prohlížeče / při ruční volbě / při tisku, „Odejít" tmavě zelené a světle růžové, ve světlém režimu nejsou dvě růžová tlačítka, neznámá volba i chyba storage znamená Auto, `applyOverlayTheme` nastaví jen povolené hodnoty, posluchač změny tématu se při zavření odebere |
| Platný BOIT feed | běžný seznam, samotná hlavička (prázdná aktualizace), CRLF, UTF-8 BOM, komentáře, prázdné řádky, punycode, subdomény, deduplikace, doména ze safelistu |
| Odmítnutí feedu | chybějící hlavička, prázdný soubor, HTML chybová stránka, jiná verze hlavičky, 16 tříd neplatných řádků, překročení 5 000 domén |
| ČTÚ CSV | platné vstupy (fixture, `DATUM_VYMAZU`, schéma, `www.`, IDN, CRLF, BOM, pořadí sloupců, uvozovky), přeskočené záznamy (cesta, query, fragment, `javascript:`, credentials, IP), odmítnutí celého CSV |
| Zdroje, cache a matching | čtyři zdroje, zdroj shody, výpadky jednotlivých i všech zdrojů, migrace ze starší cache, odebrání domény, limity, TTL a alarmy, `Set` matching, HTML parsery ČOI/SOI |
| Znění varování | ČTÚ faktické znění, ČOI/SOI znění o úřadu, BOIT netvrdí „oficiální", shoda ve dvou seznamech, obecný fallback, upozornění na osobní údaje na konci, stabilní pořadí |
| Whitelist a nahlášení | trvalé i 24h povolení, `OPEN_REPORT_PAGE` na pevnou URL bez parametrů, kontakt v `NAHLASENI.md`, žádné `mailto:` na úřady |
| Manifesty a verze | MV3, host permissions a `connect-src` pro každý zdroj, žádné wildcardy, žádná nová permission, `script-src 'self'`, gecko ID beze změny, shoda verze v obou manifestech i v patičkách popupu a overlaye |

## Statická kontrola

| Kontrola | Příkaz | Výsledek |
|---|---|---|
| Syntax JS | `node --check` na všechny `.js` obou variant | **PROŠLO** |
| Validita JSON | `JSON.parse` obou manifestů | **PROŠLO** — verze 1.11.0, MV3 |
| Whitespace | `git diff --check` commitů `8bc3028` a `1e334dd` | **PROŠLO** |
| `web-ext lint` — zdroj | `npx web-ext lint --source-dir Firefox` | **PROŠLO** — 0 errors, 0 notices, 0 warnings |
| `web-ext lint` — balíček | `web-ext lint` nad rozbaleným Firefox ZIPem | **PROŠLO** — 0 errors, 0 notices, 0 warnings |

## Balíčky pro obchody

Sestavené přes `git archive` přímo z commitu (ne ze složky na disku), takže
obsahují jen zacommitované soubory. Výstup je v `dist/`, který do gitu nepatří.

```bash
git archive --format=zip -9 -o dist/boit-rizikove-weby-chrome-1.11.0.zip  HEAD:Chrome
git archive --format=zip -9 -o dist/boit-rizikove-weby-firefox-1.11.0.zip HEAD:Firefox
```

| Balíček | Velikost | SHA-256 |
|---|---|---|
| `boit-rizikove-weby-chrome-1.11.0.zip` | 42 141 B | `5be694cfcba90876efb5cf13eee1222c7f586a409fcf107f011dbf87ed76fc5f` |
| `boit-rizikove-weby-firefox-1.11.0.zip` | 49 383 B | `0c377f019c2615bf78177a9d022e7193584c0f6e1f6edbbc557dfc5924dc7270` |

| Kontrola | Výsledek |
|---|---|
| `manifest.json` v kořeni, verze 1.11.0 | **PROŠLO** (oba) |
| Obsah rozbaleného ZIPu je bajtově shodný se složkou v commitu (`diff -r`) | **PROŠLO** (oba) |
| Obsahuje `theme-init.js`, `theme-toggle.js` a nové ikony | **PROŠLO** (oba) |
| Bez `tests/`, `design/`, `.git`, `.DS_Store`, `node_modules` i bez druhého prohlížeče | **PROŠLO** (oba) |

Commit s tímto protokolem mění jen `docs/`; strom `Chrome/` a `Firefox/` je
shodný s `1e334dd`, takže balíčky platí i pro něj.

## End-to-end v nainstalovaném rozšíření (Chromium)

Rozbalený **Chrome ZIP** (ne pracovní složka) načtený jako unpacked extension
do čistého profilu Chromia 141 v headless režimu. Fixture doména
`boit-fixture-test.shop` byla nasazena jen do `storage.local` testovacího profilu
a obsloužena lokálně přes `page.route` — na žádný skutečný web se nechodilo a do
veřejného feedu se nic nezapisovalo. Úvodní obnova seznamů po instalaci skončila
jako částečná (zdroje v sandboxu nedostupné), což test neovlivňuje.

Popup byl otevřený jako stránka rozšíření v záložce (`chrome-extension://…/popup.html`),
ne kliknutím na ikonu v liště — viz manuální checklist.

| # | Kontrola | Výsledek |
|---|---|---|
| 1 | Rozšíření se nainstaluje, service worker běží | **PROŠLO** |
| 1a | `getManifest()`: název „BOIT Rizikové weby", titulek akce i verze 1.11.0 | **PROŠLO** |
| 1b | Nové ikony (16 a 128 px, oba stavy) se z balíčku načtou | **PROŠLO** |
| 2 | Popup bez uložené volby: Auto, světlý systém → světlé pozadí | **PROŠLO** |
| 3 | Auto živě reaguje na přepnutí systému do tmavého | **PROŠLO** |
| 4 | Klik na ☀ uloží `boit_ui_theme: "light"` do `storage.local` | **PROŠLO** |
| 5 | Ruční světlý přebije tmavý systém | **PROŠLO** |
| 6 | Kopie volby v `localStorage` popupu | **PROŠLO** |
| 7 | Po znovuotevření je téma na `<html>` už při parsování (bez probliknutí) | **PROŠLO** |
| 8 | Šipka vpravo z ☀ přepne na ☾ a uloží | **PROŠLO** |
| 9 | Content script vloží varování na fixture doméně | **PROŠLO** |
| 9a | Světlý režim + rizikový stav → pozadí okna `rgb(255, 255, 255)` | **PROŠLO** |
| 9b | Titulek popupu „BOIT Rizikové weby", hashtag `#BezpečnějšíČesko` | **PROŠLO** |
| 10 | Žádné chyby v konzoli popupu — CSP ani výjimky | **PROŠLO** — celkem 14/14 |

Vizuálně zkontrolováno na screenshotech overlaye (closed shadow DOM se z testu
číst nedá):

| Stav | Výsledek |
|---|---|
| Ruční ☾ při světlém systému → tmavý overlay, zelené „Odejít" | **PROŠLO** |
| Přepnutí na ☀ v popupu → otevřené varování se přebarví bez reloadu | **PROŠLO** |
| Auto při světlém systému → světlý overlay, růžové „Odejít", neutrální „Přesto vstoupit" | **PROŠLO** |
| Tisk (`media: print`) při ručním ☾ → světlá varianta, bílé pozadí | **PROŠLO** |
| Znění varování odpovídá zdroji shody (ČOI) | **PROŠLO** |
| Patička varování: `#BezpečnějšíČesko` a `BOIT Cyber Security · boit.cz` | **PROŠLO** |
| Světlý popup v rizikovém stavu: bílé pozadí okna; růžové zůstávají jen akcenty (pruh „Rizikový web!" a počítadlo) | **PROŠLO** |

---

## Ověření produkčních zdrojů

**NEPROVEDENO v této relaci** — egress policy sandboxu odmítla spojení na
`ctu.gov.cz` i `spajk-cz.github.io` (HTTP 403 na proxy). Obcházení se nezkoušelo.

Verze 1.10.0 a 1.11.0 nemění logiku `background.js` (1.11.0 jen komentář a text
tooltipu), oprávnění ani CSP, takže stahování zdrojů je beze změny. Platí výsledky z 5. 9. 2026 (v1.9.0), převzaté níže.

### Seznam ČTÚ — výsledek z 5. 9. 2026

```bash
curl -sSI -L https://ctu.gov.cz/vyhledavaci-databaze/blokovane-weby/csv
```

**PROŠLO (5. 9. 2026).** HTTP 302 na `https://ctu.gov.cz/sites/default/files/blocking_lists/blocking_lists_20260904.csv`,
pak HTTP 200, `text/csv; charset=utf-8`, 391 910 bajtů. Přesměrování zůstává na
stejném hostu, takže jedno oprávnění `https://ctu.gov.cz/*` pokryje obojí.

Skutečné CSV protažené **skutečným** `parseDomainsFromCtuCsv` z obou variant:
4 079 řádků, z toho 4 013 aktivních, výsledkem 3 991 domén.

| Vstup z ostrého CSV | Očekáváno | Výsledek |
|---|---|---|
| `thelotter.com` (aktivní) | shoda | ✓ |
| `1xbet.com` (`DATUM_VYMAZU` 2023-01-04) | **bez shody** | ✓ |
| `nocuj.cz/online-casino-free-spiny-dnes` | **bez shody** na `nocuj.cz` | ✓ |
| `thenationonlineng.net/casino-en-ligne` | **bez shody** na doméně | ✓ |
| `https://tripadelicashop.com/cs/` | přeskočeno, cesta | ✓ |
| `mezinárodníonlinecasino.com` | punycode | ✓ |

### BOIT feed — výsledek z 5. 9. 2026

```bash
curl -sSI -L https://spajk-cz.github.io/boit-risk-feed/blacklist.txt
```

**PROŠLO (5. 9. 2026).** HTTP/2 200, `content-type: text/plain; charset=utf-8`,
bez redirectu, `access-control-allow-origin: *`, `cache-control: max-age=600`.
Živý obsah protažený **skutečným** `parseDomainsFromBoitFeed`: hlavička platná,
výsledek `["rt.com"]`; `rt.com`, `francais.rt.com` a `www.rt.com` → shoda,
`notrt.com` → bez shody.

> Pozor: tyto testy dokazují jen dostupnost a parsovatelnost zdrojů z shellu.
> **Nedokazují**, že doplněk zdroje skutečně stáhne — to závisí na
> `host_permissions` a CSP v prohlížeči a musí se ověřit zvlášť (níže).

---

## NEPROVEDENO — manuální ověření v prohlížečích

Firefox v této relaci k dispozici nebyl a Chromium běželo jen headless s popupem
otevřeným v záložce. Následující kroky je nutné projít ručně, než se balíčky
nahrají do obchodů. Do té doby jsou balíčky označené **„k ručnímu ověření"**.

### Chrome

1. Spustit **oddělený testovací profil**, neinstalovat přes produkční doplněk.
2. `chrome://extensions` → **Developer mode** → **Load unpacked**.
3. Vybrat rozbalený `dist/boit-rizikove-weby-chrome-1.11.0.zip`, případně `Chrome/` **ze stejné revize**.

### Firefox

1. Spustit **oddělený testovací profil**.
2. `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**.
3. Vybrat `manifest.json` z rozbaleného `dist/boit-rizikove-weby-firefox-1.11.0.zip`.
4. Neměnit ID produkčního doplňku, nezasahovat do instalace z AMO.

### Kontrolní seznam — identita a ikony (nové v 1.11.0)

| # | Co ověřit | Chrome | Firefox |
|---|---|---|---|
| I1 | Ikona v liště je ostrá na světlé i tmavé liště, v 1× i na retině; bezpečný web tmavá dlaždice s okem, rizikový růžová + štítek „!" | NEPROVEDENO | NEPROVEDENO |
| I2 | Popup otevřený z lišty na rizikovém webu ve světlém režimu má bílé okno | NEPROVEDENO | NEPROVEDENO |
| I3 | Po aktualizaci z předchozí verze: nový název v `chrome://extensions` / `about:addons`, doplněk zůstane zapnutý a zachová data | NEPROVEDENO | NEPROVEDENO |
| I4 | Ve storu (Chrome Web Store, AMO) se po schválení zobrazí nový název a ikona 128 px | NEPROVEDENO | NEPROVEDENO |

### Kontrolní seznam — téma (z 1.10.0)

| # | Co ověřit | Chrome | Firefox |
|---|---|---|---|
| T1 | Popup otevřený **kliknutím na ikonu v liště** se řídí tématem OS; přepnutí tématu OS se projeví | NEPROVEDENO | NEPROVEDENO |
| T2 | Přepínač `A \| ☀ \| ☾` mění popup; volba vydrží zavření popupu i restart prohlížeče | NEPROVEDENO | NEPROVEDENO |
| T3 | Při opakovaném otevření popupu s ručně zvoleným tématem nic neproblikne | NEPROVEDENO | NEPROVEDENO |
| T4 | Overlay na testovací doméně respektuje volbu z popupu; změna volby se projeví na otevřeném varování | NEPROVEDENO | NEPROVEDENO |
| T5 | Tisk (Ctrl+P) stránky s varováním: náhled je světlý a čitelný | NEPROVEDENO | NEPROVEDENO |
| T6 | Ovládání přepínače klávesnicí (Tab na zvolenou volbu, šipky) a čtečkou obrazovky (ohlásí „Barevný režim", stav zaškrtnutí) | NEPROVEDENO | NEPROVEDENO |
| T7 | Firefox for Android: popup i overlay v obou režimech | — | NEPROVEDENO |
| T8 | Po aktualizaci z 1.9.0 zůstanou seznamy, statistiky i whitelist; téma začne na Auto | NEPROVEDENO | NEPROVEDENO |

### Kontrolní seznam — regrese z 1.9.0

| # | Co ověřit | Stav |
|---|---|---|
| 1 | Oprávnění pro `https://spajk-cz.github.io/*` jsou udělena; případná výzva při přechodu z 1.7 se nesmí přehlédnout | NEPROVEDENO |
| 2 | V background konzoli je vidět úspěšné načtení BOIT feedu a **žádné CSP ani CORS chyby** | NEPROVEDENO |
| 3 | ČOI i SOI se dál načítají; ruční **Aktualizovat seznam** seznam obnoví | NEPROVEDENO |
| 4 | Varování u BOIT-only domény, tlačítko „Přesto vstoupit" a whitelist fungují | NEPROVEDENO |
| 5 | Při offline obnově zůstanou uložené domény a status nelže o aktuálnosti (popup ukáže částečnou obnovu) | NEPROVEDENO |
| 6 | Tlačítko „Nahlásit nebo odvolat" otevře novou záložku s `NAHLASENI.md` a v adresním řádku **není** kontrolovaná doména ani query parametr | NEPROVEDENO |
| 7 | Oprávnění pro `https://ctu.gov.cz/*` je uděleno a v konzoli je vidět načtení zhruba 4 000 domén ČTÚ bez CSP/CORS chyby | NEPROVEDENO |
| 8 | Na doméně jen z ČTÚ hlásí overlay **znění o seznamu blokovaných webů ČTÚ**, ne „podvodný e-shop"; na doméně jen z ČOI naopak znění o ČOI | NEPROVEDENO |

### Jak testovat overlay

Overlay testovat na **neškodné fixture stránce** v testovacím prostředí.
Nechodit kvůli testu na skutečný podvodný e-shop.

Testovací doménu **nezapisovat do veřejného feedu**. Buď vložit fixture jen do
oddělené testovací cache (`storage.local`), nebo použít lokální testovací
harness. Takhle proběhl i end-to-end test výše.

Produkční feed k 5. 9. 2026 obsahoval jednu doménu (`rt.com`), takže BOIT-only
end-to-end test s reálnou blokovanou doménou na ní provést lze. Pokud by feed
zůstal prázdný, tento test se za provedený prohlásit nesmí.
