import { useEffect, useId, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import {
  customThemeVariables,
  defaultCustomTheme,
  parseColor,
  replaceColorRgb,
  themes,
  uiActions,
  type CustomTheme,
  type UiState,
} from "../../store/slices/ui.slice";
import { THEME_DETAILS } from "../../components/UiSetting/ThemeDetails";
import { SettingsStatus } from "./SettingsStatus";
import styles from "./AppearanceSettings.module.css";

const groups: [string, [keyof CustomTheme, string][]][] = [
  [
    "Поверхности",
    [
      ["bgPrimary", "Основной фон"],
      ["bgSecondary", "Фон панелей"],
      ["bgTertiary", "Sidebar"],
      ["bgInput", "Поля ввода"],
    ],
  ],
  [
    "Текст",
    [
      ["textPrimary", "Основной текст"],
      ["textSecondary", "Вторичный текст"],
    ],
  ],
  [
    "Акценты",
    [
      ["accent", "Акцент"],
      ["border", "Границы"],
    ],
  ],
];

function ColorField({
  name,
  label,
  value,
  onApply,
}: {
  name: keyof CustomTheme;
  label: string;
  value: string;
  onApply: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = parseColor(draft);
  const changed = draft !== value;
  return (
    <div className={styles.colorRow}>
      <label htmlFor={id}>
        {label}
        <small>В палитре: {value}</small>
      </label>
      <input
        aria-label={`Палитра: ${label}`}
        type="color"
        value={(valid ?? parseColor(value))!.rgb}
        onChange={(e) => setDraft(replaceColorRgb(draft, e.target.value))}
      />
      <input
        id={id}
        data-color={name}
        value={draft}
        aria-invalid={!valid}
        aria-describedby={!valid ? `${id}-error` : undefined}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
      />
      <span
        className={styles.swatch}
        aria-label={`Предпросмотр: ${label}`}
        style={{ background: valid ? draft : value }}
      />
      <button
        type="button"
        disabled={!valid || !changed}
        onClick={() => onApply(draft)}
      >
        Применить {label.toLowerCase()}
      </button>
      <button type="button" disabled={!changed} onClick={() => setDraft(value)}>
        Отменить {label.toLowerCase()}
      </button>
      <button
        type="button"
        disabled={value === defaultCustomTheme[name]}
        onClick={() => {
          setDraft(defaultCustomTheme[name]);
          onApply(defaultCustomTheme[name]);
        }}
      >
        Сбросить {label.toLowerCase()}
      </button>
      {!valid && (
        <span id={`${id}-error`} role="alert">
          Введите HEX, RGB или RGBA с допустимыми каналами и alpha 0–1.
        </span>
      )}
    </div>
  );
}

export function paletteContrast(palette: CustomTheme): number {
  const luminance = (color: string, background = "#000000"): number => {
    const parsed = parseColor(color)!;
    const bg = parseColor(background)!.rgb;
    return [1, 3, 5]
      .map(
        (i) =>
          (parseInt(parsed.rgb.slice(i, i + 2), 16) * parsed.alpha +
            parseInt(bg.slice(i, i + 2), 16) * (1 - parsed.alpha)) /
          255,
      )
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  };
  return Math.min(
    ...[
      palette.bgPrimary,
      palette.bgSecondary,
      palette.bgTertiary,
      palette.bgInput,
    ].flatMap((bg) =>
      [palette.textPrimary, palette.textSecondary, palette.accent].map((fg) => {
        const a = luminance(fg, bg),
          b = luminance(bg);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }),
    ),
  );
}

export function AppearanceSettings({
  section,
}: {
  section?: "theme" | "colors";
}) {
  const ui = useSelector((s: RootState) => s.ui);
  const dispatch = useDispatch<AppDispatch>();
  const [previous, setPrevious] = useState<UiState>();
  const [revision, setRevision] = useState(0);
  const [applied, setApplied] = useState<boolean>();
  useEffect(() => {
    if (!revision) return;
    const root = document.documentElement;
    setApplied(
      root.dataset.theme === ui.theme &&
        (ui.theme !== "custom" ||
          Object.entries(customThemeVariables).every(
            ([key, variable]) =>
              getComputedStyle(root).getPropertyValue(variable).trim() ===
              ui.customTheme[key as keyof CustomTheme].trim(),
          )),
    );
  }, [ui, revision]);
  function change(run: () => void) {
    setApplied(undefined);
    setPrevious(ui);
    run();
    setRevision((n) => n + 1);
  }
  return (
    <div className={styles.appearance}>
      {section !== "colors" && (
        <div className={styles.cards} role="group" aria-label="Темы Zvonok">
          {themes.map((theme) => (
            <button
              type="button"
              key={theme}
              aria-pressed={ui.theme === theme}
              onClick={() => change(() => dispatch(uiActions.setTheme(theme)))}
            >
              <strong>{THEME_DETAILS[theme].title}</strong>
              <span className={styles.preview} aria-hidden="true">
                {(theme === "custom"
                  ? [
                      ui.customTheme.bgPrimary,
                      ui.customTheme.bgSecondary,
                      ui.customTheme.textPrimary,
                      ui.customTheme.accent,
                    ]
                  : THEME_DETAILS[theme].preview
                ).map((color, index) => (
                  <i key={index} style={{ background: color }} />
                ))}
              </span>
              <small>{ui.theme === theme ? "Активна" : "Выбрать"}</small>
            </button>
          ))}
        </div>
      )}
      {section !== "theme" && (
        <>
          <h3>Пользовательская тема</h3>
          <p>{ui.theme === "custom" ? "Палитра сейчас применяется." : `Сейчас выбрана тема «${THEME_DETAILS[ui.theme].title}». Подтверждение цвета включает «Своя».`}</p>
          <p>
            HEX, RGB или RGBA. Палитра меняет RGB, сохраняя прозрачность.
            Изменения применяются после подтверждения.
          </p>
          {groups.map(([title, colors]) => (
            <fieldset key={title}>
              <legend>{title}</legend>
              {colors.map(([key, label]) => (
                <ColorField
                  key={key}
                  name={key}
                  label={label}
                  value={ui.customTheme[key]}
                  onApply={(value) =>
                    change(() => {
                      dispatch(uiActions.setCustomTheme({ [key]: value }));
                      dispatch(uiActions.setTheme("custom"));
                    })
                  }
                />
              ))}
            </fieldset>
          ))}
          {paletteContrast(ui.customTheme) < 4.5 && (
            <p role="status">
              В палитре возможен низкий контраст текста, полей, акцента или
              выбранных элементов. Проверьте читаемость. Восстановление доступно
              ниже.
            </p>
          )}
        </>
      )}
      <div className={styles.recovery}>
        <button
          type="button"
          onClick={() => change(() => dispatch(uiActions.setTheme("dark")))}
        >
          Восстановить стандартную тему
        </button>
        <button
          type="button"
          onClick={() => change(() => dispatch(uiActions.resetCustomTheme()))}
        >
          Сбросить пользовательские цвета
        </button>
        <button
          type="button"
          disabled={!previous}
          onClick={() => {
            if (!previous) return;
            const snapshot = previous;
            dispatch(uiActions.setCustomTheme(snapshot.customTheme));
            dispatch(uiActions.setTheme(snapshot.theme));
            setPrevious(undefined);
            setRevision((n) => n + 1);
          }}
        >
          Вернуть предыдущее оформление
        </button>
        <SettingsStatus
          state={
            ui.saveError || applied === false
              ? "error"
              : revision && applied
                ? "success"
                : "idle"
          }
        />
        <p role={ui.saveError ? "alert" : "status"}>
          {ui.saveError ??
            (revision
              ? applied === undefined
                ? "Проверка применения оформления."
                : applied
                  ? "Оформление применено и сохранено с проверкой чтения."
                  : "Не удалось подтвердить применение оформления."
              : "Текущее оформление интерфейса.")}
        </p>
      </div>
    </div>
  );
}
