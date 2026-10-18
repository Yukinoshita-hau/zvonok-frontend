import { LiveKitRoom } from "@livekit/components-react";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BackupCodecPolicy, type RoomOptions } from "livekit-client";
import styles from "./ActiveCallOverlay.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import { CallUi } from "../CallUi/CallUi";
import { callActions, endConference, restoreCallSession } from "../../store/slices/call.slice";
import { CallLifecycle } from "./CallLifecycle";
import { scheduleCallRecovery } from "./callRecovery";
import { CallAudioLayer } from "./CallAudioLayer";
import { CallHotkeys } from "./CallHotkeys";
import { MiniCallDock } from "./MiniCallDock";
import { MicrophoneSettingsSync } from "../CallUi/MicrophoneSettingsSync";
import { getActiveCall } from "../../store/slices/activeCall.slice";
import { CodecDebugLayer } from "../CodecDebugLayer/CodecDebugLayer";
import { MicrophoneProcessorSync } from "../CallUi/MicrophoneProcessorSync";
import { MediaDiagnostics } from "../CallUi/MediaDiagnostics";
import { CallMicrophoneProvider } from "../CallUi/CallMicrophoneProvider";

export function ActiveCallOverlay() {
	const [callHeight, setCallHeight] = useState(70);

	const dispatch = useDispatch<AppDispatch>();
	const navigate = useNavigate();
	const call = useSelector((s: RootState) => s.call);
	const myUsername = useSelector((s: RootState) => s.user.myUser?.username);
	const recoveryStarted = useRef<number | null>(null);
	const resizeCleanup = useRef<() => void>(() => {});
	useEffect(() => () => resizeCleanup.current(), []);
	const handleConnectionError = useCallback(() => {
		if (call.livekitRoomName) dispatch(callActions.mediaConnectionChanged({
			roomName: call.livekitRoomName, generation: call.mediaGeneration, status: "disconnected",
		}));
	}, [dispatch, call.livekitRoomName, call.mediaGeneration]);

	useEffect(() => {
		if (call.mediaState === "connected" || !call.livekitRoomName) recoveryStarted.current = null;
		if (call.mediaState !== "disconnected" || !call.callId || !call.livekitRoomName) return;
		recoveryStarted.current ??= Date.now();
		const roomName = call.livekitRoomName, generation = call.mediaGeneration;
		return scheduleCallRecovery(() => dispatch(restoreCallSession()),
			() => dispatch(callActions.mediaSessionEnded({ roomName, generation })), recoveryStarted.current,
			Number(import.meta.env.VITE_CALL_RECOVERY_MS) || 90000);
	}, [dispatch, call.mediaState, call.callId, call.livekitRoomName, call.mediaGeneration]);

	const isCallActive = call.status === "connecting" || call.status === "in_call";
	const isExpanded = call.presentationMode === "expanded";
	const isMinimized = call.presentationMode === "minimized";
	const isHidden = call.presentationMode === "hidden";
	const isCinemaMode = call.isTheaterMode;

	useEffect(() => {
		if (call.chatRoomId !== null) {
			dispatch(getActiveCall(call.chatRoomId))
		}
	}, [dispatch, call.chatRoomId])

	useEffect(() => {
		if (!isExpanded) return;

		if (call.isCallFocusMode || isCinemaMode) {
			setCallHeight((prev) => Math.max(prev, 90));
			return;
		}

		setCallHeight(70);
	}, [call.isCallFocusMode, isCinemaMode, isExpanded]);

	const roomOptions: RoomOptions = useMemo(() => {
		return {
			// Keep the existing audio-element playback path and make LiveKit close
			// its AudioContext as part of Room teardown.
			webAudioMix: false,
			audioCaptureDefaults: {
				autoGainControl: false,
				echoCancellation: false,
				noiseSuppression: false,
				voiceIsolation: false,
				channelCount: 1,
				sampleRate: 48000,
				sampleSize: 16,
			},
			adaptiveStream: true,
			dynacast: true,
			publishDefaults: {
				videoCodec: "av1",
				scalabilityMode: "L3T3_KEY",
				backupCodec: { codec: "vp8", },
				backupCodecPolicy: BackupCodecPolicy.PREFER_REGRESSION,
				dtx: true,
				red: true,
				simulcast: true,
			},
		};
	}, []);

	if (!isCallActive || !call.serverUrl || !call.participantToken) {
		return null;
	}

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (call.isCallFocusMode) return;
		resizeCleanup.current();

		const startY = e.clientY;
		const startHeight = callHeight;

		const onMove = (moveEvent: MouseEvent) => {
			const delta = startY - moveEvent.clientY;
			const vhDelta = (delta / window.innerHeight) * 100;
			const next = Math.min(90, Math.max(70, startHeight + vhDelta));
			setCallHeight(next);
		};

		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		resizeCleanup.current = onUp;
	};
	const handleOpenChat = () => {
		if (!call.chatRoomId) return;
		navigate(`/dm?roomId=${call.chatRoomId}`);
	};

	return (
		<>
			<LiveKitRoom
				key={`${call.livekitRoomName}:${call.mediaGeneration}`}
				serverUrl={call.serverUrl}
				token={call.participantToken}
				connect={true}
				options={roomOptions}
				className={styles["host-room"]}
				onError={handleConnectionError}
			>
				<CallMicrophoneProvider callId={call.callId ?? "unknown"} generation={call.mediaGeneration}>
				{import.meta.env.DEV && import.meta.env.VITE_MEDIA_DIAGNOSTICS === "true" && <MediaDiagnostics callId={call.callId} generation={call.mediaGeneration} />}
				<CallLifecycle roomName={call.livekitRoomName!} generation={call.mediaGeneration} />
				{import.meta.env.VITE_LIVEKIT_DEBUG === "true" && <CodecDebugLayer />}
				<CallAudioLayer />
				<CallHotkeys />
				<MicrophoneSettingsSync />
				<MicrophoneProcessorSync />

				{isExpanded && (
					<div
						className={[
							styles["call-shell"],
							call.isCallFocusMode ? styles["call-shell-focus"] : "",
							isCinemaMode ? styles["call-shell-cinema"] : "",
						].join(" ")}
					>
						{!call.isCallFocusMode && !isCinemaMode && (
							<div
								className={styles["resize-handle"]}
								onMouseDown={handleMouseDown}
							/>
						)}
						<div
							className={styles["room-container"]}
							style={{ height: isCinemaMode ? "110%" : `${callHeight}vh` }}
						>
							{call.mediaState !== "connected" && <span role="status">Восстанавливаем соединение…</span>}
							<CallUi
								hasChat
								isFocusMode={call.isCallFocusMode}
								isCinemaMode={call.isTheaterMode}
								onHide={() => dispatch(callActions.setPresentationMode("hidden"))}
								onOpenChat={handleOpenChat}
								onMinimize={() => dispatch(callActions.setPresentationMode("minimized"))}
								onToggleFocus={() => dispatch(callActions.setCallFocusMode(!call.isCallFocusMode))}
								onToggleCinema={() => dispatch(callActions.setTheaterMode(!call.isTheaterMode))}
							/>
						</div>

					</div>
				)}

				{isMinimized && (
					<MiniCallDock
						hasChat={Boolean(call.chatRoomId)}
						onOpenChat={handleOpenChat}
						onExpand={() => dispatch(callActions.setPresentationMode("expanded"))}
						onHide={() => dispatch(callActions.setPresentationMode("hidden"))}
						onEnd={() => {
							if (call.conferenceCode && call.isConferenceHost) {
								dispatch(endConference(call.conferenceCode));
								return;
							}
								const isHost = Boolean(myUsername && call.hostUsername === myUsername);
								const type = call.roomType === "PRIVATE" || isHost ? "call/sendEnd" : "call/sendLeave";
								dispatch({ type, payload: { callId: call.callId, chatRoomId: call.chatRoomId ?? undefined } });
								dispatch(callActions.endCallLocally());
						}}
					/>
				)}
				</CallMicrophoneProvider>
			</LiveKitRoom>

			{isHidden && (
				<button
					type="button"
					className={styles["hidden-bubble"]}
					onClick={() => dispatch(callActions.setPresentationMode("expanded"))}
				>
					<span className={styles["hidden-bubble-dot"]} />
					<span>Звонок</span>
				</button>
			)}
		</>
	);
}
