import { useEffect, useState } from 'react';
import styles from './ApplicationSettings.module.css';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import type { UpdateState, DesktopPreferences } from '../../../electron/desktopTypes';

export function ApplicationSettings({section = 'about'}: {section?: 'window' | 'about'}) {
  const busy = useSelector((state: RootState) => !['idle', 'ended', 'error'].includes(state.call.status) || state.call.mediaOwnership === 'TRANSFERRING');
  const desktop = typeof window !== 'undefined' && window.zvonokDesktop;
  const updates = desktop ? desktop.updates : undefined;
  const [state, setState] = useState<UpdateState | null>(null);
  const [error, setError] = useState('');
  const [native, setNative] = useState<DesktopPreferences | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let stopped = false;
    void (desktop && desktop.preferences?.get().then(value => { if (!stopped) setNative(value); }).catch(() => { if (!stopped) setError('Не удалось получить настройки приложения.'); }));
    return () => { stopped = true; };
  }, [desktop]);
  useEffect(() => {
    if (!updates) return;
    let stopped = false;
    void updates.get().then(value => { if (!stopped) setState(value); }).catch(() => setError('Не удалось получить состояние обновлений.'));
    const unsubscribe = updates.onState(setState);
    return () => { stopped = true; unsubscribe(); };
  }, [updates]);
  const labels = { disabled: 'Автоматические обновления пока недоступны в этой сборке', idle: 'Обновления не проверялись', checking: 'Проверка обновлений…', current: 'Установлена актуальная версия', available: 'Обновление найдено', downloading: 'Скачивание обновления', ready: 'Обновление готово', error: 'Ошибка обновления. Повторите позже' };
  if (section === 'window') return <section className={styles.application}>
    {native ? <>
      <label><input type="checkbox" checked={native.closeToTray} disabled={pending} onChange={async e => {
        const value = e.target.checked; setPending(true); setError('');
        try { const closeToTray = desktop ? await desktop.preferences?.setCloseToTray(value) : undefined; if (typeof closeToTray === 'boolean') setNative({...native, closeToTray}); }
        catch { setError('Не удалось сохранить поведение окна.'); } finally { setPending(false); }
      }}/>При закрытии скрывать окно в системный трей</label>
      <p>При выключении закрытие завершает приложение. Во время звонка требуется подтверждение. Размеры и положение окна запоминаются автоматически.</p>
      <p>Внешняя панель открывается кнопкой в свёрнутом звонке; режим поверх окон переключается на самой панели.</p>
    </> : <p>{desktop ? 'Загружаем возможности приложения…' : 'Поведение окна и внешняя панель доступны в приложении для Windows.'}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
  return <section className={styles.application} aria-label="Обновления Zvonok">
    {state ? <>
      <p>Версия Zvonok: <strong>{state.installedVersion}</strong></p>
      {state.notice === 'install-failed' && <p role="alert">Не удалось установить обновление. Текущая версия сохранена. Повторите установку вручную.</p>}
      {state.notice === 'installed' && <p role="status">Обновление установлено. Версия подтверждена после запуска.</p>}
      <p role="status">{labels[state.status]}{state.version ? ` · ${state.version}` : ''}{state.status === 'downloading' && state.percent !== undefined ? ` · ${Math.round(state.percent)}%` : ''}.</p>
      {state.status === 'downloading' && <progress aria-label="Загрузка обновления" max={100} value={state.percent} />}
      {state.staging && state.status !== 'disabled' && <p>Установка обновлений недоступна в этой сборке.</p>}
      <div className={styles.actions}>
        <button type="button" disabled={pending || ['disabled', 'checking', 'available', 'downloading', 'ready'].includes(state.status)} onClick={async () => {
          setPending(true); setError('');
          try { await updates?.check(); } catch { setError('Не удалось проверить обновления.'); } finally { setPending(false); }
        }}>Проверить обновления</button>
        {state.status === 'ready' && !state.staging && <button type="button" disabled={pending || busy} onClick={async () => {
          setPending(true); setError('');
          try { await updates?.install(); } catch { setError('Завершите звонок и повторите перезапуск.'); } finally { setPending(false); }
        }}>{busy ? 'После завершения звонка' : 'Перезапустить и установить'}</button>}
      </div>
    </> : <p role="status">{desktop ? 'Получаем состояние обновлений…' : 'Обновления доступны в приложении Zvonok для Windows.'}</p>}
    {native && <details><summary>Об этом приложении</summary><p>Zvonok {native.version} · Electron {native.electron} · {native.platform}</p></details>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
