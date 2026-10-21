import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import type { UpdateState } from '../../../electron/desktopTypes';
import styles from './DesktopRuntimeBridge.module.css';

export function DesktopRuntimeBridge() {
  const call = useSelector((s: RootState) => s.call);
  const busy = !['idle', 'ended', 'error'].includes(call.status) || call.mediaOwnership === 'TRANSFERRING';
  const bridge = window.zvonokDesktop;
  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [later, setLater] = useState(() => { try { return localStorage.getItem('zvonok.updateDismissed') ?? ''; } catch { return ''; } });
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!call.callId) return;
    const callId = call.callId;
    const dismiss = () => { void bridge?.notifications?.dismissCall?.(callId).catch(() => {}); };
    if (call.status !== 'incoming_ringing') dismiss();
    return dismiss;
  }, [bridge, call.callId, call.status]);
  useEffect(() => {
    if (!bridge?.lifecycle) return;
    const publish = () => { void bridge.lifecycle!.publish(busy).catch(() => {}); };
    publish(); const timer = setInterval(publish, 5000);
    window.addEventListener('focus', publish);
    const unsubscribe = bridge.onResume?.(publish);
    return () => { clearInterval(timer); window.removeEventListener('focus', publish); unsubscribe?.(); };
  }, [bridge, busy]);
  useEffect(() => {
    if (!bridge?.updates) return;
    let stopped = false;
    void bridge.updates.get().then(state => { if (!stopped) setUpdate(state); }).catch(() => {});
    const unsubscribe = bridge.updates.onState(state => { setUpdate(state); });
    return () => { stopped = true; unsubscribe(); };
  }, [bridge]);
  const updateKey = update ? `${update.installedVersion}:${update.version}` : '';
  if (!update || update.status !== 'ready' || later === updateKey) return null;
  return <aside role="status" aria-live="polite" className={`${styles.notice} ${busy ? styles.duringCall : ''}`} aria-label="Обновление приложения">
    <strong>Обновление Zvonok готово</strong>
    {update.version && <span className={styles.version}>Версия {update.version}</span>}
    <p>{update.staging ? 'Установка недоступна в этой сборке.' : busy ? 'Установите обновление после завершения звонка.' : 'Установите обновление, когда вам удобно.'}</p>
    <div className={styles.actions}>
      {!update.staging && <button className={styles.primary} type="button" disabled={busy || installing} onClick={async () => {
        setInstalling(true); setError('');
        try { await bridge?.updates?.install(); } catch { setError('Не удалось перезапустить приложение. Повторите после звонка.'); }
        finally { setInstalling(false); }
      }}>{installing ? 'Подтверждение…' : 'Перезапустить'}</button>}
      <button type="button" onClick={() => { setLater(updateKey); try { localStorage.setItem('zvonok.updateDismissed', updateKey); } catch { /* Dismissal still applies in this document. */ } }}>Позже</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </aside>;
}

