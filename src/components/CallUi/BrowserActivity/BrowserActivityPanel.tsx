import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Globe2, RotateCw } from 'lucide-react';
import { BrowserVideo } from './BrowserVideo';
import type { BrowserActivityState } from './useBrowserActivity';
import styles from './BrowserActivityPanel.module.css';

export function BrowserActivityPanel({ browser, visible }: { browser: BrowserActivityState; visible: boolean }) {
  const { activity, connected, canControl, busy, perform, input } = browser;
  const session = activity?.session, c = session?.collaboration;
  const [url, setUrl] = useState(session?.currentUrl ?? 'https://example.com');
  useEffect(() => { if (session?.currentUrl) setUrl(session.currentUrl); }, [session?.currentUrl]);
  const [navigating, setNavigating] = useState(false);
  const navigate = async (op: string, body?: unknown) => { setNavigating(true); try { await input(op, body); } finally { setNavigating(false); } };
  return <section className={`${styles.panel} browser-activity`} aria-label="Совместный браузер" data-activity-source={activity?.activityId}>
    <header className={styles.toolbar}>
      <Globe2 size={18} aria-hidden="true" />
      <div className={styles.identity}><strong>Совместный браузер</strong>
      <small role="status">{!connected ? 'Восстанавливаем подключение…' : canControl ? 'Вы управляете · друг смотрит' : c?.controller === 'local-owner' ? 'Управляет создатель браузера' : 'Управляет друг · вы смотрите'}</small></div>
      {activity?.owner ? <>
        {c?.request && <><span>Запрос управления</span><button disabled={!connected || busy} onClick={() => void perform('control/grant')}>Передать</button><button disabled={!connected || busy} onClick={() => void perform('control/decline')}>Отклонить</button></>}
        {c && c.controller !== c.identity && <button disabled={!connected || busy} onClick={() => void perform('control/revoke')}>Вернуть управление</button>}
        <button className={styles.end} disabled={busy} onClick={() => void perform('close')}>Завершить для всех</button>
      </> : <>
        {canControl ? <button disabled={!connected || busy} onClick={() => void perform('control/release')}>Вернуть управление хозяину</button>
          : <button disabled={!connected || busy || !!c?.request} onClick={() => void perform('control/request')}>{c?.request ? 'Запрос отправлен' : 'Запросить управление'}</button>}
        <button disabled={busy} onClick={() => void perform('leave')}>Покинуть браузер</button>
      </>}
      <button title="Остановить свой просмотр и звук сайта. Браузер останется доступен другу." onClick={() => browser.setShow(false)}>Свернуть браузер</button>
    </header>
    <form className={styles.navigation} onSubmit={e => { e.preventDefault(); void navigate('navigate', { url }); }}>
      {['back', 'forward', 'reload'].map((op, index) => { const Icon = [ArrowLeft, ArrowRight, RotateCw][index]; return <button type="button" key={op} aria-label={['Назад', 'Вперёд', 'Обновить'][index]} title={['Назад', 'Вперёд', 'Обновить'][index]} disabled={!canControl || navigating} onClick={() => void navigate(op)}><Icon size={16} aria-hidden="true" /></button>; })}
      <input aria-label="Адрес страницы" value={url} maxLength={2048} disabled={!canControl} onChange={e => setUrl(e.target.value)} />
      <button disabled={!canControl || navigating}>Перейти</button>
    </form>
    {navigating && <small role="status">Открываем страницу…</small>}
    {c?.request && !activity?.owner && <small role="status">Запрос отправлен. Создатель браузера может передать управление.</small>}
    {c?.result === 'declined' && <small role="status">Запрос управления отклонён. Можно продолжить просмотр.</small>}
    {c?.result === 'lease_expired' && <small role="status">Время управления истекло. Управление вернулось создателю браузера.</small>}
    {c?.result === 'granted' && <small role="status">{canControl ? 'Управление передано вам.' : 'Управление передано другу.'}</small>}
    {browser.error && <span role="alert">{browser.error}</span>}
    {visible && session?.status === 'active' && <BrowserVideo id={session.sessionId} connectMedia={browser.media} canControl={!!canControl} input={action => input('input', action)} />}
    {session?.status !== 'active' && <p role="status">Совместный браузер завершён. Голосовой звонок продолжается.</p>}
  </section>;
}

