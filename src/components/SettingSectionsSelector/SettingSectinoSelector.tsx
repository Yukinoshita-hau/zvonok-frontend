import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AccountSetting } from '../AccountSetting/AccountSetting';
import type { SettingSectionsSelectorProps } from './SettingSectionsSelector.props';
import { SECTIONS } from '../SettingModal/SettingSections';
import { VoiceVideoSetting } from '../VoiceVideoSetting/VoiceVideoSetting';
import { UiSetting } from '../UiSetting/UiSetting';
import type { RootState } from '../../store/store';
import { notificationAction } from '../../store/slices/notification.slice';
import { NotificationSettings } from '../SettingModal/NotificationSettings';
import { ApplicationSettings } from '../SettingModal/ApplicationSettings';

export function SettingSectionsSelector({sectionName,onFormStateChange,onClose}: SettingSectionsSelectorProps) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const unread = useSelector((s:RootState)=>s.notification.notifications.filter(n=>!n.read).length);
  if (sectionName===SECTIONS.VOICE || sectionName===SECTIONS.HOTKEYS) return <VoiceVideoSetting key={sectionName} hotkeysOnly={sectionName===SECTIONS.HOTKEYS}/>;
  if (sectionName===SECTIONS.APPEARANCE) return <UiSetting/>;
  if (sectionName===SECTIONS.APPLICATION) return <ApplicationSettings/>;
  if (sectionName===SECTIONS.NOTIFICATIONS) return <section className="settings-notifications">
    <h3>Центр уведомлений</h3><p>Заявки в друзья и ответы на них появляются в центре уведомлений во время текущей сессии.</p>
    <p>Непрочитанных: <strong>{unread}</strong></p>
    <button onClick={()=>{onClose?.();navigate('/notifications');}}>Открыть уведомления</button>
    <button disabled={!unread} onClick={()=>dispatch(notificationAction.markAllIsRead())}>Прочитать все</button>
    <hr/><NotificationSettings/>
  </section>;
  return <AccountSetting onFormStateChange={onFormStateChange}/>;
}
