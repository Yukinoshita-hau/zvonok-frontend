import { useEffect, useMemo, useRef, useState } from "react";
import { useParticipants } from "@livekit/components-react";
import { useSelector } from "react-redux";
import styles from "./ActiveCallOverlay.module.css";
import type { RootState } from "../../store/store";

interface SpeakingParticipant {
	identity: string;
	isLocal: boolean;
}

const SPEAKING_HOLD_MS = 750;
const MAX_VISIBLE_SPEAKERS = 3;

export function MiniSpeakingStatus() {
	const participants = useParticipants();
	const { voiceActivityThreshold, isAutoInputSensitivity } = useSelector(
		(state: RootState) => state.device
	);
	const clearTimerRef = useRef<number | null>(null);
	const [displayedSpeakers, setDisplayedSpeakers] = useState<SpeakingParticipant[]>([]);

	const currentSpeakers = useMemo(
		() =>
			participants
				.filter((participant) => {
					if (participant.isLocal) {
						const threshold = (isAutoInputSensitivity ? 30 : voiceActivityThreshold) / 100;
						return participant.audioLevel >= threshold;
					}
					return participant.isSpeaking;
				})
				.sort((left, right) => {
					if (left.isLocal !== right.isLocal) return left.isLocal ? -1 : 1;
					return left.identity.localeCompare(right.identity);
				})
				.map((participant) => ({
					identity: participant.name || "Участник",
					isLocal: participant.isLocal,
				})),
		[participants, isAutoInputSensitivity, voiceActivityThreshold]
	);

	useEffect(() => {
		if (currentSpeakers.length > 0) {
			if (clearTimerRef.current !== null) {
				window.clearTimeout(clearTimerRef.current);
				clearTimerRef.current = null;
			}

			setDisplayedSpeakers((previousSpeakers) =>
				areSameSpeakers(previousSpeakers, currentSpeakers)
					? previousSpeakers
					: currentSpeakers
			);
			return;
		}

		if (displayedSpeakers.length === 0 || clearTimerRef.current !== null) return;

		clearTimerRef.current = window.setTimeout(() => {
			clearTimerRef.current = null;
			setDisplayedSpeakers([]);
		}, SPEAKING_HOLD_MS);
	}, [currentSpeakers, displayedSpeakers.length]);

	useEffect(() => {
		return () => {
			if (clearTimerRef.current !== null) {
				window.clearTimeout(clearTimerRef.current);
			}
		};
	}, []);

	const isActive = displayedSpeakers.length > 0;
	const label = formatSpeakingLabel(displayedSpeakers);

	return (
		<div
			className={[
				styles["speaking-status"],
				isActive ? styles["speaking-status-active"] : "",
			].join(" ")}
		>
			<div className={styles["voice-wave"]} aria-hidden="true">
				<span />
				<span />
				<span />
			</div>
			<div className={styles["speaking-copy"]}>
				<div className={styles["speaking-title"]}>{label}</div>
				<div className={styles["speaking-subtitle"]}>Ctrl+Alt+M для микрофона</div>
			</div>
		</div>
	);
}

function formatSpeakingLabel(speakers: SpeakingParticipant[]) {
	if (speakers.some((speaker) => speaker.isLocal)) {
		return "Вы говорите";
	}

	const remoteSpeakers = speakers.filter((speaker) => !speaker.isLocal);
	if (remoteSpeakers.length === 0) return "Никто не говорит";

	const visibleNames = remoteSpeakers
		.slice(0, MAX_VISIBLE_SPEAKERS)
		.map((speaker) => speaker.identity);
	const hiddenCount = Math.max(0, remoteSpeakers.length - MAX_VISIBLE_SPEAKERS);

	if (remoteSpeakers.length === 1) {
		return `Говорит ${visibleNames[0]}`;
	}

	if (hiddenCount > 0) {
		return `Говорят ${visibleNames.join(", ")} + ещё ${hiddenCount}`;
	}

	if (visibleNames.length === 3) {
		return `Говорят ${visibleNames[0]}, ${visibleNames[1]} и ${visibleNames[2]}`;
	}

	return `Говорят ${visibleNames.join(", ")}`;
}

function areSameSpeakers(
	left: SpeakingParticipant[],
	right: SpeakingParticipant[]
) {
	if (left.length !== right.length) return false;

	return left.every(
		(speaker, index) =>
			speaker.identity === right[index]?.identity &&
			speaker.isLocal === right[index]?.isLocal
	);
}
