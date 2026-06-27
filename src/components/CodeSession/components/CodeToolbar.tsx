import { Code2, X } from "lucide-react";
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

export function CodeToolbar({ sessionStatus, onClose }: CodeToolbarProps) {
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
