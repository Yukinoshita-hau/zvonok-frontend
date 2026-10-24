import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Globe2, MoreHorizontal, Plus, RotateCw, X } from 'lucide-react';
import { BrowserVideo } from './BrowserVideo';
import type { BrowserActivityState } from './useBrowserActivity';
import styles from './BrowserActivityPanel.module.css';
import { resolveBrowserAddress } from './resolveBrowserAddress';

const profileNames: Record<string, string> = { '720p15': 'Экономия данных', '720p30': 'Сбалансированно', '720p60': 'Плавно', '1080p30': 'Высокая чёткость', '1080p60': 'Максимальная чёткость' };

export function BrowserActivityPanel({ browser, visible, compact = false }: { browser: BrowserActivityState; visible: boolean; compact?: boolean }) {
  const { activity, connected, canControl, busy, perform, input } = browser;
  const session = activity?.session, c = session?.collaboration;
  const [url, setUrl] = useState(session?.currentUrl ?? 'https://example.com');
  const [errorDismissed, setErrorDismissed] = useState(false);
  useEffect(() => { if (session?.currentUrl) setUrl(session.currentUrl); }, [session?.currentUrl]);
  useEffect(() => setErrorDismissed(false), [browser.error]);
  const [navigating, setNavigating] = useState(false);
  const profile = session?.media?.profile ?? '720p15';
  const navigate = async (op: string, body?: unknown) => { setNavigating(true); try { await input(op, body); } finally { setNavigating(false); } };
  return <section className={`${styles.panel} browser-activity`} data-compact={compact} aria-label="Совместный браузер" data-activity-source={activity?.activityId}>
    {compact && <button className={styles.openTile} aria-label="Открыть совместный браузер" disabled={busy} onClick={() => activity?.joined ? browser.setShow(true) : void perform('join')}>
      <Globe2 size={20} aria-hidden="true" /><strong>Совместный браузер</strong>
      <span>{busy ? 'Подключаем…' : activity?.joined ? 'Открыть браузер' : 'Открыть и присоединиться'}</span>
      <small>{session?.currentUrl || 'Браузер в вашем звонке'}</small>
    </button>}
    <header className={styles.toolbar}>
      <Globe2 size={18} aria-hidden="true" />
      <div className={styles.identity}><strong>Совместный браузер</strong>
      <small role="status">{!connected ? 'Восстанавливаем подключение…' : canControl ? 'Вы управляете' : c?.controller === 'local-owner' ? 'Управляет создатель' : 'Управляет друг'}{session?.media?.profile ? ` · ${profileNames[session.media.profile] ?? 'Качество видео'}` : ''}</small>
      </div>
      {activity?.owner && c?.request && <><span className={styles.request}>Запрос управления</span><button disabled={!connected || busy} onClick={() => void perform('control/grant')}>Передать</button><button disabled={!connected || busy} onClick={() => void perform('control/decline')}>Отклонить</button></>}
      <details className={styles.menu}>
        <summary aria-label="Настройки совместного браузера" title="Настройки"><MoreHorizontal size={18} aria-hidden="true" /></summary>
        <div className={styles.menuItems}>
          <label>Качество видео
            <select aria-label="Качество видео" value={profile} disabled={!canControl || busy} onChange={e => void input('quality', { profile: e.target.value })}>
              <option value="720p15">Экономия данных · 720p · 15 кадров/с</option>
              <option value="720p30">Сбалансированно · 720p · 30 кадров/с</option>
              <option value="720p60">Плавно · 720p · 60 кадров/с</option>
              <option value="1080p30">Высокая чёткость · 1080p · 30 кадров/с</option>
              <option value="1080p60">Максимальная чёткость · 1080p · 60 кадров/с</option>
            </select>
          </label>
          {activity?.owner ? <>
            {c && c.controller !== c.identity && <button disabled={!connected || busy} onClick={() => void perform('control/revoke')}>Вернуть управление</button>}
            <button className={styles.end} disabled={busy} onClick={() => void perform('close')}>Завершить для всех</button>
          </> : <>
            {canControl ? <button disabled={!connected || busy} onClick={() => void perform('control/release')}>Вернуть управление хозяину</button>
              : <button disabled={!connected || busy || !!c?.request} onClick={() => void perform('control/request')}>{c?.request ? 'Запрос отправлен' : 'Запросить управление'}</button>}
            <button disabled={busy} onClick={() => void perform('leave')}>Покинуть браузер</button>
          </>}
        </div>
      </details>
      <button title="Вернуться к звонку. Браузер продолжит работать." onClick={() => browser.setShow(false)}>К звонку</button>
    </header>
    {!compact && session?.status === 'active' && <div className={styles.tabs} role="tablist" aria-label="Вкладки совместного браузера">
      {session.tabs?.map(tab => <div className={styles.tab} key={tab.id}>
        <button role="tab" aria-selected={session.activeTabId === tab.id} title={tab.title} onClick={() => void input('tabs/activate', { tabId: tab.id })} disabled={!canControl}>
          <span className={styles.tabTitle}>{tab.title || 'Новая вкладка'}</span>
        </button>
        <button className={styles.closeTab} aria-label={`Закрыть вкладку ${tab.title || 'Новая вкладка'}`} onClick={() => void input('tabs/close', { tabId: tab.id })} disabled={!canControl}>
          <X size={13} aria-hidden="true" />
        </button>
      </div>)}
      <button className={styles.newTab} aria-label="Новая вкладка" title="Новая вкладка" onClick={() => void input('tabs/create')} disabled={!canControl || (session.tabs?.length ?? 0) >= 10}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>}
    <form className={styles.navigation} onSubmit={e => { e.preventDefault(); const address = resolveBrowserAddress(url); setUrl(address); void navigate('navigate', { url: address }); }}>
      {['back', 'forward', 'reload'].map((op, index) => { const Icon = [ArrowLeft, ArrowRight, RotateCw][index]; return <button type="button" key={op} aria-label={['Назад', 'Вперёд', 'Обновить'][index]} title={['Назад', 'Вперёд', 'Обновить'][index]} disabled={!canControl || navigating} onClick={() => void navigate(op)}><Icon size={16} aria-hidden="true" /></button>; })}
      <input aria-label="Адрес страницы" value={url} maxLength={2048} disabled={!canControl} onChange={e => setUrl(e.target.value)} />
      <button disabled={!canControl || navigating}>Перейти</button>
    </form>
    {navigating && <small role="status">Открываем страницу…</small>}
    {c?.request && !activity?.owner && <small role="status">Запрос отправлен. Создатель браузера может передать управление.</small>}
    {c?.result === 'declined' && <small role="status">Запрос управления отклонён. Можно продолжить просмотр.</small>}
    {c?.result === 'lease_expired' && <small role="status">Время управления истекло. Управление вернулось создателю браузера.</small>}
    {c?.result === 'granted' && <small role="status">{canControl ? 'Управление передано вам.' : 'Управление передано другу.'}</small>}
    {browser.error && !errorDismissed && <div className={styles.error} role="alert"><span>{browser.error}</span><button aria-label="Скрыть сообщение" onClick={() => setErrorDismissed(true)}><X size={14} aria-hidden="true" /></button></div>}
    {session?.status === 'active' && <div className={styles.videoHost} data-testid="browser-media-preview" hidden={!visible}><BrowserVideo key={`${session.sessionId}:${session.media?.epoch ?? ''}`} id={session.sessionId} targetFps={session.media?.fps ?? 15} connectMedia={browser.media} canControl={!!canControl && !compact && visible} input={action => input('input', action)} /></div>}
    {activity?.joined && session?.status !== 'active' && <p role="status">{session?.status === 'creating' ? 'Запускаем браузер…' : 'Совместный браузер завершён. Голосовой звонок продолжается.'}</p>}
  </section>;
}

