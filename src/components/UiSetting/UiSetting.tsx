import { useDispatch, useSelector } from "react-redux";
import styles from "./UiSetting.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import { useEffect } from "react";
import { themes, uiActions } from "../../store/slices/ui.slice";
import { THEME_DETAILS } from "./ThemeDetails";

export function UiSetting() {
	const theme = useSelector((s: RootState) => s.ui.theme);
	const dispatch = useDispatch<AppDispatch>();

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
	}, [theme]);

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h3 className={styles.title}>Тема</h3>
				<p className={styles.subtitle}>
					Выберите стиль, который комфортен для ваших глаз.
				</p>
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
