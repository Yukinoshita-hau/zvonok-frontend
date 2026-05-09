import { calculateGrade } from "../engine/scoring";
import type { RhythmMap, RhythmScoreState } from "../model/rhythmTypes";
import styles from "../styles/RhythmResultPanel.module.css";

interface Props {
  map: RhythmMap;
  scoreState: RhythmScoreState;
  onRestart: () => void;
}

export function RhythmResultPanel({ map, scoreState, onRestart }: Props) {
  const grade = calculateGrade(scoreState);

  return (
    <section className={styles.result}>
      <h3>Results</h3>
      <p>{map.title} — {map.artist}</p>
      <p>Grade: {grade}</p>
      <p>Final Score: {scoreState.score.toLocaleString()}</p>
      <p>Accuracy: {scoreState.accuracy.toFixed(2)}%</p>
      <p>Max Combo: {scoreState.maxCombo}</p>
      <p>
        M:{scoreState.judgmentCounts.MARVELOUS} P:{scoreState.judgmentCounts.PERFECT} G:{scoreState.judgmentCounts.GREAT}
        {' '}Go:{scoreState.judgmentCounts.GOOD} B:{scoreState.judgmentCounts.BAD} Miss:{scoreState.judgmentCounts.MISS}
      </p>
      <button onClick={onRestart}>Restart</button>
      <small>Leaderboard will be added in a future backend iteration.</small>
    </section>
  );
}
