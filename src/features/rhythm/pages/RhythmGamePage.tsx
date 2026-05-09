import { RhythmControls } from "../components/RhythmControls";
import { RhythmGameCanvas } from "../components/RhythmGameCanvas";
import { RhythmHud } from "../components/RhythmHud";
import { RhythmResultPanel } from "../components/RhythmResultPanel";
import { RhythmSettingsPanel } from "../components/RhythmSettingsPanel";
import { useRhythmGame } from "../hooks/useRhythmGame";
import { demoRhythmMap } from "../model/demoMap";
import styles from "../styles/RhythmGamePage.module.css";

export function RhythmGamePage() {
  const {
    status,
    map,
    notes,
    scoreState,
    settings,
    pressedLanes,
    audioRef,
    audioUrl,
    validationErrors,
    errorMessage,
    selectAudioFile,
    start,
    pause,
    resume,
    restart,
    updateSettings,
  } = useRhythmGame(demoRhythmMap);

  return (
    <div className={styles.page}>
      <h1>Rhythm Game</h1>
      <p>Basic 4K vertical rhythm MVP. Select an audio file and press Start.</p>

      <RhythmControls
        status={status}
        hasAudio={Boolean(audioUrl)}
        hasValidationErrors={validationErrors.length > 0}
        errorMessage={errorMessage}
        onSelectAudio={selectAudioFile}
        onStart={start}
        onPause={pause}
        onResume={resume}
        onRestart={restart}
      />

      <RhythmSettingsPanel settings={settings} onChange={updateSettings} />

      {!!validationErrors.length && (
        <div className={styles.errors}>
          <h4>Map validation errors</h4>
          <ul>
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.gameArea}>
        <RhythmGameCanvas
          notes={notes}
          map={map}
          settings={settings}
          pressedLanes={pressedLanes}
          status={status}
          audioRef={audioRef}
        />
        <RhythmHud scoreState={scoreState} />
      </div>

      {status === "finished" && <RhythmResultPanel map={map} scoreState={scoreState} onRestart={restart} />}

      <audio ref={audioRef} src={audioUrl} preload="auto" />
    </div>
  );
}
