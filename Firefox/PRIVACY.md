# Zásady ochrany osobních údajů

## BOIT Rizikové E-shopy (Chrome extension)

**Poslední aktualizace:** 2026

---

### Stručně

Tato extension **nesbírá, neukládá ani nepřenáší žádné osobní údaje uživatelů**. Všechna data zůstávají lokálně v prohlížeči.

### Jaká data extension používá

Extension ukládá **lokálně v prohlížeči** (přes `chrome.storage.local`) pouze:

- **Seznam rizikových domén** stažený z webu České obchodní inspekce
- **Časové razítko** poslední aktualizace seznamu
- **Anonymní počítadlo** — kolikrát vás extension varovala a kolik unikátních rizikových domén to bylo
- **Váš whitelist** — domény, které jste si ručně povolil(a)

Tato data **nikdy neopouštějí váš prohlížeč**.

### Síťová komunikace

Extension provádí pouze jednu síťovou operaci:

- **Stahování seznamu z `https://coi.gov.cz`** — periodicky (každých 6 hodin) za účelem aktualizace seznamu rizikových e-shopů

Při tomto požadavku se nepřenáší žádná identifikace uživatele, cookies ani jiné osobní údaje (`credentials: 'omit'`).

### Co extension NEdělá

- Nesbírá historii prohlížení
- Neposílá navštívené URL adresy nikam na server
- Neobsahuje analytiku, trackery ani reklamy
- Nepřistupuje k obsahu formulářů, hesel ani platebních údajů
- Neshromažďuje žádné osobní údaje

### Content script

Extension spouští skript na navštívených stránkách pouze za účelem:

1. Zjištění domény (`hostname`) aktuální stránky — pro porovnání se seznamem ČOI
2. Lokální detekce rizikových signálů (HTTPS, IČO, obchodní podmínky atd.) — pouze čtení viditelného textu stránky, nikam se neposílá

Detekce probíhá **výhradně lokálně**, výsledky se nikam nezasílají.

### Funkce "Nahlásit ČOI"

Pokud uživatel klikne na tlačítko "Nahlásit ČOI" v upozornění, extension pouze otevře uživatelův mailový klient s předvyplněnou zprávou. Zpráva se nikam neodesílá automaticky — odeslání je plně pod kontrolou uživatele.

### Oprávnění a jejich účel

- `storage` — ukládání seznamu a nastavení lokálně
- `alarms` — automatická aktualizace seznamu každých 6 hodin
- `tabs` — zjištění aktuální URL tabu pro zobrazení stavu v ikonce a popupu
- `host_permissions: coi.gov.cz` — stahování seznamu ČOI
- `content_scripts` na všech webech — detekce rizikových domén při načtení stránky

### Kontakt

**BOIT Cyber Security s.r.o.**
Web: [boit.cz](https://boit.cz)
E-mail: info@boit.cz

### Změny

Případné změny těchto zásad budou publikovány v repozitáři extension a ve změnách na Chrome Web Store.
