import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import zh from './locales/zh';

export type Locale = 'en' | 'zh';

const STORAGE_KEY = 'kafka-manager-locale';

export function getStoredLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'zh' || stored === 'en' ? stored : 'zh';
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale);
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: getStoredLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
