import { MICROPHONE_QUALITY_PRESETS, type MicQualitySetting } from "../../../utils/microphoneQuality";
import type { MicrophoneQualitySelectorProps } from "./MicrophoneQualitySelector.props";
import styles from "./MicrophoneQualitySelector.module.css";

export function MicrophoneQualitySelector({value,onChange}: MicrophoneQualitySelectorProps) {
  const preset = MICROPHONE_QUALITY_PRESETS[value];
  return <div className={styles.root}>
    <select className={styles.select} aria-label="Качество микрофона" value={value} onChange={e=>onChange(e.target.value as MicQualitySetting)}>
      {Object.values(MICROPHONE_QUALITY_PRESETS).map(item=><option key={item.value} value={item.value}>{item.label} · {item.publishLabel}</option>)}
    </select>
    <p className={styles.description}>{preset.description} · {preset.sampleRate} Hz · Mono</p>
  </div>;
}
