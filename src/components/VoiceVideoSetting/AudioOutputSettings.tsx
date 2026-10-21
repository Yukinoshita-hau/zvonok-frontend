import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/store';
import { selectMediaDevice } from '../../store/slices/device.slice';
import styles from './VoiceVideoSetting.module.css';

export function AudioOutputSettings({devices}: {devices: MediaDeviceInfo[]}) {
  const dispatch = useDispatch<AppDispatch>();
  const {selectedAudioOutputId, deviceSwitchPending} = useSelector((s: RootState) => s.device);
  const supported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  return <section className={styles['settings-card']}><h3>Устройство вывода звука звонка</h3>
    <p>Локальное предпочтение для голоса и демонстраций собеседников. Звуки уведомлений используют системный выход.</p>
    {supported ? <label className={styles['form-group']}>Наушники и динамики <select title={devices.find(device=>device.deviceId===selectedAudioOutputId)?.label || 'Системное устройство'} aria-label="Устройство вывода" value={selectedAudioOutputId} disabled={deviceSwitchPending}
      onChange={e => void dispatch(selectMediaDevice({kind: 'audiooutput', id: e.target.value}))}>
      <option value="default">Системное устройство</option>
      {selectedAudioOutputId !== 'default' && !devices.some(d => d.deviceId === selectedAudioOutputId) && <option value={selectedAudioOutputId}>Выбранное устройство недоступно</option>}
      {devices.filter(d => d.deviceId !== 'default').map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Устройство ${i + 1}`}</option>)}
    </select></label> : <p role="status">Выбор аудиовыхода не поддерживается этим браузером. Используется системное устройство.</p>}
  </section>;
}
