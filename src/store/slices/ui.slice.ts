import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type baseTheme =
  | "dark"
  | "light"
  | "purple"
  | "ocean"
  | "matrix"
  | "sunset"
  | "midnight"
  | "dracula"
  | "cyberpunk"
  | "terminal"
  | "nord"
  | "coffee"
  | "custom";

export const themes = [
  "dark",
  "light",
  "purple",
  "ocean",
  "matrix",
  "sunset",
  "midnight",
  "dracula",
  "cyberpunk",
  "terminal",
  "nord",
  "coffee",
  "custom",
] as const;

export interface CustomTheme {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgInput: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
}

export interface UiState {
  theme: baseTheme;
  customTheme: CustomTheme;
  saveError: string | null;
}

export const defaultCustomTheme: CustomTheme = {
  bgPrimary: "#101722",
  bgSecondary: "#172233",
  bgTertiary: "#0b111a",
  bgInput: "#111b29",
  accent: "#58c7ff",
  textPrimary: "#edf6ff",
  textSecondary: "#9db0c8",
  border: "rgba(126, 156, 190, 0.34)",
};

export function parseColor(
  value: unknown,
): { rgb: string; alpha: number } | null {
  if (typeof value !== "string") return null;
  const hex = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(
    value.trim(),
  );
  if (hex) {
    const digits =
      hex[1].length <= 4 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return {
      rgb: "#" + digits.slice(0, 6),
      alpha: digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1,
    };
  }
  const match =
    /^(rgb|rgba)\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i.exec(
      value.trim(),
    );
  if (
    !match ||
    (match[1].toLowerCase() === "rgba") !== (match[5] !== undefined)
  )
    return null;
  const channels = match.slice(2, 5).map(Number),
    alpha = match[5] === undefined ? 1 : Number(match[5]);
  if (channels.some((c) => c > 255) || alpha > 1) return null;
  return {
    rgb:
      "#" +
      channels.map((c) => Math.round(c).toString(16).padStart(2, "0")).join(""),
    alpha,
  };
}

export function replaceColorRgb(value: string, rgb: string): string {
  const alpha = parseColor(value)?.alpha ?? 1;
  if (alpha === 1) return rgb;
  const channels = [1, 3, 5].map((i) => parseInt(rgb.slice(i, i + 2), 16));
  return `rgba(${channels.join(", ")}, ${alpha})`;
}

export const customThemeVariables = {
  bgPrimary: "--bg-primary",
  bgSecondary: "--bg-secondary",
  bgTertiary: "--bg-tertiary",
  bgInput: "--bg-input",
  accent: "--accent",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  border: "--border",
} satisfies Record<keyof CustomTheme, string>;

export function loadTheme(): UiState {
  const result: UiState = {
    theme: "dark",
    customTheme: { ...defaultCustomTheme },
    saveError: null,
  };
  try {
    const theme = localStorage.getItem("app-theme");
    if (themes.includes(theme as baseTheme)) result.theme = theme as baseTheme;
    const raw = localStorage.getItem("app-custom-theme");
    if (raw) {
      const palette: unknown = JSON.parse(raw);
      if (palette && typeof palette === "object") {
        for (const key of Object.keys(
          defaultCustomTheme,
        ) as (keyof CustomTheme)[]) {
          const value = (palette as Record<string, unknown>)[key];
          if (parseColor(value)) result.customTheme[key] = value as string;
        }
      }
    }
  } catch {
    result.saveError =
      "Не удалось прочитать оформление. Используются доступные безопасные значения.";
  }
  return result;
}

function saveTheme(state: UiState) {
  try {
    const palette = JSON.stringify(state.customTheme);
    localStorage.setItem("app-custom-theme", palette);
    localStorage.setItem("app-theme", state.theme);
    if (
      localStorage.getItem("app-theme") !== state.theme ||
      localStorage.getItem("app-custom-theme") !== palette
    )
      throw new Error("Storage readback mismatch");
    state.saveError = null;
  } catch {
    state.saveError =
      "Применено только в этой сессии. Сохранение недоступно; после перезапуска оформление может измениться.";
  }
}

export const uiSlice = createSlice({
  name: "ui",
  initialState: loadTheme,
  reducers: {
    setTheme: (state, action: PayloadAction<baseTheme>) => {
      if (!themes.includes(action.payload)) return;
      state.theme = action.payload;
      saveTheme(state);
    },
    setCustomTheme: (state, action: PayloadAction<Partial<CustomTheme>>) => {
      const entries = Object.entries(action.payload);
      if (
        entries.some(
          ([key, value]) =>
            !Object.hasOwn(defaultCustomTheme, key) || !parseColor(value),
        )
      )
        return;
      for (const [key, value] of entries)
        state.customTheme[key as keyof CustomTheme] = value;
      saveTheme(state);
    },
    resetCustomTheme: (state) => {
      state.customTheme = { ...defaultCustomTheme };
      saveTheme(state);
    },
  },
});
export default uiSlice.reducer;
export const uiActions = uiSlice.actions;
