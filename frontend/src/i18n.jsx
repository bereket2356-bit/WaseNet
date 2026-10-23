import React, { createContext, useContext, useState, useEffect } from 'react';
import { dictionaries } from './i18n-dictionary.js';

const I18nContext = createContext(null);
const LANG_KEY = 'wn-lang';
const LEGACY_LANG_KEY = 'wasenet_lang';
const THEME_KEY = 'wn-theme';

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY) || localStorage.getItem(LEGACY_LANG_KEY);
      if (saved === 'en' || saved === 'am') return saved;
    } catch (e) {}
    return 'en';
  });

  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {}
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
      localStorage.setItem(LEGACY_LANG_KEY, lang);
    } catch (e) {}
    document.documentElement.lang = lang;
    document.documentElement.dir = 'ltr';
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setLang = (newLang) => {
    if (newLang === 'en' || newLang === 'am') {
      setLangState(newLang);
    }
  };

  const toggleLang = () => {
    setLangState((prev) => (prev === 'en' ? 'am' : 'en'));
  };

  const setTheme = (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
    }
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const t = (key, params = {}) => {
    const dict = dictionaries[lang] || dictionaries.en;
    let text = dict[key] ?? dictionaries.en[key] ?? key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, theme, setTheme, toggleTheme, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
