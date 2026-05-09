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
      <label><span>Approach Time: {settings.approachTimeMs} ms</span><small>Lower = faster notes.</small>
        <input type="range" min={800} max={3000} value={settings.approachTimeMs} onChange={(e) => onChange({ approachTimeMs: Number(e.target.value) })} />
      </label>
      <label><span>Input Offset: {settings.inputOffsetMs} ms</span><small>Negative = earlier, positive = later.</small>
        <input type="range" min={-200} max={200} value={settings.inputOffsetMs} onChange={(e) => onChange({ inputOffsetMs: Number(e.target.value) })} />
      </label>
      <label><span>Note Size: {settings.noteSize.toFixed(2)}x</span>
        <input type="range" min={0.8} max={1.4} step={0.05} value={settings.noteSize} onChange={(e) => onChange({ noteSize: Number(e.target.value) })} />
      </label>
      <label><span>Effect Intensity: {settings.effectIntensity.toFixed(2)}x</span>
        <input type="range" min={0.5} max={1.6} step={0.05} value={settings.effectIntensity} onChange={(e) => onChange({ effectIntensity: Number(e.target.value) })} />
      </label>
      <label><span>Background Dim: {Math.round(settings.backgroundDim * 100)}%</span>
        <input type="range" min={0.2} max={0.8} step={0.05} value={settings.backgroundDim} onChange={(e) => onChange({ backgroundDim: Number(e.target.value) })} />
      </label>
      <label><span>Background Preset</span>
        <select value={settings.backgroundPreset} onChange={(e) => onChange({ backgroundPreset: e.target.value as RhythmSettings["backgroundPreset"] })}>
          <option value="nebula">Nebula</option><option value="grid">Grid</option><option value="aurora">Aurora</option>
        </select>
      </label>
      <label className={styles.toggle}><input type="checkbox" checked={settings.showBarlines} onChange={(e) => onChange({ showBarlines: e.target.checked })} /> Show barlines</label>
    </section>
  );
}
