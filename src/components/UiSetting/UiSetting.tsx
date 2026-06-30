import { useDispatch, useSelector } from "react-redux";
import styles from "./UiSetting.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import { useEffect } from "react";
import { themes, uiActions, type CustomTheme } from "../../store/slices/ui.slice";
import { THEME_DETAILS } from "./ThemeDetails";

const CUSTOM_THEME_VARIABLES: Array<{
	key: keyof CustomTheme;
	label: string;
	cssVariable: string;
}> = [
	{ key: "bgPrimary", label: "Фон", cssVariable: "--bg-primary" },
	{ key: "bgSecondary", label: "Панели", cssVariable: "--bg-secondary" },
	{ key: "bgTertiary", label: "Сайдбар", cssVariable: "--bg-tertiary" },
	{ key: "bgInput", label: "Поля", cssVariable: "--bg-input" },
	{ key: "accent", label: "Акцент", cssVariable: "--accent" },
	{ key: "textPrimary", label: "Текст", cssVariable: "--text-primary" },
	{ key: "textSecondary", label: "Вторичный текст", cssVariable: "--text-secondary" },
	{ key: "border", label: "Граница", cssVariable: "--border" },
];

export function UiSetting() {
	const theme = useSelector((s: RootState) => s.ui.theme);
	const customTheme = useSelector((s: RootState) => s.ui.customTheme);
	const dispatch = useDispatch<AppDispatch>();

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);

		for (const item of CUSTOM_THEME_VARIABLES) {
			if (theme === "custom") {
				document.documentElement.style.setProperty(item.cssVariable, customTheme[item.key]);
			} else {
				document.documentElement.style.removeProperty(item.cssVariable);
			}
		}
	}, [customTheme, theme]);

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h3 className={styles.title}>Тема</h3>
				<p className={styles.subtitle}>
					Выберите стиль, который комфортен для ваших глаз.
				</p>
			</div>

			<div className={styles.customThemePanel}>
				<div>
					<h4>Своя тема</h4>
					<p>Настройте основные цвета интерфейса и примените как отдельный пресет.</p>
				</div>

				<div className={styles.customThemeGrid}>
					{CUSTOM_THEME_VARIABLES.map((item) => (
						<label key={item.key} className={styles.colorControl}>
							<span>{item.label}</span>
							<input
								type="color"
								value={normalizeColorValue(customTheme[item.key])}
								onChange={(event) => {
									dispatch(uiActions.setCustomTheme({ [item.key]: event.target.value }));
									dispatch(uiActions.setTheme("custom"));
								}}
							/>
						</label>
					))}
				</div>

				<div className={styles.customThemeActions}>
					<button
						type="button"
						onClick={() => dispatch(uiActions.setTheme("custom"))}
					>
						Применить свою
					</button>
					<button
						type="button"
						onClick={() => dispatch(uiActions.resetCustomTheme())}
					>
						Сбросить цвета
					</button>
				</div>
			</div>

			<div className={styles.themeGrid}>
				{themes.map((t) => {
					const details = THEME_DETAILS[t];
					const isActive = t === theme;

					return (
						<button
							type="button"
							key={t}
							onClick={() => dispatch(uiActions.setTheme(t))}
							className={styles.themeCard}
							data-active={isActive}
						>
							<div className={styles.cardHeader}>
								<div className={styles.themeName}>{details.title}</div>
								<div
									className={styles.themeAccent}
									style={{ backgroundColor: details.accent }}
								/>
							</div>
							<div className={styles.themeDescription}>{details.subtitle}</div>
							<div className={styles.previewRow}>
								{details.preview.map((color, idx) => (
									<span
										key={`${t}-${idx}`}
										className={styles.previewBox}
										style={{ backgroundColor: color }}
									/>
								))}
							</div>
							<div className={styles.activeBadge}>
								{isActive ? "Активна" : "Применить"}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function normalizeColorValue(value: string): string {
	if (value.startsWith("#") && (value.length === 4 || value.length === 7)) {
		return value;
	}

	return "#58c7ff";
}
