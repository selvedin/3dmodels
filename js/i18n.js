// i18n engine — register locales, resolve translations, persist preference.
//
// Usage:
//   I18n.register('en', LOCALE_EN);
//   I18n.t('appTitle', 'en');
//   I18n.t('panelCount', 'bs', { count: 3 });
//   I18n.setLang('bs');

const I18n = (() => {
  const locales = {};
  let currentLang = localStorage.getItem('app_lang') || 'en';

  function register(code, translations) {
    locales[code] = translations;
  }

  function setLang(code) {
    if (!locales[code]) return;
    currentLang = code;
    localStorage.setItem('app_lang', code);
    document.documentElement.lang = code;
  }

  function getLang() {
    return currentLang;
  }

  function getAvailableLangs() {
    return Object.keys(locales);
  }

  // Resolve a translation key with optional {placeholder} substitution.
  // Falls back to English, then the raw key if nothing matches.
  function t(key, lang, params) {
    const locale = locales[lang] || locales['en'] || {};
    const fallback = locales['en'] || {};
    const str = locale[key] !== undefined ? locale[key] : (fallback[key] !== undefined ? fallback[key] : key);
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? String(params[k]) : '{' + k + '}');
  }

  return { register, setLang, getLang, getAvailableLangs, t };
})();

// Register all bundled locales
I18n.register('en', LOCALE_EN);
I18n.register('bs', LOCALE_BS);

// Apply persisted language to the document
document.documentElement.lang = I18n.getLang();
