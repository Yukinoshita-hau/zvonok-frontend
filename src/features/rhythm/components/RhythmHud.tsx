import { rhythmTheme } from "../theme/rhythmTheme";
import type { RhythmScoreState } from "../model/rhythmTypes";
import styles from "../styles/RhythmHud.module.css";

interface Props { scoreState: RhythmScoreState; }

function formatDiff(diff?: number): string {
  if (diff === undefined) return "—";
  if (diff === 0) return "0ms";
  return `${diff > 0 ? "+" : ""}${Math.round(diff)}ms ${diff < 0 ? "EARLY" : "LATE"}`;
}

export function RhythmHud({ scoreState }: Props) {
  const judgmentColor = scoreState.lastJudgment ? rhythmTheme.judgmentColors[scoreState.lastJudgment] : "#d5def7";
  return <aside className={styles.hud}>
    <div className={styles.score}>{scoreState.score.toLocaleString()}</div>
    <div className={styles.acc}>ACC {scoreState.accuracy.toFixed(2)}%</div>
    <div className={styles.comboWrap}><div>Combo</div><strong>{scoreState.combo}</strong><small>Max {scoreState.maxCombo}</small></div>
    <div className={styles.judgment} style={{ color: judgmentColor }}>{scoreState.lastJudgment ?? "READY"}</div>
    <div className={styles.diff}>{formatDiff(scoreState.lastHitDiffMs)}</div>
    <div className={styles.counts}>
      {Object.entries(scoreState.judgmentCounts).map(([key, val]) => <div key={key}><span>{key}</span><b>{val}</b></div>)}
    </div>
  </aside>;
}
