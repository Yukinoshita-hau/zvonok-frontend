import { getJudgmentWindow } from "./judgment";
import type { JudgmentName, RhythmScoreState } from "../model/rhythmTypes";

const MAX_JUDGMENT_VALUE = 320;
const MAX_SCORE = 1_000_000;

function emptyCounts() {
  return {
    MARVELOUS: 0,
    PERFECT: 0,
    GREAT: 0,
    GOOD: 0,
    BAD: 0,
    MISS: 0,
  };
}

export function createInitialScoreState(totalNotes: number): RhythmScoreState {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    accuracy: 100,
    judgedNotes: 0,
    totalNotes,
    totalAccuracyPoints: 0,
    judgmentCounts: emptyCounts(),
  };
}

export function applyJudgment(
  state: RhythmScoreState,
  judgment: JudgmentName,
  diffMs?: number,
): RhythmScoreState {
  const judgmentWindow = getJudgmentWindow(judgment);
  const judgedNotes = state.judgedNotes + 1;
  const totalAccuracyPoints = state.totalAccuracyPoints + judgmentWindow.accuracyValue;
  const totalDenominator = Math.max(1, state.totalNotes * MAX_JUDGMENT_VALUE);

  const score = Math.round((totalAccuracyPoints / totalDenominator) * MAX_SCORE);
  const accuracy = judgedNotes === 0 ? 100 : (totalAccuracyPoints / (judgedNotes * MAX_JUDGMENT_VALUE)) * 100;

  const nextCombo = judgmentWindow.breaksCombo ? 0 : state.combo + 1;
  const nextMaxCombo = judgmentWindow.breaksCombo ? state.maxCombo : Math.max(state.maxCombo, nextCombo);

  return {
    ...state,
    score,
    accuracy,
    combo: nextCombo,
    maxCombo: nextMaxCombo,
    judgedNotes,
    totalAccuracyPoints,
    judgmentCounts: {
      ...state.judgmentCounts,
      [judgment]: state.judgmentCounts[judgment] + 1,
    },
    lastJudgment: judgment,
    lastHitDiffMs: diffMs,
  };
}

export function calculateGrade(scoreState: RhythmScoreState): string {
  const { accuracy, judgmentCounts } = scoreState;
  if (accuracy >= 99.5 && judgmentCounts.MISS === 0 && judgmentCounts.BAD === 0) return "SS";
  if (accuracy >= 95) return "S";
  if (accuracy >= 90) return "A";
  if (accuracy >= 80) return "B";
  if (accuracy >= 70) return "C";
  return "D";
}
