import type { SettingState } from "./SettingsRegistry";
const labels: Record<SettingState, string> = {
  idle: "Без изменений",
  applying: "Применяется…",
  success: "Применено",
  error: "Не удалось применить",
  unsupported: "Недоступно в этой версии",
};
export function SettingsStatus({ state }: { state: SettingState }) {
  return (
    <span role={state === "error" ? "alert" : "status"}>{labels[state]}</span>
  );
}
