'use strict';

let currentHostname = '';
let currentCheck = null;

function formatAge(ms) {
  if (ms == null) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 1) return '<1m';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

function formatUntil(ts) {
  if (!ts) return 'napořád';
  const ms = ts - Date.now();
  if (ms <= 0) return 'vypršelo';
  return 'ještě ' + formatAge(ms);
}

function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(text == null ? '' : text);
}

function sendMessage(msg) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(res || null);
    });
  });
}

async function getCurrentHostname() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith('http')) return '';
    const u = new URL(tab.url);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) {
    return '';
  }
}

async function loadWhitelist() {
  const res = await sendMessage({ type: 'WHITELIST_GET' });
  const items = res?.items || [];
  const list = document.getElementById('whitelistList');
  const empty = document.getElementById('whitelistEmpty');

  if (!list || !empty) return;
  list.textContent = '';

  if (!items.length) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'whitelist-item';

    const meta = document.createElement('div');
    meta.className = 'whitelist-meta';

    const host = document.createElement('div');
    host.className = 'whitelist-host';
    host.textContent = item.hostname;

    const until = document.createElement('div');
    until.className = 'whitelist-until';
    until.textContent = formatUntil(item.until);

    const btn = document.createElement('button');
    btn.className = 'whitelist-remove';
    btn.type = 'button';
    btn.textContent = 'odebrat';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await sendMessage({ type: 'WHITELIST_REMOVE', hostname: item.hostname });
      await init();
    });

    meta.appendChild(host);
    meta.appendChild(until);
    row.appendChild(meta);
    row.appendChild(btn);
    list.appendChild(row);
  });
}

function updateWhitelistControls() {
  const addBtn = document.getElementById('whitelistAddBtn');
  const removeBtn = document.getElementById('whitelistRemoveBtn');
  const note = document.getElementById('whitelistNote');

  const whitelisted = !!currentCheck?.whitelisted;
  const risky = !!currentCheck?.isRisky;
  const hasHost = !!currentHostname;

  if (addBtn) addBtn.style.display = hasHost && risky && !whitelisted ? 'flex' : 'none';
  if (removeBtn) removeBtn.style.display = hasHost && whitelisted ? 'flex' : 'none';

  if (note) {
    if (!hasHost) note.textContent = 'Whitelist se používá jen pro běžné webové stránky.';
    else if (whitelisted) note.textContent = 'Tahle doména je teď povolená. Odebráním se znovu začne blokovat, pokud je na seznamu ČOI.';
    else if (risky) note.textContent = 'Rizikovou doménu můžeš dočasně povolit na 24 hodin.';
    else note.textContent = 'Aktuální doména není riziková. Níže najdeš ručně povolené domény.';
  }
}

async function init() {
  currentHostname = await getCurrentHostname();
  currentCheck = null;

  safeSetText('siteDomain', currentHostname || '(žádná URL)');

  const status = await sendMessage({ type: 'GET_STATUS' });
  if (status) {
    safeSetText('domainCount', status.domainCount || '0');
    safeSetText('cacheAge', formatAge(status.cacheAge));

    const dot = document.getElementById('statusDot');
    if (status.domainCount > 0 && dot) {
      dot.classList.add('active');
      safeSetText('statusLabel', 'aktivní');
    } else {
      safeSetText('statusLabel', 'načítám');
    }
  }

  const stats = await sendMessage({ type: 'GET_STATS' });
  if (stats) {
    safeSetText('statBlocks', (stats.totalBlocks || 0) + '×');
    safeSetText('statUnique', stats.uniqueDomains || 0);
  }

  if (currentHostname) {
    const res = await sendMessage({ type: 'CHECK_DOMAIN', hostname: currentHostname });
    if (res) {
      currentCheck = res;
      const statusEl = document.getElementById('siteStatus');
      if (res.isRisky && !res.whitelisted) {
        statusEl.className = 'site-status risky';
        safeSetText('siteStatusText', '⚠ RIZIKOVÝ E-SHOP (dle ČOI)');
        document.body.classList.add('risky');
      } else if (res.isRisky && res.whitelisted) {
        statusEl.className = 'site-status whitelisted';
        safeSetText('siteStatusText', '↷ Rizikový, ale povolený uživatelem');
        document.body.classList.remove('risky');
      } else {
        statusEl.className = 'site-status safe';
        safeSetText('siteStatusText', '✓ Není na seznamu ČOI');
        document.body.classList.remove('risky');
      }
    }
  } else {
    const statusEl = document.getElementById('siteStatus');
    if (statusEl) statusEl.className = 'site-status';
    safeSetText('siteStatusText', 'Nelze zkontrolovat');
    document.body.classList.remove('risky');
  }

  updateWhitelistControls();
  await loadWhitelist();
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('refreshBtn').addEventListener('click', () => {
    const btn = document.getElementById('refreshBtn');
    btn.textContent = '↺  Aktualizuji...';
    btn.disabled = true;
    chrome.runtime.sendMessage({ type: 'FORCE_REFRESH' }, () => {
      setTimeout(() => {
        btn.textContent = '↺  Aktualizovat seznam';
        btn.disabled = false;
        init();
      }, 2500);
    });
  });

  document.getElementById('openCoiBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/' });
  });

  document.getElementById('whitelistAddBtn').addEventListener('click', async () => {
    if (!currentHostname) return;
    await sendMessage({ type: 'WHITELIST_ADD', hostname: currentHostname, hours: 24 });
    await init();
  });

  document.getElementById('whitelistRemoveBtn').addEventListener('click', async () => {
    if (!currentHostname) return;
    await sendMessage({ type: 'WHITELIST_REMOVE', hostname: currentHostname });
    await init();
  });

  document.getElementById('boitLink').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://boit.cz' });
  });
});
