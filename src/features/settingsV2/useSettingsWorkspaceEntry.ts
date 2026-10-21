import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  readSettingsTarget,
  settingsHash,
  settingsV2Enabled,
  SETTINGS_SLOT_ID,
  settingsFocus,
} from "./settingsNavigation";
export function useSettingsWorkspaceEntry(
  isOpen: boolean,
  onClose: () => void,
): boolean {
  const location = useLocation();
  const navigate = useNavigate();
  const enabled =
    settingsV2Enabled() &&
    typeof document !== "undefined" &&
    !!document.getElementById(SETTINGS_SLOT_ID);
  useEffect(() => {
    if (!isOpen || !enabled) return;
    settingsFocus.opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!readSettingsTarget(location.hash))
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: settingsHash(settingsFocus.target ?? { category: "account" }),
        },
        { state: { ...location.state, settingsV2Entry: true } },
      );
    onClose();
  }, [
    isOpen,
    enabled,
    location.pathname,
    location.search,
    location.hash,
    location.state,
    navigate,
    onClose,
  ]);
  return enabled;
}
