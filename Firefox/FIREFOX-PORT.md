# BOIT Rizikové E-shopy — Firefox Port

**Verze:** 1.7.0  
**Cílový prohlížeč:** Firefox 140.0+ (desktop), Firefox for Android 142.0+  
**Stav:** připraveno k uploadu na [addons.mozilla.org](https://addons.mozilla.org) · **lint clean (0/0/0)**

---

## Co se změnilo proti Chrome verzi

### 1. `manifest.json`

| Klíč | Chrome | Firefox |
|------|--------|---------|
| `background` | `service_worker: "background.js"` | `scripts: ["background.js"]` |
| `minimum_chrome_version` | `"110"` | ❌ odstraněno |
| `browser_specific_settings.gecko.id` | — | `"rizikove-eshopy@boit.cz"` |
| `browser_specific_settings.gecko.strict_min_version` | — | `"140.0"` |
| `browser_specific_settings.gecko.data_collection_permissions` | — | `{ "required": ["none"] }` |
| `browser_specific_settings.gecko_android.strict_min_version` | — | `"142.0"` |

**Proč FF 140+ desktop / 142+ Android:** klíč `data_collection_permissions` je od listopadu 2025 **povinný pro všechny nové AMO submissions**. Tento klíč Firefox čte až od desktop verze 140 a Android verze 142, takže `strict_min_version` musí být alespoň tato. Hodnota `"none"` říká uživateli, že doplněk nesbírá ani neposílá žádná osobní data.

**Background scripts:** Firefox MV3 background neběží jako service worker (jako v Chrome), ale jako *event page* (nepersistentní background script). Funkčně se to chová stejně z hlediska našeho kódu — listenery jsou registrované synchronně na top-levelu, stav je v `storage.local`.

**Bonus — Android support:** Díky `gecko_android` klíči je doplněk dostupný i pro **Firefox for Android** (Chrome Android extensions vůbec neumí, takže to je oproti Chrome verzi feature navíc).

### 2. JavaScript API: `chrome.*` → `browser.*`

Největší změna a hlavní důvod, proč Chrome ZIP nelze přímo nahrát do Firefoxu.

**Problém:** ve Firefoxu je `chrome.*` jen *callback-only* aliasem pro kompatibilitu — `await chrome.storage.local.get(...)` selže s `TypeError: undefined has no properties`. `browser.*` API vrací nativní Promises.

**Co bylo přepsané:**

- `background.js`: všechny `chrome.storage.*`, `chrome.tabs.*`, `chrome.action.*`, `chrome.runtime.*`, `chrome.alarms.*` → `browser.*`
- `chrome.tabs.get(id, cb)` (callback) → `try { const tab = await browser.tabs.get(id) } catch (e) {}`
- `chrome.action.setIcon({...}, consumeLastError)` → `browser.action.setIcon({...}).catch(() => {})`
- `chrome.tabs.create({url}, cb)` → `browser.tabs.create({url}).then(...).catch(...)`
- `content.js`: `chrome.runtime.sendMessage(msg, cb)` → `browser.runtime.sendMessage(msg).then(...).catch(...)`
- `popup.js`: vlastní `sendMessage()` helper přepsán z `new Promise(resolve => chrome.runtime.sendMessage(msg, ...))` na `browser.runtime.sendMessage(msg).then(...).catch(() => null)`

### 3. `innerHTML` → `DOMParser` (lint-clean refactor)

AMO linter chybně označuje `el.innerHTML = staticConst` za "unsafe assignment" (false positive — žádný user input). Refactor přes `DOMParser.parseFromString(...)`:

- Přidány utility `parseStaticHtml()` a `parseStaticSvg()` na začátku `content.js`
- `card.innerHTML = CARD_MARKUP` → `card.appendChild(parseStaticHtml(CARD_MARKUP))`
- `logoSlot.innerHTML = BOIT_LOGO_SVG` → `logoSlot.appendChild(parseStaticSvg(BOIT_LOGO_SVG))`

Funkčně identické, ale linter to považuje za safe (DOMParser je explicitní parsovací API).

### 4. Drobnost: oprava verze ve footeru

V Chrome `popup.html` zůstala stará verze `v1.6.2` ve footeru, přestože manifest říkal `1.7.0`. Firefox verze má v patičce **opraveno na `v1.7.0`** (manifest match). Doporučujem stejnou opravu vzít i do Chrome verze.

### 5. Beze změny

Tyhle části nepotřebovaly nic upravit, protože jsou to čistá web API:

- **Overlay rendering (`content.js`):** Closed Shadow DOM, MutationObserver re-injection, CSS blur přes `<style>` s `!important`, `isTrusted` validace eventů. Funguje identicky.
- **`popup.css`, `popup.html` (kromě verze):** čisté CSS/HTML.
- **Ikonky:** stejné PNG, beze změny.
- **`LICENSE`, `PRIVACY.md`:** kopie z Chrome verze.
- **CSP, host_permissions, permissions, content_scripts:** identické s Chrome.
- **Parser ČOI/SOI HTML, fetch, cache, whitelist, stats:** kompletně identická logika.

---

## Web-ext lint výsledek (finální)

```
errors:   0
notices:  0
warnings: 0
```

**Čistá lint — připraveno k AMO submission.**

---

## Jak otestovat lokálně

1. Otevři `about:debugging` v Firefoxu
2. Klikni na **"This Firefox"** → **"Load Temporary Add-on…"**
3. Vyber `manifest.json` z rozbaleného ZIPu
4. Otevři libovolný web ze seznamu ČOI/SOI pro test overlay
5. V `about:debugging` → "Inspect" si můžeš otevřít konzoli background scriptu

Pro test na Firefox for Android: `about:debugging` na desktop FF, přes USB se napojí mobil, **"Setup"** → **"Enable USB devices"**.

## Jak submitnout na AMO

1. Nahraj `boit-rizikove-eshopy-firefox-v1_7_0.zip` na [addons.mozilla.org/developers/addon/submit/](https://addons.mozilla.org/developers/addon/submit/)
2. AMO automaticky spustí `web-ext lint` (stejný co jsme spustili tady) — projde čistě
3. Při submission vyber **"On this site"** distribution (= veřejně listed na AMO)
4. Pro **Android verzi** zaškrtni `Firefox for Android` v compatibility sekci
5. První submission každého nového extension ID prochází human review (typicky 1–5 dní)

## Po publikaci

Doplněk půjde najít na:

- `addons.mozilla.org/cs/firefox/addon/rizikove-eshopy/` (nebo podobný slug)
- `boit.cz/nastroje/podvodne-weby` (vedle Chrome verze)
- **Firefox for Android** v Add-ons sekci (auto sync s desktop verzí)
