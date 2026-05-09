import type { JudgmentName } from "../model/rhythmTypes";

export type BackgroundPreset = "nebula" | "grid" | "aurora";

export const rhythmTheme = {
  pageBackground: "radial-gradient(circle at 20% 20%, #2a2d56 0%, #131727 35%, #0a0d16 100%)",
  panelBg: "rgba(19, 24, 40, 0.72)",
  panelBorder: "rgba(148, 167, 255, 0.24)",
  laneColors: ["#56d8ff", "#9d7dff", "#ff76d5", "#ffc56d"],
  lanePressed: ["rgba(86,216,255,0.30)", "rgba(157,125,255,0.28)", "rgba(255,118,213,0.28)", "rgba(255,197,109,0.28)"],
  judgmentColors: {
    MARVELOUS: "#baf7ff",
    PERFECT: "#8eddff",
    GREAT: "#93a8ff",
    GOOD: "#a6f5b8",
    BAD: "#ffc888",
    MISS: "#ff7c93",
  } as Record<JudgmentName, string>,
};
