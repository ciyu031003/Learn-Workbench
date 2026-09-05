import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { palettes, type ThemeColors, type ThemeMode } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";

interface ThemeValue {
  colors: ThemeColors;
  dark: boolean;
  mode: ThemeMode;
}

const ThemeContext = createContext<ThemeValue>({ colors: palettes.light, dark: false, mode: "system" });

/** 全局主题：跟随系统或手动三档（浅色/深色/跟随系统）。切换时依赖 colors 变化触发重渲染。 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useAppStore((s) => s.themeMode);
  const system = useColorScheme();
  const dark = mode === "dark" || (mode === "system" && system === "dark");
  const value = useMemo<ThemeValue>(
    () => ({ colors: dark ? palettes.dark : palettes.light, dark, mode }),
    [dark, mode]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
