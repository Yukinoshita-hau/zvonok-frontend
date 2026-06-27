import { Check, Clipboard } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CodeRunResponseDto, ExecutionResponseStatus } from "../../../api/interfaces/codeRunTypes";
import styles from "../styles/CodeSessionPanel.module.css";

interface CodeOutputPanelProps {
	result: CodeRunResponseDto | null;
	error: string | null;
	isRunning: boolean;
}

const STATUS_LABELS: Record<ExecutionResponseStatus, string> = {
	SUCCESS: "Успешно",
	COMPILATION_ERROR: "Ошибка компиляции",
	RUNTIME_ERROR: "Ошибка выполнения",
	TIME_LIMIT_EXCEEDED: "Превышено время",
	INTERNAL_ERROR: "Внутренняя ошибка",
};

export function CodeOutputPanel({ result, error, isRunning }: CodeOutputPanelProps) {
	const status = result?.status ?? null;
	const stdout = result?.stdout ?? "";
	const hasOutput = stdout.trim().length > 0;
	const outputText = result
		? (hasOutput ? stdout : "(пустой вывод)")
		: (isRunning ? "Выполняем код..." : "Нажмите «Запустить», чтобы увидеть результат выполнения");
	const [isCopied, setIsCopied] = useState(false);

	useEffect(() => {
		if (!isCopied) return;
		const timeoutId = window.setTimeout(() => setIsCopied(false), 1300);
		return () => window.clearTimeout(timeoutId);
	}, [isCopied]);

	const copyOutput = useCallback(() => {
		if (!hasOutput || !navigator.clipboard) return;
		void navigator.clipboard.writeText(stdout)
			.then(() => setIsCopied(true))
			.catch(() => undefined);
	}, [hasOutput, stdout]);

	return (
		<section
			className={`${styles.ioPanel} ${styles.outputPanel}`}
			data-status={status ?? (isRunning ? "RUNNING" : "IDLE")}
		>
			<div className={styles.panelHeader}>
				<span className={styles.panelTitle}>Терминал</span>
				{isRunning && <span className={styles.runningPill}>выполняется</span>}
				{status && (
					<span className={`${styles.statusPill} ${styles[`status${status}`]}`}>
						{STATUS_LABELS[status]}
					</span>
				)}
				{hasOutput && (
					<button
						type="button"
						className={styles.copyButton}
						onClick={copyOutput}
						title="Скопировать вывод"
					>
						{isCopied ? <Check size={14} /> : <Clipboard size={14} />}
						<span>{isCopied ? "Скопировано" : "Копировать"}</span>
					</button>
				)}
			</div>

			{result && (
				<div className={styles.metaRow}>
					<span>status: {STATUS_LABELS[result.status]}</span>
					<span>time: {result.executionTimeMs} ms</span>
					<span>exit: {result.exitCode}</span>
				</div>
			)}

			{error ? (
				<div className={styles.networkError}>
					<div className={styles.networkErrorTitle}>Не удалось выполнить код</div>
					<div className={styles.networkErrorText}>Проверьте соединение или backend Code Runner.</div>
					<div className={styles.networkErrorDetail}>{error}</div>
				</div>
			) : (
				<pre className={styles.outputText}>
					<span className={styles.terminalPrompt}>zvonok-runner$ </span>
					{outputText}
				</pre>
			)}
		</section>
	);
}
