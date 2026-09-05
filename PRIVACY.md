# Zásady ochrany osobních údajů

## BOIT Rizikové E-shopy (Chrome extension)

**Poslední aktualizace:** 5. 9. 2026 (verze 1.8.0)

---

### Stručně

Tato extension **nesbírá, neukládá ani nepřenáší žádné osobní údaje uživatelů**. Všechna data zůstávají lokálně v prohlížeči.

### Jaká data extension používá

Extension ukládá **lokálně v prohlížeči** (přes `chrome.storage.local`) pouze:

- **Seznamy rizikových domén** stažené od ČOI, SOI a BOIT
- **Časové razítko** posledního úspěšného načtení, zvlášť pro každý zdroj
- **Anonymní počítadlo** — kolikrát vás extension varovala a kolik unikátních rizikových domén to bylo
- **Váš whitelist** — domény, které jste si ručně povolil(a)

Tato data **nikdy neopouštějí váš prohlížeč**.

### Síťová komunikace

Extension stahuje periodicky (každých 6 hodin) tři seznamy domén:

- **`https://coi.gov.cz`** — seznam rizikových e-shopů České obchodní inspekce
- **`https://www.soi.sk`** — seznam rizikových internetových obchodů Slovenskej obchodnej inšpekcie
- **`https://spajk-cz.github.io/boit-risk-feed/blacklist.txt`** — seznam vedený BOIT Cyber Security

Jiné síťové operace extension neprovádí. Při stahování se nepřenáší žádná identifikace
uživatele, cookies ani jiné osobní údaje (`credentials: 'omit'`).

Porovnání navštívené domény se seznamy probíhá **výhradně lokálně ve vašem prohlížeči**.
Navštívené URL, hostname ani historie prohlížení se nikam neodesílají — stahuje se vždy
celý seznam, nikoli dotaz na konkrétní doménu.

**Na rovinu k IP adrese:** stahování seznamu je běžný HTTPS požadavek, takže poskytovatelé
hostingu těchto seznamů (ČOI, SOI a u BOIT seznamu GitHub Pages) vidí obvyklé údaje
HTTP spojení, včetně IP adresy a User-Agentu. Netvrdíme, že to možné není. Co se jim
neposílá, je informace o tom, jaké weby navštěvujete.

### Co extension NEdělá

- Nesbírá historii prohlížení
- Neposílá navštívené URL adresy nikam na server
- Neobsahuje analytiku, trackery ani reklamy
- Nepřistupuje k obsahu formulářů, hesel ani platebních údajů
- Neshromažďuje žádné osobní údaje

### Content script

Extension spouští skript na navštívených stránkách pouze za účelem:

1. Zjištění domény (`hostname`) aktuální stránky — pro lokální porovnání se staženými seznamy
2. Lokální detekce rizikových signálů (HTTPS, IČO, obchodní podmínky atd.) — pouze čtení viditelného textu stránky, nikam se neposílá

Detekce probíhá **výhradně lokálně**, výsledky se nikam nezasílají.

### Funkce "Nahlásit nebo odvolat"

Tlačítko v upozornění **pouze otevře novou záložku** se stránkou projektu
[NAHLASENI.md](https://github.com/spajk-cz/BOIT-Rizikov-E-shopy/blob/main/NAHLASENI.md),
kde je kontaktní e-mail **doplnek@boit.cz** pro nahlášení domény i pro žádost o vyřazení.

Odkaz je **pevný a bez jakýchkoli parametrů**. Kontrolovaná doména ani zjištěné rizikové
signály se do URL nedoplňují, takže se kliknutím nikam neodešle informace o tom, jaký web
jste právě navštívili. Co napíšete do e-mailu, je plně na vás.

### Oprávnění a jejich účel

- `storage` — ukládání seznamu a nastavení lokálně
- `alarms` — automatická aktualizace seznamu každých 6 hodin
- `tabs` — zjištění aktuální URL tabu pro zobrazení stavu v ikonce a popupu
- `host_permissions: coi.gov.cz` — stahování seznamu ČOI
- `host_permissions: www.soi.sk` — stahování seznamu SOI
- `host_permissions: spajk-cz.github.io` — stahování seznamu BOIT
- `content_scripts` na všech webech — detekce rizikových domén při načtení stránky

### Kontakt

**BOIT Cyber Security s.r.o.**
Web: [boit.cz](https://boit.cz)
E-mail: info@boit.cz

### Změny

Případné změny těchto zásad budou publikovány v repozitáři extension a ve změnách na Chrome Web Store.
