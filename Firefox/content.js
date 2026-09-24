/**
 * BOIT Rizikové weby — content script (Firefox MV3)
 * Detekuje rizikové weby dle seznamů ČOI, SOI, ČTÚ a BOIT a zobrazí varování v BOIT brandu.
 *
 * Pozn. k Firefoxu: používáme browser.runtime.sendMessage (vrací Promise).
 * Overlay (closed Shadow DOM, MutationObserver, !important blur) je čisté
 * web API a beze změny funguje identicky jako v Chrome.
 */
(function () {
  'use strict';

  if (window.__boitChecked) return;
  window.__boitChecked = true;

  const hostname = (location.hostname || '').toLowerCase().replace(/^www\./, '');
  if (!hostname || !hostname.includes('.')) return;

  const setText = (el, text) => { if (el) el.textContent = String(text == null ? '' : text); };

  // Stránka projektu s kontaktem pro nahlášení domény i žádost o vyřazení.
  // Bez parametrů — kontrolovaná doména se nikam neodesílá.
  const REPORT_PAGE_URL = 'https://github.com/spajk-cz/BOIT-Rizikov-E-shopy/blob/main/NAHLASENI.md';

  // Text varování se skládá podle toho, který seznam doménu skutečně vede —
  // tvrzení o ČTÚ nesmí padnout u domény, kterou vede jen ČOI, a naopak.
  // Vnořené pole znamená zvýrazněnou část. Vykresluje se jako DOM uzly, takže
  // se nikde nesestavuje HTML řetězec z dat.
  const SOURCE_DESCRIPTIONS = {
    CTU: ['Tato stránka je uvedena na oficiálním seznamu blokovaných webů ', ['ČTÚ'],
      '. Ten vedle nepovolených internetových her zahrnuje i nelegální nabídku léčiv a další kategorie, nejde tedy jen o e-shopy.'],
    COI: ['Tato doména je na oficiálním seznamu rizikových e-shopů ', ['České obchodní inspekce'], '.'],
    SOI: ['Tato doména je na oficiálním seznamu rizikových internetových obchodů ', ['Slovenskej obchodnej inšpekcie'], '.'],
    BOIT: ['Tato doména je na seznamu rizikových webů, který vede ', ['BOIT Cyber Security'], '.']
  };

  // Použije se, když zdroj shody neznáme — typicky během přechodu ze starší verze.
  const FALLBACK_DESCRIPTION = ['Tato doména je na jednom ze seznamů rizikových webů, které doplněk používá: ',
    ['ČOI'], ', ', ['SOI'], ', ', ['ČTÚ'], ' nebo ', ['BOIT'], '.'];

  const CAUTION_DESCRIPTION = [' Před zadáním osobních či platebních údajů doporučujeme zvýšenou opatrnost.'];

  function renderDescription(el, matchedSources) {
    if (!el) return;

    const names = Array.isArray(matchedSources)
      ? matchedSources.map(s => (s && s.name) || '').filter(Boolean)
      : [];

    const segments = [];
    for (const key of ['CTU', 'COI', 'SOI', 'BOIT']) {
      if (!names.includes(key)) continue;
      if (segments.length) segments.push(' ');
      for (const part of SOURCE_DESCRIPTIONS[key]) segments.push(part);
    }
    if (segments.length === 0) for (const part of FALLBACK_DESCRIPTION) segments.push(part);
    for (const part of CAUTION_DESCRIPTION) segments.push(part);

    el.textContent = '';
    for (const segment of segments) {
      if (Array.isArray(segment)) {
        const strong = document.createElement('strong');
        strong.textContent = segment[0];
        el.appendChild(strong);
      } else {
        el.appendChild(document.createTextNode(segment));
      }
    }
  }


  // ── Parsovací helpery pro statický markup ──
  // Linter AMO chybně označuje innerHTML = staticConst za "unsafe" (false positive).
  // DOMParser je explicitní parsovací API, které linter považuje za safe — výsledek
  // je stejný, jen technicky čistší. POZOR: parametr `html` musí být STATICKÁ konstanta
  // definovaná v tomto souboru, nikdy ne user input.
  function parseStaticHtml(html) {
    const doc = new DOMParser().parseFromString('<div id="__r">' + html + '</div>', 'text/html');
    const root = doc.getElementById('__r');
    const frag = document.createDocumentFragment();
    while (root && root.firstChild) frag.appendChild(root.firstChild);
    return frag;
  }

  function parseStaticSvg(svg) {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    // Po parsování přemigrujeme element do hlavního dokumentu
    return document.importNode(doc.documentElement, true);
  }

  // Promise-based volání — chyby polkneme, content script má fungovat fire-and-forget
  browser.runtime.sendMessage({ type: 'CHECK_DOMAIN', hostname })
    .then((response) => {
      if (!response) return;
      if (response.isRisky && !response.whitelisted) {
        const signals = detectRiskSignals();
        browser.runtime.sendMessage({ type: 'RECORD_BLOCK', hostname }).catch(() => {});
        // Téma se načte předem, aby overlay neprobliknul ve špatných barvách.
        return readThemePreference().then(theme => injectWarning(signals, response.matchedSources, theme));
      }
    })
    .catch(() => { /* background nedostupný — ignorujeme */ });

  // ──────────────────────────────────────────────────────────────────────
  // Téma overlaye — stejná volba jako v popupu (theme-toggle.js)
  // ──────────────────────────────────────────────────────────────────────
  const THEME_STORAGE_KEY = 'boit_ui_theme';

  /** Ručně zvolené téma: 'light', 'dark', nebo 'auto' (podle prohlížeče). Nikdy nevyhodí. */
  async function readThemePreference() {
    try {
      const stored = await browser.storage.local.get([THEME_STORAGE_KEY]);
      const theme = stored[THEME_STORAGE_KEY];
      return theme === 'light' || theme === 'dark' ? theme : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  /** Bez atributu rozhoduje prefers-color-scheme prohlížeče. */
  function applyOverlayTheme(backdrop, theme) {
    if (theme === 'light' || theme === 'dark') backdrop.setAttribute('data-theme', theme);
    else backdrop.removeAttribute('data-theme');
  }

  // ──────────────────────────────────────────────────────────────────────
  // Detekce rizikových signálů
  // ──────────────────────────────────────────────────────────────────────
  function detectRiskSignals() {
    const signals = [];
    const pageText = (document.body?.innerText || '').toLowerCase();

    if (location.protocol !== 'https:') {
      signals.push({ level: 'high', title: 'Nešifrované spojení (HTTP)',
        desc: 'Stránka nemá šifrované spojení — data z formulářů lze odposlechnout.' });
    }

    const hasIco = /ičo[\s:]*\d{8}/i.test(pageText) || /ic[\s:]*\d{8}/i.test(pageText);
    const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(pageText);
    const hasPhone = /(\+?\d{3}[\s\-]?)?\d{3}[\s\-]?\d{3}[\s\-]?\d{3}/.test(pageText);

    if (!hasIco) signals.push({ level: 'high', title: 'Chybí IČO provozovatele',
      desc: 'U českého e-shopu je IČO povinný údaj ze zákona.' });
    if (!hasEmail) signals.push({ level: 'mid', title: 'Chybí kontaktní e-mail',
      desc: 'Nenalezli jsme e-mail na provozovatele.' });
    if (!hasPhone) signals.push({ level: 'low', title: 'Chybí telefonní kontakt',
      desc: 'Legitimní e-shopy obvykle uvádí telefon pro podporu.' });

    const hasTerms = /(obchodní podmínky|všeobecné podmínky|reklamační řád|odstoupení od smlouvy)/i.test(pageText);
    if (!hasTerms) signals.push({ level: 'mid', title: 'Chybí obchodní podmínky',
      desc: 'Odkazy na obchodní podmínky či reklamační řád nejsou viditelné.' });

    const suspiciousTlds = ['.top', '.xyz', '.click', '.shop', '.store', '.online', '.site', '.live', '.buzz'];
    const tld = '.' + hostname.split('.').pop();
    if (suspiciousTlds.includes(tld)) {
      signals.push({ level: 'low', title: 'Podezřelá TLD (' + tld + ')',
        desc: 'Koncovka je statisticky často spojená s podvodnými e-shopy.' });
    }

    const hasCard = /(platební karta|kartou|visa|mastercard|apple pay|google pay)/i.test(pageText);
    const hasBank = /(bankovní převod|převodem na účet|bank transfer)/i.test(pageText);
    if (hasBank && !hasCard) {
      signals.push({ level: 'high', title: 'Pouze bankovní převod',
        desc: 'Typický znak scamu — platba je nevratná a obtížně dohledatelná.' });
    }

    const percentMatches = pageText.match(/-?(\d{2,3})\s*%/g) || [];
    const highDiscounts = percentMatches.filter(p => {
      const n = parseInt(p, 10);
      return n >= 70 && n <= 99;
    });
    if (highDiscounts.length >= 3) {
      signals.push({ level: 'mid', title: 'Extrémní slevy (' + highDiscounts.length + '×)',
        desc: 'Více slev 70 %+ — typický lákací vzor scam e-shopů.' });
    }

    return signals;
  }

  // ──────────────────────────────────────────────────────────────────────
  // BOIT logo (zjednodušené inline SVG z oficiálních zdrojů)
  // ──────────────────────────────────────────────────────────────────────
  const BOIT_LOGO_SVG = '<svg viewBox="0 0 560 177.093" xmlns="http://www.w3.org/2000/svg" aria-label="BOIT">' +
    '<rect x="67.9518" y="94.2674" width="43.3901" height="5.0654" fill="currentColor"/>' +
    '<rect x="67.9518" y="77.0452" width="43.3901" height="5.0654" fill="currentColor"/>' +
    '<path d="m129.2301,30H47.8626l-17.8627,17.8628v81.3674l17.8627,17.8625h81.3674l17.8628-17.8625V47.8628l-17.8628-17.8628Zm-20.4202,81.4895h-53.0142v-46.5985h53.0142c8.104,0,14.266,5.9098,14.266,13.1682,0,4.0514-1.9414,7.6807-4.9806,10.046,3.2927,2.4479,5.4027,6.0771,5.4027,10.2134,0,7.2612-6.5841,13.1709-14.6881,13.1709Z" fill="currentColor"/>' +
    '<rect x="195.5875" y="77.0452" width="41.1958" height="22.2876" fill="currentColor"/>' +
    '<path d="m256.8658,30h-81.3674l-17.8627,17.8628v81.3674l17.8627,17.8625h81.3674l17.8628-17.8625V47.8628l-17.8628-17.8628Zm-7.9258,66.8c0,8.1028-6.5841,14.6895-14.6895,14.6895h-36.1304c-8.1027,0-14.6881-6.5867-14.6881-14.6895v-17.2222c0-8.1028,6.5854-14.6869,14.6881-14.6869h36.1304c8.1053,0,14.6895,6.5841,14.6895,14.6869v17.2222Z" fill="currentColor"/>' +
    '<path d="m512.1373,30h-81.3677l-17.8625,17.8628v81.3674l17.8625,17.8625h81.3677l17.8628-17.8628V47.8628l-17.8628-17.8628Zm-8.2642,47.058h-26.3379v34.4418h-12.1567v-34.4418h-26.3379v-12.1567h64.8325v12.1567Z" fill="currentColor"/>' +
    '<path d="m384.5016,30h-81.3674l-17.8628,17.8628v81.3674l17.8628,17.8625h81.3674l17.8628-17.8628V47.8628l-17.8628-17.8628Zm-34.604,81.4946h-12.1567v-46.5985h12.1567v46.5985Z" fill="currentColor"/>' +
    '</svg>';

  // ──────────────────────────────────────────────────────────────────────
  // Overlay (hardened — closed shadow DOM + MutationObserver + CSS blur)
  // ──────────────────────────────────────────────────────────────────────
  function injectWarning(signals, matchedSources, theme) {
    // Příznak že uživatel klikl na "Přesto vstoupit" / "Povolit 24 h" — overlay už nemá být znovu vkládán
    let dismissed = false;

    // ── 1) Vytvoříme HOST element (jen prázdný kontejner, vše uvnitř shadow DOM) ──
    const HOST_ID = '__boit_host';
    const BLUR_STYLE_ID = '__boit_blur_style';

    let host = document.createElement('div');
    host.id = HOST_ID;
    // Inline styling hostu jen jako fallback, primární layout řešíme uvnitř shadow DOM
    host.setAttribute('style', [
      'all: initial',
      'position: fixed',
      'inset: 0',
      'z-index: 2147483647',
      'pointer-events: auto'
    ].join(' !important;') + ' !important;');

    // ── 2) Closed Shadow DOM — stránka se dovnitř nedostane přes querySelector ──
    // Reference na shadow root držíme jen v closure, nikde nepřiřazujeme na host ani globál.
    const shadow = host.attachShadow({ mode: 'closed' });

    // CSS uvnitř shadow DOM
    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    // Backdrop (tmavé pozadí přes celou stránku) + karta
    const backdrop = document.createElement('div');
    backdrop.className = 'boit-backdrop';
    applyOverlayTheme(backdrop, theme);

    // Změna tématu v popupu se na otevřeném varování projeví hned.
    const onThemeChange = (changes, area) => {
      if (area === 'local' && changes[THEME_STORAGE_KEY]) {
        applyOverlayTheme(backdrop, changes[THEME_STORAGE_KEY].newValue);
      }
    };
    browser.storage.onChanged.addListener(onThemeChange);

    const card = document.createElement('div');
    card.className = 'boit-card';
    // Statický markup parsujeme přes DOMParser (lint-clean alternativa k innerHTML).
    // Žádný uživatelský vstup tu neprochází — CARD_MARKUP je konstanta v tomto souboru.
    card.appendChild(parseStaticHtml(CARD_MARKUP));
    backdrop.appendChild(card);
    shadow.appendChild(backdrop);

    // ── 3) Naplnění obsahu (vše přes interní reference, ne přes document.querySelector) ──
    const logoSlot = card.querySelector('.js-logo');
    if (logoSlot) logoSlot.appendChild(parseStaticSvg(BOIT_LOGO_SVG));

    setText(card.querySelector('.js-domain'), hostname);
    renderDescription(card.querySelector('.js-desc'), matchedSources);

    const signalList = card.querySelector('.js-signals');
    const signalsSection = card.querySelector('.js-signals-section');
    const detailsCount = card.querySelector('.js-details-count');

    if (signals && signals.length > 0 && signalList) {
      signals.forEach(s => {
        const row = document.createElement('div');
        row.className = 'boit-signal boit-signal--' + s.level;
        const dot = document.createElement('span');
        dot.className = 'boit-signal-dot';
        const txt = document.createElement('div');
        txt.className = 'boit-signal-text';
        const t = document.createElement('div');
        t.className = 'boit-signal-title';
        setText(t, s.title);
        const d = document.createElement('div');
        d.className = 'boit-signal-desc';
        setText(d, s.desc);
        txt.appendChild(t);
        txt.appendChild(d);
        row.appendChild(dot);
        row.appendChild(txt);
        signalList.appendChild(row);
      });
      if (detailsCount) setText(detailsCount, '+' + signals.length);
    } else {
      if (signalsSection) signalsSection.style.display = 'none';
      if (detailsCount) detailsCount.style.display = 'none';
    }

    // ── 4) Tlačítka — reference jen v closure, stránka se k nim nedostane ──
    const btnLeave   = card.querySelector('.js-btn-leave');
    const btnWhite   = card.querySelector('.js-btn-whitelist');
    const btnProceed = card.querySelector('.js-btn-proceed');
    const btnReport  = card.querySelector('.js-btn-report');

    // isTrusted check — ignorujeme syntetické click() z console / page scriptu
    const trustedHandler = (fn) => (ev) => {
      if (!ev || !ev.isTrusted) return;
      fn(ev);
    };

    btnLeave.addEventListener('click', trustedHandler(() => {
      try { history.back(); } catch (e) {}
      setTimeout(() => { try { window.close(); } catch (e) {} }, 200);
    }));

    btnProceed.addEventListener('click', trustedHandler(() => {
      dismissed = true;
      teardown();
    }));

    btnWhite.addEventListener('click', trustedHandler(() => {
      browser.runtime.sendMessage({ type: 'WHITELIST_ADD', hostname, hours: 24 })
        .catch(() => {})
        .finally(() => {
          dismissed = true;
          teardown();
        });
    }));

    btnReport.addEventListener('click', trustedHandler(() => {
      // Otevře stránku projektu s kontaktem. Doména ani zjištěné signály se
      // nikam neodesílají — v odkazu není žádný parametr.
      browser.runtime.sendMessage({ type: 'OPEN_REPORT_PAGE' })
        .then((res) => { if (!res || !res.ok) throw new Error('background_failed'); })
        .catch(() => { window.open(REPORT_PAGE_URL, '_blank', 'noopener'); });
    }));

    // ── 5) BLUR přes injektovaný <style> s !important ──
    // Stránka nemůže přepsat přes element.style; muselo by se přidávat vlastní pravidlo
    // s vyšší specificitou + !important, což je výrazně těžší než `style.filter = ''`.
    function buildBlurStyle() {
      const s = document.createElement('style');
      s.id = BLUR_STYLE_ID;
      s.textContent = [
        // Blur všech přímých dětí body kromě našeho hosta
        'body > *:not(#' + HOST_ID + ') {',
        '  filter: blur(8px) !important;',
        '  pointer-events: none !important;',
        '  user-select: none !important;',
        '  -webkit-user-select: none !important;',
        '}',
        // Skrytí scrollbaru
        'html, body {',
        '  overflow: hidden !important;',
        '}'
      ].join('\n');
      return s;
    }

    // ── 6) MutationObserver — chrání HOST i BLUR STYLE ──
    let observer = null;

    function ensureBlurStyle() {
      if (dismissed) return;
      if (!document.getElementById(BLUR_STYLE_ID)) {
        const target = document.head || document.documentElement;
        target.appendChild(buildBlurStyle());
      }
    }

    function ensureHost() {
      if (dismissed) return;
      // Pokud byl host smazaný / detached, vrátíme ho zpět
      if (!host.isConnected) {
        document.documentElement.appendChild(host);
      }
      // Pokud někdo nastavil display:none / visibility:hidden přes attribut style, přepíšeme
      // (style se nedá uvnitř closed shadow DOM zničit, ale host samotný má atribut style)
      const desired = host.getAttribute('data-boit-style');
      if (desired && host.getAttribute('style') !== desired) {
        host.setAttribute('style', desired);
      }
    }

    function startObserver() {
      // Sledujeme změny na <html> (přidávání/odebírání children) a na hostu (atributy)
      observer = new MutationObserver((mutations) => {
        if (dismissed) return;
        for (const m of mutations) {
          // Někdo odstranil host element nebo blur style
          if (m.type === 'childList') {
            ensureHost();
            ensureBlurStyle();
          }
          // Někdo změnil atribut style hostu (např. display:none)
          if (m.type === 'attributes' && m.target === host && m.attributeName === 'style') {
            ensureHost();
          }
        }
      });

      observer.observe(document.documentElement, { childList: true, subtree: true });
      observer.observe(host, { attributes: true, attributeFilter: ['style'] });
    }

    // Tear-down: spustí se jen při legitimním zavření přes tlačítka
    function teardown() {
      dismissed = true;
      try { observer && observer.disconnect(); } catch (e) {}
      try { browser.storage.onChanged.removeListener(onThemeChange); } catch (e) {}
      try { host.remove(); } catch (e) {}
      try {
        const bs = document.getElementById(BLUR_STYLE_ID);
        if (bs) bs.remove();
      } catch (e) {}
    }

    // ── 7) Append a uložení požadovaného stylu pro porovnání v observeru ──
    host.setAttribute('data-boit-style', host.getAttribute('style'));

    const append = () => {
      ensureBlurStyle();
      document.documentElement.appendChild(host);
      startObserver();
    };

    if (document.body) {
      append();
    } else {
      document.addEventListener('DOMContentLoaded', append, { once: true });
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Markup
  // ──────────────────────────────────────────────────────────────────────
  const CARD_MARKUP = [
    '<div class="boit-scanline"></div>',
    '<div class="boit-header">',
      '<div class="boit-logo js-logo"></div>',
      '<div class="boit-threat-pill">',
        '<div class="boit-dot"></div>',
        '<span>Detekována hrozba</span>',
      '</div>',
    '</div>',

    '<div class="boit-body">',
      '<div class="boit-eyebrow">BOIT · Rizikový web</div>',
      '<div class="boit-headline">Pozor. <span>Rizikový</span> web.</div>',
      '<div class="boit-domain-row">',
        '<span class="boit-arrow">→</span>',
        '<span class="boit-domain-val js-domain"></span>',
      '</div>',

      '<div class="boit-desc js-desc"></div>',

      '<div class="boit-actions">',
        '<button class="boit-btn-leave js-btn-leave" type="button">← Odejít (doporučeno)</button>',
        '<button class="boit-btn-proceed js-btn-proceed" type="button">Přesto vstoupit</button>',
      '</div>',

      '<details class="boit-details js-details">',
        '<summary class="boit-details-summary">',
          '<span class="boit-details-caret">›</span>',
          '<span class="boit-details-label">Více detailů</span>',
          '<span class="boit-details-count js-details-count"></span>',
        '</summary>',
        '<div class="boit-details-content">',

          '<div class="js-signals-section">',
            '<div class="boit-signals-label">Rizikové signály na stránce</div>',
            '<div class="boit-signals js-signals"></div>',
          '</div>',

          '<div class="boit-note">',
            'Zdroje: <span class="boit-link">coi.gov.cz</span>, <span class="boit-link">soi.sk</span>, <span class="boit-link">ctu.gov.cz</span> a seznam <span class="boit-link">BOIT</span> · pravidelně aktualizované. ',
            'Zařazení je varováním, nikoli zákazem. ',
            'Nahlášení domény i žádost o vyřazení: <span class="boit-link">doplnek@boit.cz</span>.',
          '</div>',

          '<div class="boit-actions-secondary">',
            '<button class="boit-btn-ghost js-btn-whitelist" type="button">↷ Povolit na 24 h</button>',
            '<button class="boit-btn-ghost js-btn-report" type="button">⚑ Nahlásit nebo odvolat</button>',
          '</div>',

        '</div>',
      '</details>',
    '</div>',

    '<div class="boit-footer">',
      '<div class="boit-footer-left">',
        '<div class="boit-hashtag">#BezpečnějšíČesko</div>',
        '<div class="boit-footer-sub">BOIT Cyber Security · boit.cz</div>',
      '</div>',
      '<div class="boit-footer-right">v1.11.0</div>',
    '</div>'
  ].join('');

  // ──────────────────────────────────────────────────────────────────────
  // Barevné tokeny overlaye — tmavý (výchozí) a světlý režim
  // Světlý režim se použije podle prohlížeče, při ruční volbě v popupu
  // a vždy při tisku. Každá paleta je definovaná jen jednou, CSS bloky se
  // z ní generují níže. Názvy mají prefix --boit-, protože custom properties
  // stránky pronikají přes hranici shadow DOM (all: initial je neresetuje).
  // ──────────────────────────────────────────────────────────────────────
  const OVERLAY_DARK_TOKENS = {
    'backdrop':        'rgba(0, 0, 0, 0.94)',
    'card':            '#0a0a0a',
    'card-animation':  'boitCardGlow 3s ease-in-out infinite',
    'card-shadow':     'none',
    'border':          '#313846',
    'divider':         '#181B20',
    'text':            '#D9DCE1',
    'text-dim':        '#A8B1C4',
    'text-mute':       '#5a6578',
    'domain':          '#ffffff',
    'logo':            '#D3FD22',
    'accent-text':     '#D3FD22',
    'marker':          'none',
    'scanline':        '#D3FD2266',
    'purple':          '#B44FE8',
    'cyan':            '#00F5FF',
    'yellow':          '#FFD600',
    'pink':            '#FF2D78',
    'pink-soft':       '#FF2D7815',
    'pink-border':     '#FF2D7844',
    'signal-bg':       '#181B20',
    'note-bg':         '#B44FE810',
    'leave-fill':      '#D3FD22',
    'leave-hover':     '#e0ff50',
    'on-leave':        '#0a0a0a',
    'proceed-text':    '#FF2D7899',
    'proceed-border':  '#FF2D7844',
    'proceed-hover':   '#FF2D78',
    'footer-sub':      '#5a5a5a',
    'version':         '#313846',
    'glow':            '1'
  };

  // Světlý režim: neonová zelená se v textu nahrazuje zvýrazňovačem (na bílé
  // by měla kontrast 1.18:1), "Odejít" je růžové a "Přesto vstoupit" neutrální,
  // aby vedle sebe nebyla dvě růžová tlačítka.
  const OVERLAY_LIGHT_TOKENS = {
    'backdrop':        'rgba(12, 14, 20, 0.78)',
    'card':            '#FFFFFF',
    'card-animation':  'none',
    'card-shadow':     '0 0 0 1px #C4104F55, 0 12px 40px rgba(0, 0, 0, 0.25)',
    'border':          '#D4D9E1',
    'divider':         '#E8EBF0',
    'text':            '#11141A',
    'text-dim':        '#3D4556',
    'text-mute':       '#5F6778',
    'domain':          '#11141A',
    'logo':            '#11141A',
    'accent-text':     '#11141A',
    'marker':          'linear-gradient(transparent 55%, #D3FD22 55%, #D3FD22 92%, transparent 92%)',
    'scanline':        '#D3FD22',
    'purple':          '#7A22B5',
    'cyan':            '#006B75',
    'yellow':          '#7A5A00',
    'pink':            '#C4104F',
    'pink-soft':       '#C4104F0f',
    'pink-border':     '#C4104F55',
    'signal-bg':       '#F3F4F7',
    'note-bg':         '#7A22B50d',
    'leave-fill':      '#FF2D78',
    'leave-hover':     '#ff4a8b',
    'on-leave':        '#000000',
    'proceed-text':    '#5F6778',
    'proceed-border':  '#D4D9E1',
    'proceed-hover':   '#11141A',
    'footer-sub':      '#5F6778',
    'version':         '#8a92a3',
    'glow':            '0'
  };

  /** Převede paletu na deklarace custom properties. */
  function tokenDeclarations(tokens) {
    return Object.keys(tokens).map(name => '  --boit-' + name + ': ' + tokens[name] + ';').join('\n');
  }

  // ──────────────────────────────────────────────────────────────────────
  // CSS — barvy vyvážené: zelená = brand, růžová JEN pro threat, fialová = akcenty
  // ──────────────────────────────────────────────────────────────────────
  const CSS = [
    // Uvnitř shadow DOM — žádný :host wrap, vše stylujeme přímo
    '* {',
    '  box-sizing: border-box;',
    '  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
    '}',

    // ── TÉMA ── tmavý základ, světlý podle prohlížeče (pokud uživatel nevybral
    // ručně tmavý), podle ruční volby a při tisku
    '.boit-backdrop {',
    tokenDeclarations(OVERLAY_DARK_TOKENS),
    '}',
    '@media (prefers-color-scheme: light) {',
    '  .boit-backdrop:not([data-theme="dark"]) {',
    tokenDeclarations(OVERLAY_LIGHT_TOKENS),
    '  }',
    '}',
    '.boit-backdrop[data-theme="light"] {',
    tokenDeclarations(OVERLAY_LIGHT_TOKENS),
    '}',
    '@media print {',
    '  .boit-backdrop {',
    tokenDeclarations(OVERLAY_LIGHT_TOKENS),
    '    --boit-backdrop: #FFFFFF;',
    '  }',
    '  .boit-scanline { display: none; }',
    '}',

    '.boit-backdrop {',
    '  position: fixed; inset: 0; z-index: 2147483647;',
    '  display: flex; align-items: center; justify-content: center;',
    '  background: var(--boit-backdrop); padding: 20px;',
    '  overflow: auto;',
    '  animation: boitFadeIn 0.25s ease;',
    '}',
    '@keyframes boitFadeIn {',
    '  from { opacity: 0; transform: scale(0.98); }',
    '  to   { opacity: 1; transform: scale(1); }',
    '}',
    '@keyframes boitScan {',
    '  0%   { transform: translateY(-4px); opacity: 0.6; }',
    '  100% { transform: translateY(100vh); opacity: 0.2; }',
    '}',
    // Pulzující glow jen v tmavém režimu (ve světlém je card-animation: none)
    '@keyframes boitCardGlow {',
    '  0%,100% { box-shadow: 0 0 0 1px #313846, 0 0 30px #FF2D7822; }',
    '  50%     { box-shadow: 0 0 0 1px #FF2D7855, 0 0 40px #FF2D7844; }',
    '}',
    '@keyframes boitDotBlink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }',

    // ── KARTA ── brand neutral (šedivý border), pulse glow jen decentní růžová
    '.boit-card {',
    '  background: var(--boit-card); border: 1px solid var(--boit-border);',
    '  max-width: 580px; width: 100%;',
    '  position: relative; overflow: hidden;',
    '  box-shadow: var(--boit-card-shadow);',
    '  animation: var(--boit-card-animation);',
    '}',
    '.boit-scanline {',
    '  position: absolute; top: 0; left: 0; right: 0; height: 2px;',
    '  background: linear-gradient(90deg, transparent, var(--boit-scanline), transparent);',
    '  animation: boitScan 4s linear infinite; pointer-events: none; z-index: 10;',
    '}',

    // ── HEADER ── BOIT logo, pill pravá strana růžová (jen threat indikátor)
    '.boit-header {',
    '  padding: 14px 22px; border-bottom: 1px solid var(--boit-divider);',
    '  display: flex; align-items: center; justify-content: space-between; gap: 16px;',
    '}',
    '.boit-logo { color: var(--boit-logo); display: flex; align-items: center; }',
    '.boit-logo svg { height: 20px; width: auto; display: block; }',
    '.boit-threat-pill {',
    '  display: flex; align-items: center; gap: 7px;',
    '  background: var(--boit-pink-soft); border: 1px solid var(--boit-pink-border);',
    '  padding: 5px 10px; font-size: 9px; font-weight: 700;',
    '  color: var(--boit-pink); letter-spacing: 0.18em; text-transform: uppercase;',
    '  white-space: nowrap;',
    '}',
    '.boit-dot {',
    '  width: 6px; height: 6px; border-radius: 50%; background: var(--boit-pink);',
    '  box-shadow: 0 0 calc(6px * var(--boit-glow)) var(--boit-pink);',
    '  animation: boitDotBlink 1s step-end infinite;',
    '}',

    // ── BODY ──
    '.boit-body { padding: 20px 22px 18px; }',

    // Eyebrow fialová (akcent)
    '.boit-eyebrow {',
    '  font-size: 9px; font-weight: 700; color: var(--boit-purple);',
    '  letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 10px;',
    '}',

    // Headline: text + růžový akcent na slově "Rizikový"
    '.boit-headline {',
    '  font-weight: 800; font-size: 28px; line-height: 1.1;',
    '  color: var(--boit-text); margin-bottom: 6px;',
    '}',
    '.boit-headline span { color: var(--boit-pink); }',

    // Doména: šipka cyan, hodnota výrazně
    '.boit-domain-row {',
    '  font-size: 12px; color: var(--boit-text-dim); margin-bottom: 14px;',
    '  display: flex; align-items: center; gap: 8px;',
    '}',
    '.boit-arrow { color: var(--boit-cyan); font-weight: 700; }',
    '.boit-domain-val { color: var(--boit-domain); font-weight: 700; word-break: break-all; }',

    '.boit-desc { font-size: 12px; color: var(--boit-text-dim); line-height: 1.6; margin-bottom: 16px; }',
    '.boit-desc strong {',
    '  color: var(--boit-accent-text); font-weight: 700;',
    '  background: var(--boit-marker); padding: 0 2px; margin: 0 -2px;',
    '  -webkit-box-decoration-break: clone; box-decoration-break: clone;',
    '}',

    // ── DETAILS (rozbalovací sekce) ──
    '.boit-details {',
    '  margin-top: 14px;',
    '  border-top: 1px solid var(--boit-divider);',
    '  padding-top: 12px;',
    '}',
    '.boit-details[open] {',
    '  border-top-color: var(--boit-border);',
    '}',
    '.boit-details-summary {',
    '  display: flex; align-items: center; gap: 8px;',
    '  padding: 6px 0; cursor: pointer;',
    '  font-size: 10px; font-weight: 700;',
    '  color: var(--boit-text-dim); letter-spacing: 0.15em;',
    '  text-transform: uppercase;',
    '  list-style: none;',
    '  user-select: none;',
    '  transition: color 0.15s;',
    '}',
    'summary.boit-details-summary { display: flex; }',
    '.boit-details-summary::-webkit-details-marker { display: none; }',
    '.boit-details-summary:hover { color: var(--boit-accent-text); }',
    '.boit-details-caret {',
    '  color: var(--boit-text-mute); font-size: 14px; line-height: 1;',
    '  transition: transform 0.2s, color 0.15s;',
    '  display: inline-block;',
    '}',
    '.boit-details[open] .boit-details-caret {',
    '  transform: rotate(90deg); color: var(--boit-accent-text);',
    '}',
    '.boit-details-summary:hover .boit-details-caret { color: var(--boit-accent-text); }',
    '.boit-details-label { flex: 1; }',
    '.boit-details-count {',
    '  color: var(--boit-pink); font-weight: 700;',
    '  letter-spacing: 0.1em;',
    '  padding: 2px 7px;',
    '  border: 1px solid var(--boit-pink-border);',
    '  background: var(--boit-pink-soft);',
    '  font-size: 9px;',
    '}',
    '.boit-details-content {',
    '  padding-top: 14px;',
    '  animation: boitSlideDown 0.2s ease;',
    '}',
    '@keyframes boitSlideDown {',
    '  from { opacity: 0; transform: translateY(-4px); }',
    '  to   { opacity: 1; transform: translateY(0); }',
    '}',

    // Signals sekce
    '.boit-signals-label {',
    '  font-size: 9px; color: var(--boit-purple); letter-spacing: 0.2em;',
    '  text-transform: uppercase; margin-bottom: 8px; font-weight: 700;',
    '}',
    '.boit-signals { margin-bottom: 14px; }',
    '.boit-signal {',
    '  display: flex; gap: 10px; padding: 8px 12px;',
    '  border-left: 2px solid; margin-bottom: 3px;',
    '  background: var(--boit-signal-bg);',
    '}',
    '.boit-signal--high { border-left-color: var(--boit-pink); }',
    '.boit-signal--mid  { border-left-color: var(--boit-yellow); }',
    '.boit-signal--low  { border-left-color: var(--boit-cyan); }',
    '.boit-signal-dot { width: 6px; height: 6px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }',
    '.boit-signal--high .boit-signal-dot { background: var(--boit-pink); box-shadow: 0 0 calc(5px * var(--boit-glow)) var(--boit-pink); }',
    '.boit-signal--mid  .boit-signal-dot { background: var(--boit-yellow); box-shadow: 0 0 calc(5px * var(--boit-glow)) var(--boit-yellow); }',
    '.boit-signal--low  .boit-signal-dot { background: var(--boit-cyan); box-shadow: 0 0 calc(5px * var(--boit-glow)) var(--boit-cyan); }',
    '.boit-signal-title { font-size: 11px; font-weight: 700; color: var(--boit-text); margin-bottom: 2px; }',
    '.boit-signal-desc  { font-size: 10px; color: var(--boit-text-dim); line-height: 1.5; }',

    // Note box — fialový akcent
    '.boit-note {',
    '  font-size: 10px; color: var(--boit-text-dim); line-height: 1.6;',
    '  padding: 9px 13px; border-left: 2px solid var(--boit-purple);',
    '  background: var(--boit-note-bg); margin-bottom: 14px;',
    '}',
    '.boit-link { color: var(--boit-cyan); }',

    // ── TLAČÍTKA ──
    '.boit-actions { display: flex; gap: 8px; margin-bottom: 0; }',
    '.boit-actions-secondary { display: flex; gap: 8px; margin-top: 4px; }',

    // Leave = hlavní CTA (tmavý: zelená, světlý: růžová)
    '.boit-btn-leave {',
    '  flex: 1; background: var(--boit-leave-fill); color: var(--boit-on-leave); border: none;',
    '  padding: 13px 16px; font-family: inherit;',
    '  font-weight: 700; font-size: 12px; letter-spacing: 0.06em;',
    '  cursor: pointer; text-transform: uppercase; transition: all 0.15s;',
    '}',
    '.boit-btn-leave:hover { background: var(--boit-leave-hover); transform: translateY(-1px); }',

    // Proceed = nebezpečné = tlumený outline
    '.boit-btn-proceed {',
    '  flex: 1; background: transparent; color: var(--boit-proceed-text); border: 1px solid var(--boit-proceed-border);',
    '  padding: 13px 16px; font-family: inherit;',
    '  font-size: 10px; letter-spacing: 0.06em;',
    '  cursor: pointer; text-transform: uppercase; transition: all 0.15s;',
    '}',
    '.boit-btn-proceed:hover { color: var(--boit-proceed-hover); border-color: var(--boit-proceed-hover); }',

    // Ghost buttons — neutral, na hover se přebarví na fialovou
    '.boit-btn-ghost {',
    '  flex: 1; background: transparent; color: var(--boit-text-dim); border: 1px solid var(--boit-border);',
    '  padding: 10px 10px; font-family: inherit;',
    '  font-size: 9px; letter-spacing: 0.1em;',
    '  cursor: pointer; text-transform: uppercase; transition: all 0.15s;',
    '}',
    '.boit-btn-ghost:hover { color: var(--boit-purple); border-color: var(--boit-purple); }',

    // ── FOOTER ── hashtag v brandu (tmavý: zelený text, světlý: zvýrazňovač)
    '.boit-footer {',
    '  padding: 14px 22px; border-top: 1px solid var(--boit-divider);',
    '  display: flex; align-items: center; justify-content: space-between; gap: 16px;',
    '}',
    '.boit-footer-left { display: flex; flex-direction: column; gap: 3px; min-width: 0; }',
    '.boit-hashtag {',
    '  align-self: flex-start;',
    '  font-size: 12px; font-weight: 800; color: var(--boit-accent-text);',
    '  letter-spacing: 0.02em;',
    '  background: var(--boit-marker); padding: 0 2px; margin: 0 -2px;',
    '}',
    '.boit-footer-sub {',
    '  font-size: 9px; color: var(--boit-footer-sub); letter-spacing: 0.06em;',
    '}',
    '.boit-footer-right { font-size: 9px; color: var(--boit-version); letter-spacing: 0.1em; white-space: nowrap; }'
  ].join('\n');
})();
