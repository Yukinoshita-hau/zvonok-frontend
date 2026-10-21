import { forwardRef } from "react";
import type { SettingDefinition } from "./SettingsRegistry";
import styles from "./SettingsWorkspace.module.css";
import { Search } from 'lucide-react';
export const SettingsSearch = forwardRef<
  HTMLInputElement,
  {
    query: string;
    results: readonly SettingDefinition[];
    onQuery: (value: string) => void;
    onSelect: (field: SettingDefinition) => void;
  }
>(function SettingsSearch({ query, results, onQuery, onSelect }, ref) {
  return (
    <div className={styles.search}>
      <div className={styles.searchInput}>
        <Search aria-hidden="true"/>
        <input
          ref={ref}
          id="settings-search"
          type="search"
          aria-label="Поиск по настройкам"
          placeholder="Поиск по настройкам..."
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.stopPropagation();
              event.preventDefault();
              onQuery("");
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              event.currentTarget
                .closest("div")
                ?.parentElement?.querySelector<HTMLButtonElement>(
                  "[data-result]",
                )
                ?.focus();
            }
          }}
        />
        {query && (
          <button
            onClick={() => {
              onQuery("");
              if (ref && "current" in ref) ref.current?.focus();
            }}
          >
            Очистить
          </button>
        )}
      </div>
      {query.trim() && (
        <div className={styles.results}>
          <p role="status">Найдено: {results.length}</p>
          {results.map((field) => (
            <button
              data-result
              key={field.id}
              onClick={() => onSelect(field)}
              onKeyDown={(event) => {
                const buttons = Array.from(
                  event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                    "[data-result]",
                  ),
                );
                const index = buttons.indexOf(event.currentTarget);
                if (event.key === "Escape") {
                  event.stopPropagation();
                  onQuery("");
                  if (ref && "current" in ref) ref.current?.focus();
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  buttons[
                    (index +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      buttons.length) %
                      buttons.length
                  ].focus();
                }
              }}
            >
              {field.title}
              <small>
                {field.section} · {field.description}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
