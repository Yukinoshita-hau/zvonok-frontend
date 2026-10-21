import { AppearanceSettings } from "./AppearanceSettings";
import type { SettingDefinition } from "./SettingsRegistry";
import { SettingsStatus } from "./SettingsStatus";
import styles from "./SettingsWorkspace.module.css";
import { VoiceVideoSetting } from '../../components/VoiceVideoSetting/VoiceVideoSetting';
import { NotificationSettings } from '../../components/SettingModal/NotificationSettings';
import { ApplicationSettings } from '../../components/SettingModal/ApplicationSettings';
const mediaSections = {microphone: 'microphone', headphones: 'output', camera: 'camera', screen: 'screen', noise: 'processing'} as const;
const explanations: Record<string, string> = {
  privacy: 'Локальная защита содержимого системных уведомлений доступна в разделе «Уведомления → Сообщения». Серверные настройки видимости онлайн, входящих сообщений и запросов в друзья пока не поддерживаются. Выход и отзыв refresh-сеансов доступны в профиле выше.',
  conflicts: 'Совпадающие комбинации отклоняются при записи и сбросе. Системные комбинации зарезервированы; отказ глобальной регистрации Electron отображается в списке команд.',
  hints: 'Команды работают во время звонка. Ввод текста и открытые настройки не перехватываются. Escape отменяет запись; Tab завершает запись и перемещает фокус.',
};
export function SettingsField({
  field,
  highlighted,
  advanced = false,
}: {
  field: SettingDefinition;
  highlighted: boolean;
  advanced?: boolean;
}) {
  const embedded = field.category === 'media' || field.id === 'bindings' || field.id === 'messages';
  return (
    <article
      id={`setting-${field.id}`}
      tabIndex={-1}
      className={`${styles.field} ${highlighted ? styles.highlight : ""}`}
      aria-labelledby={embedded ? undefined : `label-${field.id}`}
      aria-label={embedded ? field.title : undefined}
    >
      {!embedded && <div>
        <h3 id={`label-${field.id}`}>{field.title}</h3>
        {!explanations[field.id] && <p>{field.description}</p>}
      </div>}
      {field.category === "appearance" && (field.id === "theme" || field.id === "colors") ? <AppearanceSettings section={field.id} />
        : field.category === 'media' ? <VoiceVideoSetting advanced={advanced} section={mediaSections[field.id as keyof typeof mediaSections]}/>
        : field.id === 'bindings' ? <VoiceVideoSetting hotkeysOnly/>
        : field.category === 'notifications' ? <NotificationSettings section={field.id}/>
        : field.id === 'about' || field.id === 'window' ? <ApplicationSettings section={field.id}/>
        : explanations[field.id] ? <p role="status">{explanations[field.id]}</p>
        : <SettingsStatus state="unsupported" />}
    </article>
  );
}
