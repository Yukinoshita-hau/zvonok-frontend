import { Globe2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useId } from 'react';
import { useModalFocus } from '../../../hooks/useModalFocus';
import type { BrowserActivityState } from './useBrowserActivity';
import styles from './BrowserActivityPanel.module.css';

export function ActivitySelection({ browser, onClose }: { browser: BrowserActivityState; onClose: () => void }) {
  const title = useId();
  const ref = useModalFocus(true, onClose);
  async function openBrowser() {
    if (browser.activity?.joined) { browser.setShow(true); onClose(); }
    else await browser.perform(browser.activity ? 'join' : 'create');
  }
  return createPortal(<div className={styles.backdrop}>
    <div ref={ref} className={styles.selection} role="dialog" aria-modal="true" aria-labelledby={title} tabIndex={-1}>
      <header className={styles.toolbar}><h2 id={title}>Вместе в звонке</h2><button aria-label="Закрыть выбор активностей" onClick={onClose}><X size={18} aria-hidden="true" /></button></header>
      <p>Выберите занятие для вас двоих.</p>
      <button className={styles.activityCard} aria-label="Совместный браузер" disabled={browser.busy} onClick={() => void openBrowser()}>
        <Globe2 size={26} aria-hidden="true" /><span><strong>Совместный браузер</strong><small>Одна страница на двоих · отдельный звук сайта</small></span>
      </button>
      {browser.busy && <p role="status">Запускаем браузер… Это может занять несколько секунд.</p>}
      {browser.error && <p role="alert">{browser.error}</p>}
      <p className={styles.hint}>Голосовой звонок продолжится. Друг увидит приглашение в этом звонке.</p>
    </div>
  </div>, document.body);
}
