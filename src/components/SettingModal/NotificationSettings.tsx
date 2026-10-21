import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import { deviceActions } from '../../store/slices/device.slice';
import styles from '../VoiceVideoSetting/VoiceVideoSetting.module.css';
import type { NotificationPolicy } from '../../utils/notificationPolicy';
import { soundPlayer } from '../../utils/soundPlayer';

export function NotificationSettings({section = 'messages'}: {section?: string}) {
  const dispatch = useDispatch();
  const {notificationSoundsEnabled, desktopNotificationsEnabled, notificationPolicy: policy, persistenceError, notificationError} = useSelector((s: RootState) => s.device);
  const rooms = useSelector((s: RootState) => s.room.rooms);
  const accountId = useSelector((s: RootState) => s.user.myUser?.id);
  const change = (value: Partial<NotificationPolicy>) => dispatch(deviceActions.setNotificationPolicy(value));
  const toggle = (key: Exclude<keyof NotificationPolicy, 'exceptions'>, label: string) => <p><label><input type="checkbox" checked={policy[key]} onChange={e => change({[key]: e.target.checked})}/>{label}</label></p>;
  const [permission, setPermission] = useState(typeof Notification === 'undefined' ? 'unavailable' : Notification.permission);
  const [error, setError] = useState('');
  const desktop = typeof window !== 'undefined' && !!window.zvonokDesktop?.notifications;
  const [nativeSupported, setNativeSupported] = useState<boolean>();
  useEffect(() => {
    if (section !== 'messages') return;
    let stopped = false;
    void window.zvonokDesktop?.preferences?.get().then(value => { if (!stopped) setNativeSupported(value.notifications); }).catch(() => {});
    return () => { stopped = true; };
  }, [section]);
  if (section === 'incoming') return <section>
    {toggle('calls', 'Системные уведомления о входящих звонках')}
    {toggle('allowCallsDuringDnd', 'Разрешать входящие звонки во время «Не беспокоить»')}
    <p>Исключения диалогов относятся к сообщениям. Этот переключатель отдельно разрешает звук и оповещения звонков во время DND. Экран принятия звонка остаётся доступен всегда; главное окно не открывается автоматически.</p>
  </section>;
  if (section === 'dnd') return <section>{toggle('dnd', 'Не беспокоить')}<p role="status">{policy.dnd ? 'Не беспокоить включён' : 'Не беспокоить выключен'}</p><p>Без звуков и системных оповещений, кроме разрешённых исключений. Сообщения, unread и звонки продолжают поступать. Расписание не используется.</p></section>;
  if (section === 'exceptions') return <section><p>Сообщения выбранных личных и групповых диалогов обходят DND. Общие переключатели звука и уведомлений сохраняют силу. Правила привязаны к текущему аккаунту.</p>
    {rooms.filter(room => room.type === 'PRIVATE' || room.type === 'GROUP').map(room => <p key={room.id}><label><input type="checkbox" disabled={!accountId} checked={policy.exceptions.some(item => item.accountId === accountId && item.roomId === room.id)} onChange={e => change({exceptions: [...policy.exceptions.filter(item => item.accountId !== accountId || item.roomId !== room.id), ...(e.target.checked && accountId ? [{accountId, roomId: room.id}] : [])]})}/>{room.name || `Личный диалог №${room.id}`}</label></p>)}
    {!rooms.length && <p>Нет доступных диалогов.</p>}
  </section>;
  if (section === 'sounds') return <section>
    {toggle('messageSound', 'Звук сообщений')}{toggle('callSound', 'Звук входящего звонка')}
    {toggle('eventSound', 'Системный звук заявок и событий групп')}
    <button type="button" onClick={() => { void soundPlayer.test('message').catch(() => setError('Не удалось воспроизвести звук.')); }}>Проверить звук сообщения</button>{' '}
    <button type="button" onClick={() => { void soundPlayer.test('call').catch(() => setError('Не удалось воспроизвести звук.')); }}>Проверить звук звонка</button>
    <p>Тест воспроизводится явно даже при DND, через системный выход. Звук заявок и событий групп воспроизводит ОС при системном оповещении.</p>{error && <p role="alert">{error}</p>}
  </section>;
  return <section className={styles['processing-grid']}>
    <div className={styles['settings-card']}>
    <h3>Звуки событий</h3>
    <p>Настройки сохраняются только в этом браузере или профиле desktop, без синхронизации между устройствами.</p>
    {persistenceError && <p role="alert">{persistenceError}</p>}
    {notificationError && <p role="alert">{notificationError}</p>}
    <p><label><input type="checkbox" checked={notificationSoundsEnabled} onChange={e => dispatch(deviceActions.setNotificationSounds(e.target.checked))}/>Разрешить звуки уведомлений</label></p>
    <p>Отключение звука не скрывает входящий звонок и не мешает принять его. Браузер может блокировать автоматическое воспроизведение до взаимодействия с приложением.</p>
    </div>
    <div className={styles['settings-card']}>
    <h3>Системные уведомления</h3>
    {toggle('messages', 'Показывать уведомления о сообщениях')}
    {toggle('preview', 'Показывать содержимое сообщения')}
    {toggle('onlyUnfocused', 'Системные уведомления только вне фокуса приложения')}
    <p><label><input type="checkbox" checked={desktopNotificationsEnabled} disabled={nativeSupported === false || !desktop && permission === 'unavailable'} onChange={e => dispatch(deviceActions.setDesktopNotifications(e.target.checked))}/>Системные уведомления</label></p>
    <p role="status">{desktop ? nativeSupported === false ? 'Windows сообщает, что системные уведомления недоступны. Проверьте настройки ОС и установленную сборку.' : 'Electron: разрешениями и показом управляет ОС. Приложение не может подтвердить, что ОС показала уведомление.' : permission === 'denied' ? 'Разрешение запрещено. Измените его в настройках сайта браузера.' : permission === 'granted' ? 'Браузер разрешил уведомления.' : permission === 'unavailable' ? 'Системные уведомления недоступны в этой среде.' : 'Для системных уведомлений требуется разрешение браузера.'}</p>
    {!desktop && permission === 'default' && <button onClick={async () => {
      try { setPermission(await Notification.requestPermission()); setError(''); }
      catch { setError('Не удалось запросить разрешение на уведомления.'); }
    }}>Разрешить уведомления</button>}
    {error && <p role="alert">{error}</p>}
    <p>Системные оповещения: новые личные и групповые сообщения, входящие звонки, заявки и события групп. Действующие проверки активного чата и фокуса сохраняются.</p>
    <p>Внутри приложения сообщения, индикаторы и входящие звонки остаются доступны. DND и исключения настраиваются в соответствующих подразделах.</p>
    </div>
  </section>;
}

