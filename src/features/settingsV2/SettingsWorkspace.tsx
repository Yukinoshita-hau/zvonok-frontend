import type { SettingsTarget } from "./settingsNavigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { categories, fields, searchSettings } from "./SettingsRegistry";
import type { CategoryId, SettingDefinition } from "./SettingsRegistry";
import { SettingsSidebar } from "./SettingsSidebar";
import { SettingsSearch } from "./SettingsSearch";
import { SettingsSection } from "./SettingsSection";
import { SettingsField } from "./SettingsField";
import styles from "./SettingsWorkspace.module.css";
import { AccountSetting } from "../../components/AccountSetting/AccountSetting";
export function SettingsWorkspace({
  target,
  onTargetChange,
  onFormStateChange,
  visible = true,
  profileEpoch = 0,
  onClose,
}: {
  target?: SettingsTarget;
  onTargetChange?: (target: SettingsTarget) => boolean | void;
  onFormStateChange?: (state: {dirty: boolean; busy: boolean}) => void;
  visible?: boolean;
  profileEpoch?: number;
  onClose?: () => void;
} = {}) {
  const [active, setActive] = useState<CategoryId>(
    target?.category ?? "account",
  );
  const [query, setQuery] = useState("");
  const [subsection, setSubsection] = useState<string>(fields.find(field => field.id === target?.field)?.section ?? 'Микрофон');
  const [highlight, setHighlight] = useState<string | undefined>(target?.field);
  const [advanced, setAdvanced] = useState(
    !!fields.find(
      (field) =>
        field.id === target?.field && "advanced" in field && field.advanced,
    ),
  );
  const [returnTo, setReturnTo] = useState<{
    category: CategoryId;
    query: string;
  }>();
  const scroll = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const positions = useRef<Partial<Record<CategoryId, number>>>({});
  const focusTarget = useRef<string>("");
  const tabNavigation = useRef(false);
  const category = categories.find((item) => item.id === active)!;
  const media = active === 'media';
  function focusField(id: string) {
    const field = fields.find(item => item.id === id) as SettingDefinition | undefined;
    const element = field?.control ? scroll.current?.querySelector<HTMLElement>(field.control) : document.getElementById(`setting-${id}`);
    element?.focus({preventScroll:true});
    element?.scrollIntoView({block:'center'});
  }
  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(undefined), 1600);
    return () => clearTimeout(timer);
  }, [highlight]);
  useLayoutEffect(() => {
    if (visible && scroll.current) scroll.current.scrollTop = positions.current[active] ?? 0;
  }, [visible]);
  function navigate(id: CategoryId) {
    if (onTargetChange?.({ category: id }) === false) return;
    positions.current[active] = scroll.current?.scrollTop ?? 0;
    setSubsection('Микрофон');
    focusTarget.current = "heading";
    setHighlight(undefined);
    setActive(id);
    setQuery("");
    setReturnTo(undefined);
    if (id === active) heading.current?.focus();
  }
  function select(field: SettingDefinition) {
    if (onTargetChange?.({ category: field.category, field: field.id }) === false) return;
    positions.current[active] = scroll.current?.scrollTop ?? 0;
    setSubsection(field.section);
    setReturnTo({ category: active, query });
    setQuery("");
    setActive(field.category);
    setHighlight(field.id);
    if (field.advanced) setAdvanced(true);
    focusTarget.current = field.id;
  }
  useLayoutEffect(() => {
    if (!focusTarget.current) return;
    if (
      focusTarget.current !== "heading" &&
      focusTarget.current !== "restore"
    ) {
      focusField(focusTarget.current);
    } else {
      if (scroll.current)
        scroll.current.scrollTop = media ? 0 : positions.current[active] ?? 0;
      if (focusTarget.current === "heading")
        heading.current?.focus({ preventScroll: true });
    }
    focusTarget.current = "";
  }, [active, subsection, highlight, advanced, query]);
  useLayoutEffect(() => {
    if (tabNavigation.current) {
      tabNavigation.current = false;
      requestAnimationFrame(() => {
        if (scroll.current) scroll.current.scrollTop = 0;
        document.getElementById('media-panel')?.focus({preventScroll:true});
      });
      return;
    }
    if (!target) return;
    setActive(target.category);
    setHighlight(target.field);
    const field = fields.find((item) => item.id === target.field);
    setSubsection(field?.section ?? 'Микрофон');
    if (field && "advanced" in field && field.advanced) setAdvanced(true);
    const frame = requestAnimationFrame(() => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && scroll.current?.contains(focused) && focused.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (target.field) focusField(target.field);
      else {
        heading.current?.focus({preventScroll:true});
        if (scroll.current) scroll.current.scrollTop = 0;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [target?.category, target?.field]);
  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <h1>Настройки</h1>
        <div className={styles.headerSearch}>
          <SettingsSearch ref={search} query={query} results={searchSettings(query)} onQuery={setQuery} onSelect={select}/>
        </div>
        {onClose && <button onClick={onClose} aria-label="Закрыть настройки" title="Вернуться">✕</button>}
      </header>
      <div className={styles.body}>
        <SettingsSidebar active={active} onSelect={navigate} />
        <section aria-label="Содержимое настроек" ref={scroll} className={styles.content} onScroll={event => {
          if (visible) positions.current[active] = event.currentTarget.scrollTop;
        }}>
          <div className={styles.canvas}>
          {returnTo && (
            <button
              className={styles.back}
              onClick={() => {
                focusTarget.current = "restore";
                setSubsection('Микрофон');
                if (onTargetChange?.({ category: returnTo.category }) === false) return;
                setActive(returnTo.category);
                setQuery(returnTo.query);
                setHighlight(undefined);
                setReturnTo(undefined);
                search.current?.focus();
              }}
            >
              ← К результатам поиска
            </button>
          )}
          <h2 ref={heading} tabIndex={-1} className={styles.title}>
            {category.title}
          </h2>
          {(active === "account" || active === "appearance") && <p className={styles.notice}>
            {active === "account" ? "Профиль сохраняется на сервере после подтверждения. Предпросмотр показывает ваш черновик." : "Оформление применяется сразу после подтверждения и сохраняется на этом устройстве."}
          </p>}
          <nav className={styles.sections} aria-label="Подразделы" role={media ? 'tablist' : undefined}>
            {category.sections.map((section) => (
              <button
                key={section}
                aria-current={subsection === section ? "location" : undefined}
                role={media ? 'tab' : undefined}
                aria-selected={media ? subsection === section : undefined}
                aria-controls={media ? 'media-panel' : undefined}
                id={media ? `media-tab-${category.sections.findIndex(item=>item === section)}` : undefined}
                tabIndex={media && subsection !== section ? -1 : 0}
                onKeyDown={event => {
                  if (!media || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
                  event.preventDefault();
                  const buttons = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role=tab]'));
                  const index = buttons.indexOf(event.currentTarget);
                  buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length].click();
                }}
                onClick={() => {
                  if (media) {
                    const field = fields.find(item => item.category === 'media' && item.section === section)!;
                    tabNavigation.current = !!onTargetChange && target?.field !== field.id;
                    if (onTargetChange?.({category:'media',field:field.id}) === false) {tabNavigation.current = false; return;}
                    setHighlight(undefined);
                    focusTarget.current = '';
                    if (scroll.current) scroll.current.scrollTop = 0;
                    requestAnimationFrame(()=>document.getElementById('media-panel')?.focus({preventScroll:true}));
                  }
                  setSubsection(section);
                  if (section === "Расширенная обработка") setAdvanced(true);
                  if (media) return;
                  requestAnimationFrame(() => {
                    const target = document.getElementById(
                      `section-${active}-${section}`,
                    );
                    target?.focus();
                    target?.scrollIntoView({ block: "start" });
                  });
                }}
              >
                {section === 'Демонстрация экрана' ? 'Экран' : section === 'Расширенная обработка' ? 'Обработка' : section}
              </button>
            ))}
          </nav>
          <div hidden={active !== 'account'} id="section-account-Профиль" tabIndex={-1}>
            <SettingsSection title="Профиль">
            <article id="setting-profile" tabIndex={-1} className={styles.field}>
              <AccountSetting key={profileEpoch} compact onFormStateChange={onFormStateChange}/>
            </article>
            </SettingsSection>
          </div>
          <div className={styles.categoryPanels} data-category={active}>
          {category.sections.filter(section=>(active !== 'account' || section !== 'Профиль') && (!media || section === subsection)).map((section) => {
            const content = (
              <SettingsSection title={section}>
                {fields
                  .filter(
                    (field) =>
                      field.category === active && field.section === section && field.id !== 'profile' && !('targetOnly' in field && field.targetOnly),
                  )
                  .map((field) => (
                    (visible || (active !== 'media' && active !== 'shortcuts')) && <SettingsField
                      key={field.id}
                      field={field}
                      highlighted={highlight === field.id || !!highlight && fields.find(item=>item.id===highlight)?.section === section}
                      advanced={advanced && !!highlight}
                    />
                  ))}
              </SettingsSection>
            );
            return (
              <div
                key={section}
                id={media ? 'media-panel' : `section-${active}-${section}`}
                data-media-panel={media ? section : undefined}
                role={media ? 'tabpanel' : undefined}
                aria-labelledby={media ? `media-tab-${category.sections.findIndex(item=>item === section)}` : undefined}
                className={styles.panelView}
                data-primary={section === category.sections[0] || undefined}
                tabIndex={-1}
              >
                {section === "Расширенная обработка" ? (
                  <details
                    open={advanced}
                    onToggle={(event) => setAdvanced(event.currentTarget.open)}
                  >
                    <summary>Расширенная обработка</summary>
                    {content}
                  </details>
                ) : (
                  content
                )}
              </div>
            );
          })}
          </div>
          </div>
        </section>
      </div>
    </div>
  );
}
