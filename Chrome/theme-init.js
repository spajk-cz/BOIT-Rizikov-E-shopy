'use strict';

/**
 * Aplikuje ručně zvolené téma ještě před prvním vykreslením popupu.
 *
 * Zdroj pravdy je storage.local, jenže ten je asynchronní a popup by
 * mezitím problikl ve špatném tématu. theme-toggle.js proto drží kopii
 * volby v localStorage, který jde přečíst synchronně.
 * Režim "auto" se neukládá — ten obstará čisté CSS přes prefers-color-scheme.
 */
(function () {
  const THEME_STORAGE_KEY = 'boit_ui_theme';

  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme;
    }
  } catch (e) {
    // localStorage nedostupný — zůstane režim podle prohlížeče.
  }
})();
