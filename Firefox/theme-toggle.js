'use strict';

/**
 * Přepínač barevného tématu v hlavičce popupu: Auto / Světlý / Tmavý.
 *
 * Zdroj pravdy je storage.local — čte ho i varovací overlay v content.js.
 * localStorage je jen synchronní kopie pro theme-init.js, aby ručně zvolené
 * téma při otevření popupu neprobliklo.
 */
(function () {
  const THEME_STORAGE_KEY = 'boit_ui_theme';
  const THEME_VALUES = ['auto', 'light', 'dark'];
  const ARROW_STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

  function normalizeTheme(value) {
    return THEME_VALUES.includes(value) ? value : 'auto';
  }

  /** Nastaví téma na <html> a aktualizuje synchronní kopii pro theme-init.js. */
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;

    try {
      if (theme === 'auto') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      // Bez localStorage jen může ručně zvolené téma při otevření probliknout.
    }
  }

  /** Radio skupina: zaškrtnutá volba je jediná, na kterou jde Tab. */
  function renderSwitch(options, theme) {
    for (const option of options) {
      const checked = option.dataset.themeValue === theme;
      option.setAttribute('aria-checked', String(checked));
      option.tabIndex = checked ? 0 : -1;
    }
  }

  async function readStoredTheme() {
    try {
      const stored = await browser.storage.local.get([THEME_STORAGE_KEY]);
      return normalizeTheme(stored[THEME_STORAGE_KEY]);
    } catch (e) {
      return 'auto';
    }
  }

  async function saveTheme(theme) {
    try {
      await browser.storage.local.set({ [THEME_STORAGE_KEY]: theme });
    } catch (e) {
      // Volba platí aspoň do zavření popupu.
    }
  }

  async function initThemeSwitch() {
    const group = document.getElementById('themeSwitch');
    if (!group) return;

    const options = Array.from(group.querySelectorAll('[data-theme-value]'));
    let current = await readStoredTheme();
    applyTheme(current);
    renderSwitch(options, current);

    function select(theme, { focus = false } = {}) {
      current = normalizeTheme(theme);
      applyTheme(current);
      renderSwitch(options, current);
      saveTheme(current);
      if (focus) {
        const selected = options.find(option => option.dataset.themeValue === current);
        if (selected) selected.focus();
      }
    }

    group.addEventListener('click', (event) => {
      const option = event.target.closest('[data-theme-value]');
      if (option) select(option.dataset.themeValue);
    });

    // Šipky přepínají mezi volbami (standardní chování radio skupiny).
    group.addEventListener('keydown', (event) => {
      const step = ARROW_STEPS[event.key];
      if (!step) return;
      event.preventDefault();
      const index = options.findIndex(option => option.dataset.themeValue === current);
      const next = options[(index + step + options.length) % options.length];
      select(next.dataset.themeValue, { focus: true });
    });
  }

  initThemeSwitch();
})();
