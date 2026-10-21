import { categories, fields } from "./SettingsRegistry";
import type { CategoryId } from "./SettingsRegistry";
export const SETTINGS_SLOT_ID = "zvonok-settings-content";
export const SETTINGS_FLAG_KEY = "zvonok.settingsV2";
export const SETTINGS_ROLLBACK_KEY = "zvonok.settingsUI";
export type SettingsTarget = { category: CategoryId; field?: string };
export function settingsV2Enabled(storage?: Pick<Storage, "getItem">): boolean {
  try {
    return (
      (storage ?? globalThis.localStorage)?.getItem(SETTINGS_ROLLBACK_KEY) !== "legacy"
    );
  } catch {
    return true;
  }
}
export function readSettingsTarget(hash: string): SettingsTarget | undefined {
  const match = /^#settings-v2\/([a-z]+)(?:\/([a-z-]+))?$/.exec(hash);
  if (!match || !categories.some((category) => category.id === match[1]))
    return;
  const category = match[1] as CategoryId;
  if (
    match[2] &&
    !fields.some(
      (field) => field.id === match[2] && field.category === category,
    )
  )
    return;
  return { category, ...(match[2] ? { field: match[2] } : {}) };
}
export function settingsHash(target: SettingsTarget): string {
  return `#settings-v2/${target.category}${target.field ? `/${target.field}` : ""}`;
}
export const settingsFocus = {
  opener: null as HTMLElement | null,
  target: undefined as SettingsTarget | undefined,
};
