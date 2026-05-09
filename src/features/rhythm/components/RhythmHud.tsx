import type { RhythmScoreState } from "../model/rhythmTypes";
import styles from "../styles/RhythmHud.module.css";

interface Props {
  scoreState: RhythmScoreState;
}

function formatDiff(diff?: number): string {
  if (diff === undefined) return "—";
  if (diff === 0) return "0ms";
  const sign = diff > 0 ? "+" : "";
  const side = diff < 0 ? "EARLY" : "LATE";
  return `${sign}${Math.round(diff)}ms ${side}`;
}

export function RhythmHud({ scoreState }: Props) {
  return (
    <aside className={styles.hud}>
      <h3>HUD</h3>
      <div>Score: {scoreState.score.toLocaleString()}</div>
      <div>Accuracy: {scoreState.accuracy.toFixed(2)}%</div>
      <div>Combo: {scoreState.combo}</div>
      <div>Max Combo: {scoreState.maxCombo}</div>
      <div>Last Judgment: {scoreState.lastJudgment ?? "—"}</div>
      <div>Hit Diff: {formatDiff(scoreState.lastHitDiffMs)}</div>
      <ul>
        <li>MARVELOUS: {scoreState.judgmentCounts.MARVELOUS}</li>
        <li>PERFECT: {scoreState.judgmentCounts.PERFECT}</li>
        <li>GREAT: {scoreState.judgmentCounts.GREAT}</li>
        <li>GOOD: {scoreState.judgmentCounts.GOOD}</li>
        <li>BAD: {scoreState.judgmentCounts.BAD}</li>
        <li>MISS: {scoreState.judgmentCounts.MISS}</li>
      </ul>
    </aside>
  );
}
