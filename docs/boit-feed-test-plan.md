# Testovací protokol — BOIT feed a seznam ČTÚ (v1.9.0)

Datum: 5. 9. 2026 · větev `feature/ctu-blocking-list` · Node v26.7.0 · git 2.53.0

Rozlišení stavů v tomto protokolu:
**PROŠLO** = spuštěno a prošlo · **SELHALO** = spuštěno a selhalo · **NEPROVEDENO** = neběželo.

---

## Automatické testy

```bash
node --test tests/*.test.mjs
```

**PROŠLO — 331 testů, 0 selhání.** Sada běží dvakrát, jednou proti
`Chrome/background.js` a jednou proti `Firefox/background.js`.

Testy načítají skutečné background skripty do `node:vm` s namockovaným
`chrome`/`browser` API, fetchem, `storage.local`, časem a alarmy. Netestují se
přepsané kopie funkcí — na konec zdroje se jen připojí řádek, který deklarované
konstanty a funkce vystaví ven.

Znění varování se testuje stejným způsobem: blok s popisy se vyřízne z reálného
`content.js` obou variant a spustí v minimálním DOM stubu.

### Co je pokryté

| Oblast | Případy |
|---|---|
| Platný BOIT feed | běžný seznam, samotná hlavička (prázdná aktualizace), CRLF, UTF-8 BOM, komentáře, prázdné řádky, punycode, subdomény, deduplikace, doména ze safelistu |
| Odmítnutí feedu | chybějící hlavička, prázdný soubor, HTML chybová stránka, jiná verze hlavičky, 16 tříd neplatných řádků (URL, cesta, port, e-mail, wildcard, IP, velká písmena, `www.`, komentář za doménou, podtržítko, pomlčka na konci labelu, jeden label, mimo ASCII, odsazení, prázdný label, label 64 znaků), překročení 5 000 domén |
| ČTÚ CSV — platné | fixture, jen prázdný `DATUM_VYMAZU`, datum z mezer jako prázdné, schéma i koncové lomítko, `www.` normalizace, IDN → punycode, deduplikace, CRLF, BOM, jiné pořadí sloupců, uvozovaná pole s čárkou, safelist |
| ČTÚ CSV — přeskočené | URL s konkrétní cestou (3 reálné případy), query, fragment, jiné schéma, `javascript:`, credentials, IP adresa, prázdná hodnota, mezery, nesmysl |
| ČTÚ CSV — odmítnuté celé | prázdné CSV, chybějící sloupce, HTML místo CSV, nula platných domén |
| ČTÚ jako zdroj | konfigurace čtvrtého zdroje přes HTTPS, úspěšné načtení, HTTP 404, timeout, HTML místo CSV, překročení velikosti, vlastní vyšší strop než BOIT feed |
| Zdroj shody | `matchingSources` vrací konkrétní zdroj, doména ve dvou seznamech vrátí oba, subdoména dědí zdroj rodiče, `CHECK_DOMAIN` vrací `matchedSources` jen při shodě, při migraci zůstane zdroj neznámý, `GET_STATUS` nese popisky |
| Znění varování | ČTÚ faktické znění bez „podvodu" a bez „rizikových e-shopů", ČOI/SOI znění o úřadu, BOIT netvrdí „oficiální", shoda ve dvou seznamech uvede oba, neznámý zdroj spadne na obecné znění, upozornění na osobní údaje vždy na konci, opakované vykreslení text nezdvojí, pořadí je stabilní |
| Matching | pole i `Set` dají shodný výsledek, žádná shoda na veřejném suffixu, `riskySet` se přestaví až po změně dat |
| Načtení zdroje | HTTP 200, HTTP 404, timeout, HTML místo feedu, `content-length` nad 2 MiB, skutečné tělo nad 2 MiB bez `content-length`, odmítnutí jiného schématu než HTTPS, prázdný výsledek HTML parseru jako chyba, `credentials: 'omit'` |
| Shody | ČOI-only, SOI-only, BOIT-only, rodičovská doména zahrnuje subdomény, `notrt.com` / `rt.com.example` / `rt.company` se nechytají, `www.` normalizace, bezpečné domény |
| Whitelist | trvalé povolení, dočasné na 24 h včetně vypršení, normalizace `www.` |
| Výpadky | každý zdroj zvlášť, všechny současně, ruční obnova při selhání všech, restart s uloženou cache |
| Migrace | stará sloučená cache při nedostupné ČOI/SOI, následné zotavení a vyřazení fallbacku, spuštění nového zdroje při čerstvé staré cache |
| Odebrání domény | jedna doména, poslední doména, záznam vedený i jiným zdrojem zůstává |
| Limity | sloučený seznam 17 006 položek se neutne na velikosti největšího zdroje, položka z konce ČTÚ i BOIT feedu přežije, jeden zdroj se ořízne na stropu a zaloguje to, `MAX_MERGED_DOMAINS` = součet limitů |
| TTL a alarmy | stáří přesně TTL je splatné, těsně pod TTL ne, registrace alarmu při instalaci, spuštění obnovy alarmem, cizí alarm neobnovuje, souběžné požadavky sdílí jednu promise |
| HTML parsery | ČOI a SOI fixtures beze změny, safelist se nezařadí, BOIT feed se HTML parserem nezpracovává |
| Manifesty | platný JSON, MV3, host permission a `connect-src` origin pro **každý** zdroj z kódu, žádný `*.gov.cz` wildcard, žádný `*.github.io`, žádný `raw.githubusercontent.com`, žádný `<all_urls>`, `script-src 'self'` beze změny, žádná nová API permission, gecko ID beze změny |
| Verze | shoda obou manifestů, ≥ 1.8.0, shoda s patičkou popupu i overlaye |
| Nahlášení | `OPEN_REPORT_PAGE` otevře pevnou URL stránky projektu, odpoví `{ok:true}`, v URL není doména ani query, zrušený `REPORT_COI` vrací `unknown_type`, zpráva z cizího rozšíření se odmítne, `NAHLASENI.md` nese kontakt, obě varianty drží shodnou konstantu, po `mailto`/ČOI e-mailech nezůstala stopa |
| Texty | popis se skládá až za běhu (slot `js-desc`, nic napevno v markupu), ČTÚ má faktické znění a zmínku o léčivech, popis BOIT netvrdí „oficiální", zmizelo „Provozovatel není ověřitelný", overlay umí zmínit všechny čtyři zdroje |

## Statická kontrola

| Kontrola | Příkaz | Výsledek |
|---|---|---|
| Syntax JS | `node --check` na změněné soubory obou variant | **PROŠLO** |
| Validita JSON | `JSON.parse` obou manifestů | **PROŠLO** |
| Whitespace | `git diff --check` (sledované i nové soubory) | **PROŠLO** |
| Obsah ZIPů | `unzip -l` obou balíčků | **PROŠLO** — `manifest.json` v kořeni, verze 1.9.0, bez `tests/`, `.git`, `.DS_Store`, `node_modules` i bez druhého prohlížeče |
| `web-ext lint` | `npx web-ext lint --source-dir Firefox` | **PROŠLO** — 0 errors, 0 notices, 0 warnings |

## Ověření produkčního seznamu ČTÚ

```bash
curl -sSI -L https://ctu.gov.cz/vyhledavaci-databaze/blokovane-weby/csv
```

**PROŠLO.** HTTP 302 na `https://ctu.gov.cz/sites/default/files/blocking_lists/blocking_lists_20260904.csv`,
pak HTTP 200, `text/csv; charset=utf-8`, 391 910 bajtů. Přesměrování zůstává na
stejném hostu, takže jedno oprávnění `https://ctu.gov.cz/*` pokryje obojí.

Skutečné CSV protažené **skutečným** `parseDomainsFromCtuCsv` z obou variant:
**PROŠLO** — 4 079 řádků, z toho 4 013 aktivních, výsledkem 3 991 domén.

Ověřené chování na reálných datech:

| Vstup z ostrého CSV | Očekáváno | Výsledek |
|---|---|---|
| `thelotter.com` (aktivní) | shoda | ✓ |
| `1xbet.com` (`DATUM_VYMAZU` 2023-01-04) | **bez shody** | ✓ |
| `nocuj.cz/online-casino-free-spiny-dnes` | **bez shody** na `nocuj.cz` | ✓ |
| `thenationonlineng.net/casino-en-ligne` | **bez shody** na doméně | ✓ |
| `https://tripadelicashop.com/cs/` | přeskočeno, cesta | ✓ |
| `mezinárodníonlinecasino.com` | punycode | ✓ |

Poslední dva řádky jsou přesně ten případ, kvůli kterému se URL s konkrétní cestou
přeskakují: jde o jinak legitimní weby s jedním blokovaným článkem.

## Ověření produkční feed URL

```bash
curl -sSI -L https://spajk-cz.github.io/boit-risk-feed/blacklist.txt
```

**PROŠLO.** HTTP/2 200, `content-type: text/plain; charset=utf-8`,
`url_effective` shodná se zadanou (žádný redirect na vlastní doménu),
`access-control-allow-origin: *`, `cache-control: max-age=600`, 27 bajtů.

Živý obsah feedu protažený **skutečným** `parseDomainsFromBoitFeed` z obou
variant: **PROŠLO** — hlavička platná, výsledek `["rt.com"]`. Ověřeno také
`rt.com` → shoda, `francais.rt.com` → shoda (subdoména), `www.rt.com` → shoda
po normalizaci, `notrt.com` → bez shody.

> Pozor: tento test dokazuje jen dostupnost a parsovatelnost feedu přes HTTP
> z shellu. **Nedokazuje**, že doplněk feed skutečně stáhne — to závisí na
> `host_permissions` a CSP v prohlížeči a musí se ověřit zvlášť (níže).

---

## NEPROVEDENO — manuální ověření v prohlížečích

Prohlížeče nebyly v této relaci k dispozici — doplněk se nedá nainstalovat ani
otestovat bez skutečného Chrome a Firefox profilu. Následující kroky je nutné
projít ručně, než se balíčky nahrají do obchodů. Do té doby jsou balíčky
označené **„k ručnímu ověření"**.

### Chrome

1. Spustit **oddělený testovací profil**, neinstalovat přes produkční doplněk.
2. `chrome://extensions` → **Developer mode** → **Load unpacked**.
3. Vybrat adresář `Chrome/` **z testovaného worktree**, ne z jiné kopie repozitáře.

### Firefox

1. Spustit **oddělený testovací profil**.
2. `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…**.
3. Vybrat `Firefox/manifest.json` ze stejné revize.
4. Neměnit ID produkčního doplňku, nezasahovat do instalace z AMO.

### Kontrolní seznam

| # | Co ověřit | Stav |
|---|---|---|
| 1 | Oprávnění pro nový host `https://spajk-cz.github.io/*` jsou skutečně udělena; případná výzva při přechodu z 1.7 se nesmí přehlédnout | NEPROVEDENO |
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
harness.

Produkční feed dnes obsahuje jednu doménu (`rt.com`), takže BOIT-only
end-to-end test s reálnou blokovanou doménou na ní provést lze. Pokud by feed
zůstal prázdný, tento test se za provedený prohlásit nesmí.
