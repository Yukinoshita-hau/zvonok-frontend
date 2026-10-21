import { useLayoutEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { customThemeVariables } from "../store/slices/ui.slice";

export function useThemeApplication() {
  const { theme, customTheme } = useSelector((s: RootState) => s.ui);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    for (const [key, variable] of Object.entries(customThemeVariables)) {
      if (theme === "custom")
        root.style.setProperty(
          variable,
          customTheme[key as keyof typeof customTheme],
        );
      else root.style.removeProperty(variable);
    }
  }, [theme, customTheme]);
}
