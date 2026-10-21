import { categories } from "./SettingsRegistry";
import type { CategoryId } from "./SettingsRegistry";
import styles from "./SettingsWorkspace.module.css";
import { UserRound, Headphones, Bell, Palette, Keyboard, SlidersHorizontal } from 'lucide-react';
const icons = {account:UserRound,media:Headphones,notifications:Bell,appearance:Palette,shortcuts:Keyboard,application:SlidersHorizontal};
export function SettingsSidebar({
  active,
  onSelect,
}: {
  active: CategoryId;
  onSelect: (id: CategoryId) => void;
}) {
  return (
    <nav className={styles.sidebar} aria-label="Разделы настроек">
      {categories.map((item) => { const Icon = icons[item.id]; return (
        <button
          key={item.id}
          title={item.title}
          aria-label={item.title}
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => onSelect(item.id)}
          onKeyDown={(event) => {
            const buttons = Array.from(
              event.currentTarget.parentElement!.querySelectorAll("button"),
            );
            const index = buttons.indexOf(event.currentTarget);
            const next =
              event.key === "ArrowDown"
                ? (index + 1) % buttons.length
                : event.key === "ArrowUp"
                  ? (index - 1 + buttons.length) % buttons.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? buttons.length - 1
                      : -1;
            if (next >= 0) {
              event.preventDefault();
              buttons[next].focus();
            }
          }}
        >
          <Icon aria-hidden="true"/><span>{item.title}</span>
        </button>
      );})}
    </nav>
  );
}
