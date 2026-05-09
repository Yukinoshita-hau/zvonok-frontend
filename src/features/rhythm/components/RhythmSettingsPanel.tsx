import type { RhythmSettings } from "../model/rhythmTypes";
import styles from "../styles/RhythmSettingsPanel.module.css";

interface Props {
  settings: RhythmSettings;
  onChange: (patch: Partial<RhythmSettings>) => void;
}

export function RhythmSettingsPanel({ settings, onChange }: Props) {
  return (
    <section className={styles.panel}>
      <h3>Settings</h3>
      <label>
        <span>Approach time: {settings.approachTimeMs} ms</span>
        <input
          type="range"
          min={800}
          max={3000}
          value={settings.approachTimeMs}
          onChange={(event) => onChange({ approachTimeMs: Number(event.target.value) })}
        />
      </label>
      <small>Lower = faster notes, higher = slower notes.</small>

      <label>
        <span>Input offset: {settings.inputOffsetMs} ms</span>
        <input
          type="range"
          min={-200}
          max={200}
          value={settings.inputOffsetMs}
          onChange={(event) => onChange({ inputOffsetMs: Number(event.target.value) })}
        />
      </label>
    </section>
  );
}
