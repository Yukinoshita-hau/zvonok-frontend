import { beforeEach, describe, expect, it, vi } from "vitest";
import reducer, {
  themes,
  defaultCustomTheme,
  loadTheme,
  parseColor,
  replaceColorRgb,
  uiActions,
} from "../../src/store/slices/ui.slice";
import { THEME_DETAILS } from "../../src/components/UiSetting/ThemeDetails";
import { paletteContrast } from "../../src/features/settingsV2/AppearanceSettings";

describe("S2A shared appearance contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    });
  });
  it("exposes all 13 existing themes and Redux selection", () => {
    expect(themes).toHaveLength(13);
    for (const theme of themes) {
      expect(THEME_DETAILS[theme].title).toBeTruthy();
      expect(reducer(undefined, uiActions.setTheme(theme)).theme).toBe(theme);
    }
  });
  it("restores every custom color without normalization or alpha loss", () => {
    const palette = {
      ...defaultCustomTheme,
      border: "rgba(10, 20, 30, 0.1234)",
    };
    let state = reducer(undefined, uiActions.setCustomTheme(palette));
    state = reducer(state, uiActions.setTheme("custom"));
    expect(loadTheme()).toEqual(state);
    expect(state.saveError).toBeNull();
  });
  it.each([
    "#12",
    "#gggggg",
    "rgb(256, 0, 0)",
    "rgba(0,0,0,1.1)",
    "rgba(-1,0,0,.5)",
    "rgb(0,0,0,.5)",
    "rgba(0,0,0)",
    "red",
    "url(x)",
    "",
    42,
    null,
  ])("rejects malformed color %s", (value) =>
    expect(parseColor(value)).toBeNull(),
  );
  it.each([
    "#abc",
    "#aabbcc",
    "#abcd",
    "#aabbccdd",
    "rgb(12, 0, 255)",
    "rgba(126, 156, 190, 0.34)",
  ])("accepts contract color %s", (value) =>
    expect(parseColor(value)).not.toBeNull(),
  );
  it("S34 displays actual RGB and keeps alpha on picker changes", () => {
    expect(parseColor(defaultCustomTheme.border)).toEqual({
      rgb: "#7e9cbe",
      alpha: 0.34,
    });
    expect(replaceColorRgb(defaultCustomTheme.border, "#123456")).toBe(
      "rgba(18, 52, 86, 0.34)",
    );
    expect(parseColor("#12345680")?.alpha).toBe(128 / 255);
    expect(parseColor(replaceColorRgb("#12345680", "#abcdef"))?.alpha).toBe(
      128 / 255,
    );
  });
  it("rejects invalid palette atomically and unknown themes", () => {
    const state = loadTheme();
    expect(
      reducer(
        state,
        uiActions.setCustomTheme({ accent: "#ffffff", border: "invalid" }),
      ),
    ).toEqual(state);
    expect(reducer(state, uiActions.setTheme("deleted" as never))).toEqual(
      state,
    );
  });
  it("preset selection preserves palette; reset colors preserves theme", () => {
    let state = reducer(
      undefined,
      uiActions.setCustomTheme({ accent: "#123456" }),
    );
    state = reducer(state, uiActions.setTheme("light"));
    expect(state.customTheme.accent).toBe("#123456");
    state = reducer(state, uiActions.resetCustomTheme());
    expect(state.theme).toBe("light");
    expect(state.customTheme).toEqual(defaultCustomTheme);
  });
  it("setItem failure keeps the session usable and reports save error", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const state = reducer(undefined, uiActions.setTheme("ocean"));
    expect(state.theme).toBe("ocean");
    expect(state.saveError).toBeTruthy();
  });
  it("detects ignored writes with readback", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {});
    expect(
      reducer(undefined, uiActions.setTheme("light")).saveError,
    ).toBeTruthy();
  });
  it("startup survives inaccessible storage", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadTheme().theme).toBe("dark");
    expect(loadTheme().saveError).toBeTruthy();
  });
  it("missing or removed theme falls back safely", () => {
    expect(loadTheme().theme).toBe("dark");
    localStorage.setItem("app-theme", "removed");
    expect(loadTheme().theme).toBe("dark");
  });
  it("corrupted JSON cannot block startup", () => {
    localStorage.setItem("app-custom-theme", "{");
    expect(loadTheme().customTheme).toEqual(defaultCustomTheme);
  });
  it("incomplete or invalid palette restores only valid known fields", () => {
    localStorage.setItem(
      "app-custom-theme",
      JSON.stringify({
        accent: "#abc",
        border: 42,
        bgPrimary: "bad",
        extra: "#fff",
      }),
    );
    expect(loadTheme().customTheme).toEqual({
      ...defaultCustomTheme,
      accent: "#abc",
    });
  });
  it("warns for unreadable palette", () => {
    expect(
      paletteContrast({
        ...defaultCustomTheme,
        textPrimary: defaultCustomTheme.bgPrimary,
      }),
    ).toBe(1);
  });
});
