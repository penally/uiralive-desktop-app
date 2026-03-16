import React, { createContext, useCallback, useContext, useState } from "react";
import { DEFAULT_THEME_ID, getThemeById, type Theme } from "@/lib/themes";

const STORAGE_KEY = "app-theme";

interface ThemeContextValue {
  selectedTheme: string;
  setSelectedTheme: (id: string) => void;
  currentTheme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedThemeId, setSelectedThemeId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID
  );

  const currentTheme = getThemeById(selectedThemeId);

  const setSelectedTheme = useCallback((id: string) => {
    setSelectedThemeId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return (
    <ThemeContext.Provider value={{ selectedTheme: selectedThemeId, setSelectedTheme, currentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
