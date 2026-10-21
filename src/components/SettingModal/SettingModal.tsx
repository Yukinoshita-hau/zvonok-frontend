import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search } from 'lucide-react';
import { useModalFocus } from '../../hooks/useModalFocus';
import styles from './SettingModal.module.css';
import type { SettingModalProps } from './SettingModal.props';
import { navigateSections, SECTIONS } from './SettingSections';
import { SettingSectionsSelector } from '../SettingSectionsSelector/SettingSectinoSelector';
import { useSettingsWorkspaceEntry } from '../../features/settingsV2/useSettingsWorkspaceEntry';

export function SettingModal(props: SettingModalProps) {
  const workspace = useSettingsWorkspaceEntry(props.isOpen, props.onClose);
  return <LegacySettingModal {...props} isOpen={props.isOpen && !workspace} />;
}

export function LegacySettingModal({ isOpen, onClose }: SettingModalProps) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<string>(SECTIONS.ACCOUNT);
  const [form, setForm] = useState({dirty:false,busy:false});
  const canLeave = () => !form.busy && (!form.dirty || window.confirm('Есть несохранённые изменения профиля. Отменить их?'));
  const close = () => { if (canLeave()) onClose(); };
  const ref = useModalFocus(isOpen, close);
  useEffect(() => {
    if (!isOpen) { setForm({dirty:false,busy:false}); setSection(SECTIONS.ACCOUNT); setQuery(''); }
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen || (!form.dirty && !form.busy)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isOpen, form]);
  if (!isOpen) return null;
  const sections = navigateSections.filter(name=>name.toLowerCase().includes(query.trim().toLowerCase()));
  return createPortal(
    <div className={styles.backdrop} onClick={event=>{event.stopPropagation();close();}}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Настройки пользователя" tabIndex={-1}
        className={styles.modal} onClick={event=>event.stopPropagation()}>
        <nav className={styles['navigation-bar']} aria-label="Разделы настроек">
          <span className={styles.brand}>ZVONOK <small>Настройки пользователя</small></span>
          <label className={styles.search}><Search size={16}/><input aria-label="Поиск настроек" placeholder="Поиск" value={query} onChange={e=>setQuery(e.target.value)}/></label>
          {sections.map(name=><button key={name} className={styles['navigation-btn']} aria-current={name===section?'page':undefined}
            onClick={()=>{ if (name!==section && canLeave()) {setForm({dirty:false,busy:false});setSection(name);} }}>{name}</button>)}
          {!sections.length && <p>Раздел не найден</p>}
          <p className={styles.hint}>Параметры устройств и темы сохраняются автоматически на этом устройстве.</p>
        </nav>
        <main className={styles.content}>
          <header className={styles.header}><h2>{section}</h2><button disabled={form.busy} className={styles.close} onClick={close} aria-label="Закрыть настройки"><X size={20}/><small>Esc</small></button></header>
          <div className={styles.body}><SettingSectionsSelector sectionName={section} onFormStateChange={setForm} onClose={close}/></div>
        </main>
      </div>
    </div>, document.body);
}
