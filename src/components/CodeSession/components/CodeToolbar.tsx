import { Code2, Play, RotateCcw, X } from "lucide-react";
import type { AvailableLanguageDto } from "../../../api/interfaces/codeRunTypes";
import { CodeStatusBadge, type CodeSessionStatus } from "./CodeStatusBadge";
import styles from "../styles/CodeSessionPanel.module.css";

interface CodeToolbarProps {
	languages: AvailableLanguageDto[];
	language: string;
	isLoadingLanguages: boolean;
	isRunning: boolean;
	sessionStatus: CodeSessionStatus;
	canEdit: boolean;
	canRun: boolean;
	canResetTemplate: boolean;
	onLanguageChange: (language: string) => void;
	onRun: () => void;
	onResetTemplate: () => void;
	onClose: () => void;
}

export function CodeToolbar({
	languages,
	language,
	isLoadingLanguages,
	isRunning,
	sessionStatus,
	canEdit,
	canRun,
	canResetTemplate,
	onLanguageChange,
	onRun,
	onResetTemplate,
	onClose,
}: CodeToolbarProps) {
	return (
		<div className={styles.toolbar}>
			<div className={styles.titleGroup}>
				<div className={styles.titleRow}>
					<div className={styles.titleIcon}><Code2 size={18} /></div>
					<div className={styles.title}>Code Session</div>
					<CodeStatusBadge status={sessionStatus} />
				</div>
				<div className={styles.subtitle}>Backend Runner • Monaco Editor • Ctrl+Enter</div>
			</div>

			<div className={styles.toolbarControls}>
				<label className={styles.languageSelect} data-loading={isLoadingLanguages ? "true" : undefined}>
					<span>Язык</span>
					<select
						value={language}
						disabled={isLoadingLanguages || isRunning || !canEdit}
						onChange={(event) => onLanguageChange(event.target.value)}
					>
						{languages.map((item) => (
							<option key={item.language} value={item.language}>
								{item.displayName}
							</option>
						))}
						{languages.length === 0 && (
							<option value={language}>{isLoadingLanguages ? "Загрузка..." : language}</option>
						)}
					</select>
				</label>

				<button
					type="button"
					className={styles.secondaryButton}
					onClick={onResetTemplate}
					disabled={isRunning || !canResetTemplate}
					title="Сбросить шаблон"
				>
					<RotateCcw size={16} />
					<span>Шаблон</span>
				</button>

				<button
					type="button"
					className={styles.runButton}
					onClick={onRun}
					disabled={!canRun}
					title="Запустить код"
				>
					{isRunning ? <span className={styles.spinner} /> : <Play size={16} />}
					<span>{isRunning ? "Выполняется..." : "Запустить"}</span>
				</button>

				<button
					type="button"
					className={styles.closeButton}
					onClick={onClose}
					title="Закрыть редактор кода"
					aria-label="Закрыть редактор кода"
				>
					<X size={18} />
				</button>
			</div>
		</div>
	);
}
