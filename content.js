/**
 * BOIT Rizikové E-shopy — content script
 * Detekuje rizikové e-shopy dle ČOI a zobrazí varování v BOIT brandu.
 */
(function () {
  'use strict';

  if (window.__boitChecked) return;
  window.__boitChecked = true;

  const hostname = (location.hostname || '').toLowerCase().replace(/^www\./, '');
  if (!hostname || !hostname.includes('.')) return;

  const setText = (el, text) => { if (el) el.textContent = String(text == null ? '' : text); };

  chrome.runtime.sendMessage({ type: 'CHECK_DOMAIN', hostname }, (response) => {
    if (chrome.runtime.lastError || !response) return;
    if (response.isRisky && !response.whitelisted) {
      const signals = detectRiskSignals();
      chrome.runtime.sendMessage({ type: 'RECORD_BLOCK', hostname });
      injectWarning(signals);
    }
  });

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
  function injectWarning(signals) {
    // Příznak že uživatel klikl na "Přesto vstoupit" / "Povolit 24 h" — overlay už nemá být znovu vkládán
    let dismissed = false;

    // ── 1) Vytvoříme HOST element (jen prázdný kontejner, vše uvnitř shadow DOM) ──
    const HOST_ID = '__boit_host';
    const BLUR_STYLE_ID = '__boit_blur_style';
    const DESIRED_HOST_STYLE = [
      'all: initial',
      'position: fixed',
      'inset: 0',
      'z-index: 2147483647',
      'pointer-events: auto'
    ].join(' !important;') + ' !important;';

    let host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('style', DESIRED_HOST_STYLE);

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

    const card = document.createElement('div');
    card.className = 'boit-card';
    card.innerHTML = CARD_MARKUP;
    backdrop.appendChild(card);
    shadow.appendChild(backdrop);

    // ── 3) Naplnění obsahu (vše přes interní reference, ne přes document.querySelector) ──
    const logoSlot = card.querySelector('.js-logo');
    if (logoSlot) logoSlot.innerHTML = BOIT_LOGO_SVG;

    setText(card.querySelector('.js-domain'), hostname);

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
      chrome.runtime.sendMessage({ type: 'WHITELIST_ADD', hostname, hours: 24 }, () => {
        dismissed = true;
        teardown();
      });
    }));

    btnReport.addEventListener('click', trustedHandler(() => {
      chrome.runtime.sendMessage({
        type: 'REPORT_COI',
        hostname,
        signals: (signals || []).map(s => ({ title: s.title }))
      }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) {
          const subject = encodeURIComponent('Podezřelý e-shop: ' + hostname);
          const body = encodeURIComponent(
            'Dobrý den,\n\n' +
            'rád bych upozornil na podezřelý e-shop: https://' + hostname + '\n\n' +
            'Zjištěná rizika:\n' +
            ((signals && signals.length) ? signals.map(s => '- ' + s.title).join('\n') : '(žádná automatická detekce)') +
            '\n\nDěkuji.'
          );
          window.open('mailto:podatelna@coi.gov.cz?subject=' + subject + '&body=' + body, '_blank', 'noopener');
        }
      });
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
      if (host.getAttribute('style') !== DESIRED_HOST_STYLE) {
        host.setAttribute('style', DESIRED_HOST_STYLE);
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
      try { host.remove(); } catch (e) {}
      try {
        const bs = document.getElementById(BLUR_STYLE_ID);
        if (bs) bs.remove();
      } catch (e) {}
    }

    // ── 7) Append ──

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
      '<div class="boit-eyebrow">ČOI · Rizikový e-shop</div>',
      '<div class="boit-headline">Pozor. <span>Podvodný</span> web.</div>',
      '<div class="boit-domain-row">',
        '<span class="boit-arrow">→</span>',
        '<span class="boit-domain-val js-domain"></span>',
      '</div>',

      '<div class="boit-desc">',
        'Tato doména je v oficiálním seznamu <strong>České obchodní inspekce</strong>. ',
        'Provozovatel není ověřitelný nebo neplní zákonné povinnosti.',
      '</div>',

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
            'Zdroj: <span class="boit-link">coi.gov.cz/rizikove-e-shopy</span> · pravidelně aktualizováno ČOI. ',
            'Zařazení je varováním, nikoli zákazem.',
          '</div>',

          '<div class="boit-actions-secondary">',
            '<button class="boit-btn-ghost js-btn-whitelist" type="button">↷ Povolit na 24 h</button>',
            '<button class="boit-btn-ghost js-btn-report" type="button">⚑ Nahlásit ČOI</button>',
          '</div>',

        '</div>',
      '</details>',
    '</div>',

    '<div class="boit-footer">',
      '<div class="boit-footer-left">',
        '<div class="boit-hashtag">#DělámeČeskoBezpečnější</div>',
        '<div class="boit-footer-sub">BOIT Cyber Security · boit.cz/nastroje/podvodne-weby</div>',
      '</div>',
      '<div class="boit-footer-right">v1.6.3</div>',
    '</div>'
  ].join('');

  // ──────────────────────────────────────────────────────────────────────
  // CSS — barvy vyvážené: zelená = brand, růžová JEN pro threat, fialová = akcenty
  // ──────────────────────────────────────────────────────────────────────
  const CSS = [
    // Uvnitř shadow DOM — žádný :host wrap, vše stylujeme přímo
    '* {',
    '  box-sizing: border-box;',
    '  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
    '}',
    '.boit-backdrop {',
    '  position: fixed; inset: 0; z-index: 2147483647;',
    '  display: flex; align-items: center; justify-content: center;',
    '  background: rgba(0, 0, 0, 0.94); padding: 20px;',
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
    '@keyframes boitCardGlow {',
    '  0%,100% { box-shadow: 0 0 0 1px #313846, 0 0 30px #FF2D7822; }',
    '  50%     { box-shadow: 0 0 0 1px #FF2D7855, 0 0 40px #FF2D7844; }',
    '}',
    '@keyframes boitDotBlink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }',

    // ── KARTA ── brand neutral (šedivý border), pulse glow jen decentní růžová
    '.boit-card {',
    '  background: #0a0a0a; border: 1px solid #313846;',
    '  max-width: 580px; width: 100%;',
    '  position: relative; overflow: hidden;',
    '  animation: boitCardGlow 3s ease-in-out infinite;',
    '}',
    '.boit-scanline {',
    '  position: absolute; top: 0; left: 0; right: 0; height: 2px;',
    '  background: linear-gradient(90deg, transparent, #D3FD2266, transparent);',
    '  animation: boitScan 4s linear infinite; pointer-events: none; z-index: 10;',
    '}',

    // ── HEADER ── BOIT logo zeleně, pill pravá strana růžová (jen threat indikátor)
    '.boit-header {',
    '  padding: 14px 22px; border-bottom: 1px solid #181B20;',
    '  display: flex; align-items: center; justify-content: space-between; gap: 16px;',
    '}',
    '.boit-logo { color: #D3FD22; display: flex; align-items: center; }',
    '.boit-logo svg { height: 20px; width: auto; display: block; }',
    '.boit-threat-pill {',
    '  display: flex; align-items: center; gap: 7px;',
    '  background: #FF2D7815; border: 1px solid #FF2D7844;',
    '  padding: 5px 10px; font-size: 9px; font-weight: 700;',
    '  color: #FF2D78; letter-spacing: 0.18em; text-transform: uppercase;',
    '  white-space: nowrap;',
    '}',
    '.boit-dot {',
    '  width: 6px; height: 6px; border-radius: 50%; background: #FF2D78;',
    '  box-shadow: 0 0 6px #FF2D78;',
    '  animation: boitDotBlink 1s step-end infinite;',
    '}',

    // ── BODY ──
    '.boit-body { padding: 20px 22px 18px; }',

    // Eyebrow fialová (akcent)
    '.boit-eyebrow {',
    '  font-size: 9px; font-weight: 700; color: #B44FE8;',
    '  letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 10px;',
    '}',

    // Headline: bílá + růžový akcent na slově "Podvodný"
    '.boit-headline {',
    '  font-weight: 800; font-size: 28px; line-height: 1.1;',
    '  color: #D9DCE1; margin-bottom: 6px;',
    '}',
    '.boit-headline span { color: #FF2D78; }',

    // Doména: šipka cyan, hodnota bílá
    '.boit-domain-row {',
    '  font-size: 12px; color: #A8B1C4; margin-bottom: 14px;',
    '  display: flex; align-items: center; gap: 8px;',
    '}',
    '.boit-arrow { color: #00F5FF; font-weight: 700; }',
    '.boit-domain-val { color: #fff; font-weight: 700; word-break: break-all; }',

    '.boit-desc { font-size: 12px; color: #A8B1C4; line-height: 1.6; margin-bottom: 16px; }',
    '.boit-desc strong { color: #D3FD22; font-weight: 700; }',

    // ── DETAILS (rozbalovací sekce) ──
    '.boit-details {',
    '  margin-top: 14px;',
    '  border-top: 1px solid #181B20;',
    '  padding-top: 12px;',
    '}',
    '.boit-details[open] {',
    '  border-top-color: #313846;',
    '}',
    '.boit-details-summary {',
    '  display: flex; align-items: center; gap: 8px;',
    '  padding: 6px 0; cursor: pointer;',
    '  font-size: 10px; font-weight: 700;',
    '  color: #A8B1C4; letter-spacing: 0.15em;',
    '  text-transform: uppercase;',
    '  list-style: none;',
    '  user-select: none;',
    '  transition: color 0.15s;',
    '}',
    'summary.boit-details-summary { display: flex; }',
    '.boit-details-summary::-webkit-details-marker { display: none; }',
    '.boit-details-summary:hover { color: #D3FD22; }',
    '.boit-details-caret {',
    '  color: #5a6578; font-size: 14px; line-height: 1;',
    '  transition: transform 0.2s, color 0.15s;',
    '  display: inline-block;',
    '}',
    '.boit-details[open] .boit-details-caret {',
    '  transform: rotate(90deg); color: #D3FD22;',
    '}',
    '.boit-details-summary:hover .boit-details-caret { color: #D3FD22; }',
    '.boit-details-label { flex: 1; }',
    '.boit-details-count {',
    '  color: #FF2D78; font-weight: 700;',
    '  letter-spacing: 0.1em;',
    '  padding: 2px 7px;',
    '  border: 1px solid #FF2D7844;',
    '  background: #FF2D7815;',
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
    '  font-size: 9px; color: #B44FE8; letter-spacing: 0.2em;',
    '  text-transform: uppercase; margin-bottom: 8px; font-weight: 700;',
    '}',
    '.boit-signals { margin-bottom: 14px; }',
    '.boit-signal {',
    '  display: flex; gap: 10px; padding: 8px 12px;',
    '  border-left: 2px solid; margin-bottom: 3px;',
    '  background: #181B20;',
    '}',
    '.boit-signal--high { border-left-color: #FF2D78; }',
    '.boit-signal--mid  { border-left-color: #FFD600; }',
    '.boit-signal--low  { border-left-color: #00F5FF; }',
    '.boit-signal-dot { width: 6px; height: 6px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }',
    '.boit-signal--high .boit-signal-dot { background: #FF2D78; box-shadow: 0 0 5px #FF2D78; }',
    '.boit-signal--mid  .boit-signal-dot { background: #FFD600; box-shadow: 0 0 5px #FFD600; }',
    '.boit-signal--low  .boit-signal-dot { background: #00F5FF; box-shadow: 0 0 5px #00F5FF; }',
    '.boit-signal-title { font-size: 11px; font-weight: 700; color: #D9DCE1; margin-bottom: 2px; }',
    '.boit-signal-desc  { font-size: 10px; color: #A8B1C4; line-height: 1.5; }',

    // Note box — fialový akcent
    '.boit-note {',
    '  font-size: 10px; color: #A8B1C4; line-height: 1.6;',
    '  padding: 9px 13px; border-left: 2px solid #B44FE8;',
    '  background: #B44FE810; margin-bottom: 14px;',
    '}',
    '.boit-link { color: #00F5FF; }',

    // ── TLAČÍTKA ──
    '.boit-actions { display: flex; gap: 8px; margin-bottom: 0; }',
    '.boit-actions-secondary { display: flex; gap: 8px; margin-top: 4px; }',

    // Leave = hlavní CTA ZELENĚ (to je "dobrá" akce — odejít)
    '.boit-btn-leave {',
    '  flex: 1; background: #D3FD22; color: #0a0a0a; border: none;',
    '  padding: 13px 16px; font-family: inherit;',
    '  font-weight: 700; font-size: 12px; letter-spacing: 0.06em;',
    '  cursor: pointer; text-transform: uppercase; transition: all 0.15s;',
    '}',
    '.boit-btn-leave:hover { background: #e0ff50; transform: translateY(-1px); }',

    // Proceed = nebezpečné = tlumeně červená/růžová outline
    '.boit-btn-proceed {',
    '  flex: 1; background: transparent; color: #FF2D7899; border: 1px solid #FF2D7844;',
    '  padding: 13px 16px; font-family: inherit;',
    '  font-size: 10px; letter-spacing: 0.06em;',
    '  cursor: pointer; text-transform: uppercase; transition: all 0.15s;',
    '}',
    '.boit-btn-proceed:hover { color: #FF2D78; border-color: #FF2D78; }',

    // Ghost buttons — neutral, na hover se přebarví na fialovou
    '.boit-btn-ghost {',
    '  flex: 1; background: transparent; color: #A8B1C4; border: 1px solid #313846;',
    '  padding: 10px 10px; font-family: inherit;',
    '  font-size: 9px; letter-spacing: 0.1em;',
    '  cursor: pointer; text-transform: uppercase; transition: all 0.15s;',
    '}',
    '.boit-btn-ghost:hover { color: #B44FE8; border-color: #B44FE8; }',

    // ── FOOTER ── hashtag zeleně (brand), sub info šedě
    '.boit-footer {',
    '  padding: 14px 22px; border-top: 1px solid #181B20;',
    '  display: flex; align-items: center; justify-content: space-between; gap: 16px;',
    '}',
    '.boit-footer-left { display: flex; flex-direction: column; gap: 3px; min-width: 0; }',
    '.boit-hashtag {',
    '  font-size: 12px; font-weight: 800; color: #D3FD22;',
    '  letter-spacing: 0.02em;',
    '}',
    '.boit-footer-sub {',
    '  font-size: 9px; color: #5a5a5a; letter-spacing: 0.06em;',
    '}',
    '.boit-footer-right { font-size: 9px; color: #313846; letter-spacing: 0.1em; white-space: nowrap; }'
  ].join('\n');
})();
