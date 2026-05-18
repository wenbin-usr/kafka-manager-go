import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import i18n, { getStoredLocale, setStoredLocale, type Locale } from '../i18n';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'kafka-manager-theme';

function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' || stored === 'light' ? stored : 'light';
}

interface AppSettingsContextType {
  locale: Locale;
  themeMode: ThemeMode;
  setLocale: (locale: Locale) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleLocale: () => void;
  toggleTheme: () => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | null>(null);

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredTheme);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next);
    i18n.changeLanguage(next);
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'zh' ? 'en' : 'zh');
  }, [locale, setLocale]);

  const toggleTheme = useCallback(() => {
    setThemeMode(themeMode === 'light' ? 'dark' : 'light');
  }, [themeMode, setThemeMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const antdLocale = locale === 'zh' ? zhCN : enUS;
  const algorithm = themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;

  const value = useMemo(
    () => ({ locale, themeMode, setLocale, setThemeMode, toggleLocale, toggleTheme }),
    [locale, themeMode, setLocale, setThemeMode, toggleLocale, toggleTheme],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      <ConfigProvider
        locale={antdLocale}
        theme={{
          algorithm,
          token: { colorPrimary: '#1677ff' },
        }}
      >
        {children}
      </ConfigProvider>
    </AppSettingsContext.Provider>
  );
};
