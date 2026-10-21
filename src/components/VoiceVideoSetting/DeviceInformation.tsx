import { useEffect, useState } from 'react';
import { callDeviceId } from '../../services/callDevices';

export function DeviceInformation({devices, kind, selected}: {devices: MediaDeviceInfo[]; kind: MediaDeviceKind; selected: string}) {
  const [permission, setPermission] = useState('не сообщается платформой');
  useEffect(() => {
    if (kind === 'audiooutput' || !navigator.permissions) return;
    let stopped = false, status: PermissionStatus | undefined;
    const update = () => { if (!stopped && status) setPermission(status.state === 'granted' ? 'разрешено' : status.state === 'denied' ? 'запрещено' : 'будет запрошено при проверке'); };
    void navigator.permissions.query({name: (kind === 'audioinput' ? 'microphone' : 'camera') as PermissionName}).then(value => { if (!stopped) { status = value; update(); value.addEventListener('change', update); } }).catch(() => {});
    return () => { stopped = true; status?.removeEventListener('change', update); };
  }, [kind]);
  const actual = callDeviceId(kind);
  const label = (id: string) => id === 'default' ? 'Системное устройство' : devices.find(device => device.deviceId === id)?.label || 'Название недоступно или устройство отключено';
  return <details><summary>Устройства и разрешения</summary>
    <p>Разрешение: {permission}. Предпочтение: {label(selected)}. {actual ? `Текущий выбор LiveKit: ${label(actual)}.` : 'Активное устройство звонка не подтверждено.'}</p>
    <ul>{devices.filter(device => device.deviceId !== 'default').map((device, index) => <li key={device.deviceId || index}>{device.label || `Устройство ${index + 1}: название скрыто до разрешения`}</li>)}</ul>
    {!devices.length && <p>Платформа не сообщила доступные устройства.</p>}
    <p>Список обновляется при подключении и отключении. Доступ запрашивается только явной кнопкой проверки или включением источника в звонке.</p>
  </details>;
}
