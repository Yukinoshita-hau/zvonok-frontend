import { useSelector } from "react-redux";
import type { RootState } from "../../store/store";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useBlocker, useLocation, useNavigate } from "react-router-dom";
import { LegacySettingModal } from "../../components/SettingModal/SettingModal";
import { SettingsWorkspace } from "./SettingsWorkspace";
import {
  readSettingsTarget,
  settingsHash,
  settingsV2Enabled,
  SETTINGS_SLOT_ID,
  settingsFocus,
} from "./settingsNavigation";
import type { SettingsTarget } from "./settingsNavigation";
import styles from "./SettingsIntegration.module.css";
import { useModalFocus } from "../../hooks/useModalFocus";
export function SettingsContentSlot({ children, overlay = false }: { children: ReactNode; overlay?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const enabled = settingsV2Enabled();
  const expanded = useSelector((state: RootState) =>
    ["connecting", "in_call"].includes(state.call.status) && state.call.presentationMode === "expanded",
  );
  const requested = readSettingsTarget(location.hash);
  const target = enabled ? requested : undefined;
  const legacyFallback = !!requested && !enabled;
  const open = !!target;
  const modal = expanded || overlay;
  const panel = useModalFocus<HTMLElement>(open && modal, close, false);
  const [visited, setVisited] = useState(open);
  const previousOpen = useRef(false);
  const route = useRef<HTMLDivElement>(null);
  const form = useRef({dirty:false,busy:false});
  const [formEpoch,setFormEpoch] = useState(0);
  const canLeave = () => !form.current.busy && (!form.current.dirty || window.confirm('Отменить несохранённые изменения профиля?'));
  const blocker = useBlocker(({currentLocation,nextLocation})=>{
    if (currentLocation.pathname === nextLocation.pathname && currentLocation.search === nextLocation.search && readSettingsTarget(nextLocation.hash)?.category === 'account') return false;
    if (!canLeave()) return true;
    if (form.current.dirty) {form.current={dirty:false,busy:false};setFormEpoch(value=>value+1);}
    return false;
  });
  useEffect(() => {
    if (!open || !expanded) return;
    const stages = Array.from(document.querySelectorAll<HTMLElement>('[data-call-stage]'));
    const previous = stages.map(stage => stage.inert);
    stages.forEach(stage => { stage.inert = true; });
    return () => stages.forEach((stage, index) => { stage.inert = previous[index]; });
  }, [open, expanded]);
  useEffect(() => {
    if (blocker.state === 'blocked') blocker.reset();
  },[blocker]);
  useEffect(() => {
    if (target) settingsFocus.target = target;
  }, [target?.category, target?.field]);
  useEffect(() => {
    if (open) {
      setVisited(true);
      const frame = requestAnimationFrame(() => {
          // Opening focus must not interrupt a user who has already started editing.
          const focused = document.activeElement;
          if (focused instanceof HTMLElement && panel.current?.contains(focused) && focused.matches('input, textarea, select, [contenteditable="true"]')) return;
        const field =
          target?.field && document.getElementById(`setting-${target.field}`);
        (field || document.getElementById("settings-search"))?.focus({
          preventScroll: true,
        });
        field && field.scrollIntoView({ block: "center" });
      });
      previousOpen.current = true;
      return () => cancelAnimationFrame(frame);
    }
    if (previousOpen.current) {
      (settingsFocus.opener?.isConnected
        ? settingsFocus.opener
        : route.current
      )?.focus({ preventScroll: true });
      previousOpen.current = false;
    }
  }, [open]);
  function close() {
    if (!canLeave()) return;
    form.current={dirty:false,busy:false};
    setFormEpoch(value=>value+1);
    if (location.state?.settingsV2Entry) navigate(-(1 + (location.state.settingsV2Depth ?? 0)));
    else
      navigate(
        { pathname: location.pathname, search: location.search, hash: "" },
        { replace: true, state: location.state },
      );
  }
  function changeTarget(next: SettingsTarget) {
    if (next.category === target?.category && next.field === target?.field) return;
    if (next.category !== target?.category && !canLeave()) return false;
    if (next.category !== target?.category && form.current.dirty) {form.current={dirty:false,busy:false};setFormEpoch(value=>value+1);}
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: settingsHash(next),
      },
      { state: {...location.state, settingsV2Depth: (location.state?.settingsV2Depth ?? 0) + 1} },
    );
  }
  return (
    <div id={SETTINGS_SLOT_ID} className={styles.slot}>
      {children && <div
        ref={route}
        tabIndex={-1}
        hidden={open}
        inert={open}
        className={styles.route}
      >
        {children}
      </div>}
      {(visited || open) && (
        <section
          ref={panel}
          hidden={!open}
          className={`${styles.integration} ${modal ? styles.overlay : ''}`}
          role={modal ? 'dialog' : undefined}
          aria-modal={modal ? true : undefined}
          aria-label="Настройки"
          onKeyDown={(event) => {
            if (
              event.key === "Escape" &&
              !event.defaultPrevented
            ) {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className={styles.workspace}>
            <SettingsWorkspace onClose={close} profileEpoch={formEpoch} visible={open} target={target} onTargetChange={changeTarget} onFormStateChange={state=>{form.current=state;}} />
          </div>
        </section>
      )}
      <LegacySettingModal
        isOpen={legacyFallback}
        onClose={close}
      />
    </div>
  );
}
