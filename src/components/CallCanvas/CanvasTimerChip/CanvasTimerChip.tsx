import { useEffect, useMemo, useState } from "react";
import type { CanvasBoardSessionDto } from "../../../api/interfaces/CanvasDtos";
import styles from "./CanvasTimerChip.module.css";

interface CanvasTimerChipProps {
	board: CanvasBoardSessionDto;
	canManage: boolean;
	variant?: "whiteboard" | "overlay";
	onStart: (durationSeconds: number) => void;
	onStop: () => void;
	onReset: () => void;
}

export function CanvasTimerChip({
	board,
	canManage,
	variant = "whiteboard",
	onStart,
	onStop,
	onReset,
}: CanvasTimerChipProps) {
	const [now, setNow] = useState(() => Date.now());
	const [isHidden, setIsHidden] = useState(false);

	useEffect(() => {
		const intervalId = window.setInterval(() => setNow(Date.now()), 500);
		return () => window.clearInterval(intervalId);
	}, []);

	const status = board.timerStatus ?? "STOPPED";
	const hasTimer = status !== "STOPPED" || Boolean(board.timerDurationSeconds);
	const remainingSeconds = useMemo(() => {
		if (status !== "RUNNING" || !board.timerStartedAt || !board.timerDurationSeconds) {
			return board.timerDurationSeconds ?? 0;
		}

		const elapsed = Math.floor((now - Date.parse(board.timerStartedAt)) / 1000);
		return Math.max(0, board.timerDurationSeconds - elapsed);
	}, [board.timerDurationSeconds, board.timerStartedAt, now, status]);
	const isFinished = status === "FINISHED" || (status === "RUNNING" && remainingSeconds <= 0);

	useEffect(() => {
		if (status === "RUNNING" || status === "FINISHED") {
			setIsHidden(false);
		}
	}, [status]);

	if (!hasTimer) return null;

	if (isHidden) {
		return (
			<button
				type="button"
				className={`${styles.miniChip} ${variant === "overlay" ? styles.overlayChip : ""}`}
				onClick={() => setIsHidden(false)}
				title="Показать таймер"
				aria-label="Показать таймер"
			>
				{formatTime(remainingSeconds)}
			</button>
		);
	}

	return (
		<div className={`${styles.chip} ${variant === "overlay" ? styles.overlayChip : ""} ${isFinished ? styles.finished : ""}`}>
			<span className={styles.time}>{formatTime(remainingSeconds)}</span>
			{canManage && (
				<div className={styles.controls}>
					<button type="button" onClick={() => onStart(60)}>1м</button>
					<button type="button" onClick={() => onStart(180)}>3м</button>
					<button type="button" onClick={() => onStart(300)}>5м</button>
					<button type="button" onClick={onStop}>Стоп</button>
					<button type="button" onClick={onReset}>Сброс</button>
				</div>
			)}
			<button
				type="button"
				className={styles.closeButton}
				onClick={() => setIsHidden(true)}
				title="Скрыть таймер"
				aria-label="Скрыть таймер"
			>
				×
			</button>
		</div>
	);
}

function formatTime(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
