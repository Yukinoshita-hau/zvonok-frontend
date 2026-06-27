import styles from "../styles/CodeSessionPanel.module.css";

export type CodeSessionStatus = "ready" | "running" | "success" | "failed";

interface CodeStatusBadgeProps {
	status: CodeSessionStatus;
}

const STATUS_LABELS: Record<CodeSessionStatus, string> = {
	ready: "Готово",
	running: "Запуск",
	success: "Успешно",
	failed: "Ошибка",
};

export function CodeStatusBadge({ status }: CodeStatusBadgeProps) {
	return (
		<span className={`${styles.statusBadge} ${styles[`sessionStatus${status}`]}`}>
			<span className={styles.statusDot} />
			{STATUS_LABELS[status]}
		</span>
	);
}
