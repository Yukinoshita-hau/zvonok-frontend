import { Mic, MonitorUp, RotateCcw } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store/store";
import { deviceActions } from "../../store/slices/device.slice";
import styles from "./CallUi.module.css";
import type { Participant } from "livekit-client";

interface AudioMixerPanelProps {
	sortedParticipants: Participant[];
	remoteMicrophoneParticipants: Set<string>;
	remoteScreenAudioParticipants: Set<string>;
	participantCardByIdentity: Map<string, { avatarUrl: string | null; displayName: string }>;
}

export function AudioMixerPanel({
	sortedParticipants,
	remoteMicrophoneParticipants,
	remoteScreenAudioParticipants,
	participantCardByIdentity,
}: AudioMixerPanelProps) {
	const dispatch = useDispatch<AppDispatch>();
	const participantVolumes = useSelector((s: RootState) => s.device.participantVolumes);

	const getVolumeValue = (participantIdentity: string, source: "microphone" | "screenShareAudio") =>
		participantVolumes.find(
			(item) => item.participantIdentity === participantIdentity && item.source === source
		)?.volume ?? 100;

	const remoteParticipants = sortedParticipants.filter((p) => !p.isLocal);
	const hasAnyRemoteAudio = remoteMicrophoneParticipants.size > 0 || remoteScreenAudioParticipants.size > 0;

	return (
		<div className={styles["audio-panel"]}>
			<div className={styles["audio-panel-title"]}>Громкость участников</div>
			{remoteParticipants.length === 0 ? (
				<div className={styles["audio-panel-empty"]}>Пока нет удалённых участников.</div>
			) : !hasAnyRemoteAudio ? (
				<div className={styles["audio-panel-empty"]}>Аудиодорожки участников пока недоступны.</div>
			) : (
				remoteParticipants.map((participant) => {
					const micAvailable = remoteMicrophoneParticipants.has(participant.identity);
					const streamAvailable = remoteScreenAudioParticipants.has(participant.identity);
					const micVolume = getVolumeValue(participant.identity, "microphone");
					const streamVolume = getVolumeValue(participant.identity, "screenShareAudio");
					const card = participantCardByIdentity.get(participant.identity);
					const displayName = card?.displayName || participant.identity;
					const avatarLabel = displayName.slice(0, 1).toUpperCase();

					return (
						<div key={participant.identity} className={styles["audio-row"]}>
							<div className={styles["audio-header"]}>
								<div className={styles["audio-avatar"]}>
									{card?.avatarUrl ? (
										<img src={card.avatarUrl} crossOrigin="anonymous" alt="" className={styles["audio-avatar-image"]} />
									) : (
										<span>{avatarLabel}</span>
									)}
								</div>
								<div className={styles["audio-name"]} title={displayName}>{displayName}</div>
							</div>
							<div className={styles["audio-slider-row"]}>
								<div className={styles["audio-source-label"]}><Mic size={14} /><span>Микрофон</span></div>
								<input
									type="range" min={0} max={100} value={micVolume} disabled={!micAvailable}
									onChange={(e) => dispatch(deviceActions.setParticipantVolume({
										participantIdentity: participant.identity, source: "microphone", volume: Number(e.target.value)
									}))}
								/>
								<span className={styles["audio-percent"]}>{micVolume}%</span>
								<button className={styles["audio-reset"]} onClick={() => dispatch(deviceActions.resetParticipantVolume({
									participantIdentity: participant.identity, source: "microphone"
								}))}><RotateCcw size={13} /></button>
							</div>
							{streamAvailable && (
								<div className={styles["audio-slider-row"]}>
									<div className={styles["audio-source-label"]}><MonitorUp size={14} /><span>Трансляция</span></div>
									<input
										type="range" min={0} max={100} value={streamVolume}
										onChange={(e) => dispatch(deviceActions.setParticipantVolume({
											participantIdentity: participant.identity, source: "screenShareAudio", volume: Number(e.target.value)
										}))}
									/>
									<span className={styles["audio-percent"]}>{streamVolume}%</span>
									<button className={styles["audio-reset"]} onClick={() => dispatch(deviceActions.resetParticipantVolume({
										participantIdentity: participant.identity, source: "screenShareAudio"
									}))}><RotateCcw size={13} /></button>
								</div>
							)}
						</div>
					);
				})
			)}
		</div>
	);
}
