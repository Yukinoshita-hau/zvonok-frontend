import type { GameStatus } from "../model/rhythmTypes";
import styles from "../styles/RhythmControls.module.css";

interface Props {
  status: GameStatus;
  hasAudio: boolean;
  hasValidationErrors: boolean;
  errorMessage: string;
  onSelectAudio: (file: File | null) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
}

export function RhythmControls({
  status,
  hasAudio,
  hasValidationErrors,
  errorMessage,
  onSelectAudio,
  onStart,
  onPause,
  onResume,
  onRestart,
}: Props) {
  return (
    <div className={styles.controls}>
      <label className={styles.filePicker}>
        <span>Audio file</span>
        <input type="file" accept="audio/*" onChange={(event) => onSelectAudio(event.target.files?.[0] ?? null)} />
      </label>

      <div className={styles.buttons}>
        <button onClick={onStart} disabled={!hasAudio || hasValidationErrors || status === "playing"}>Start</button>
        {status === "paused" ? (
          <button onClick={onResume} disabled={!hasAudio}>Resume</button>
        ) : (
          <button onClick={onPause} disabled={status !== "playing"}>Pause</button>
        )}
        <button onClick={onRestart} disabled={!hasAudio}>Restart</button>
      </div>

      <div className={styles.meta}>
        <span>Status: {status}</span>
        <span>Keys: D F J K</span>
        {!hasAudio && <span>Select audio file to start</span>}
        {errorMessage && <span className={styles.error}>{errorMessage}</span>}
      </div>
    </div>
  );
}
