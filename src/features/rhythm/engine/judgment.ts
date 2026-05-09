import type { JudgmentName, JudgmentWindow } from "../model/rhythmTypes";

export const MISS_WINDOW_MS = 180;

export const JUDGMENT_WINDOWS: JudgmentWindow[] = [
  { name: "MARVELOUS", maxDiffMs: 22, scoreValue: 320, accuracyValue: 320, breaksCombo: false },
  { name: "PERFECT", maxDiffMs: 45, scoreValue: 300, accuracyValue: 300, breaksCombo: false },
  { name: "GREAT", maxDiffMs: 75, scoreValue: 200, accuracyValue: 200, breaksCombo: false },
  { name: "GOOD", maxDiffMs: 105, scoreValue: 100, accuracyValue: 100, breaksCombo: false },
  { name: "BAD", maxDiffMs: 135, scoreValue: 50, accuracyValue: 50, breaksCombo: true },
  { name: "MISS", maxDiffMs: 180, scoreValue: 0, accuracyValue: 0, breaksCombo: true },
];

export function getJudgmentByDiff(diffMs: number): JudgmentName | null {
  const absDiffMs = Math.abs(diffMs);
  const window = JUDGMENT_WINDOWS.find((item) => absDiffMs <= item.maxDiffMs);
  return window?.name ?? null;
}

export function getJudgmentWindow(name: JudgmentName): JudgmentWindow {
  const window = JUDGMENT_WINDOWS.find((item) => item.name === name);

  if (!window) {
    throw new Error(`Unknown judgment: ${name}`);
  }

  return window;
}

export function isMissedByTime(currentTimeMs: number, effectiveNoteTimeMs: number): boolean {
  return currentTimeMs > effectiveNoteTimeMs + MISS_WINDOW_MS;
}
