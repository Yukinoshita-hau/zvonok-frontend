import { Track, type Room } from 'livekit-client';

// Access to the existing Room only; this module never creates or owns media.
let activeRoom: Room | undefined;
export const callDeviceId = (kind: MediaDeviceKind) => activeRoom?.getActiveDevice(kind);
export function bindCallDevices(room: Room) {
  activeRoom = room;
  return () => { if (activeRoom === room) activeRoom = undefined; };
}
export async function switchCallDevice(kind: MediaDeviceKind, id: string, callActive: boolean, previousId = 'default') {
  const room = activeRoom;
  if (!callActive) return;
  if (!room) throw new Error('Медиасессия ещё не готова. Повторите выбор после подключения.');
  const previous = room.getActiveDevice(kind) ?? previousId;
  const liveTrack = () => kind === 'audiooutput' ? undefined : room.localParticipant.getTrackPublication(kind === 'audioinput' ? Track.Source.Microphone : Track.Source.Camera)?.track?.mediaStreamTrack;
  try {
    const switched = await room.switchActiveDevice(kind, id, id !== 'default');
    // LiveKit compares the literal "default" with the OS-resolved physical ID.
    const systemDefaultResolved = id === 'default' && liveTrack()?.readyState === 'live' && !!liveTrack()?.getSettings().deviceId;
    if (!switched && !systemDefaultResolved) throw new Error('SDK не подтвердил переключение.');
  } catch (error) {
    if (activeRoom !== room) throw new Error('Медиасессия завершилась; текущее устройство не подтверждено.');
    try {
      const restored = await room.switchActiveDevice(kind, previous, previous !== 'default');
      if (!restored || (liveTrack() && liveTrack()?.readyState !== 'live')) throw new Error('restore failed');
    } catch {
      throw new Error('Переключение и восстановление не удались. Текущее устройство не подтверждено; выключите и включите микрофон/камеру. Список показывает сохранённое предпочтение.');
    }
    throw new Error(`Предыдущее устройство восстановлено. ${error instanceof Error ? error.message : 'Проверьте разрешения.'}`);
  }
  if (activeRoom !== room) throw new Error('Звонок завершился во время переключения. Повторите выбор.');
}
