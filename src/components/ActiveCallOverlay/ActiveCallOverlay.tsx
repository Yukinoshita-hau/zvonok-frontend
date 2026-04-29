import { LiveKitRoom } from "@livekit/components-react";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RoomOptions } from "livekit-client";
import styles from "./ActiveCallOverlay.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import { CallUi } from "../CallUi/CallUi";
import { callActions } from "../../store/slices/call.slice";
import { CallAudioLayer } from "./CallAudioLayer";
import { getQualityPreset, getVideoEncoding } from "../../utils/callQuality";
import { CallQualityController } from "../CallUi/CallQualityController";
import { CallHotkeys } from "./CallHotkeys";
import { MiniCallDock } from "./MiniCallDock";
import { MicrophoneSettingsSync } from "../CallUi/MicrophoneSettingsSync";

export function ActiveCallOverlay() {
	const [callHeight, setCallHeight] = useState(52);

	const dispatch = useDispatch<AppDispatch>();
	const navigate = useNavigate();
	const call = useSelector((s: RootState) => s.call);

	const isCallActive = call.status === "connecting" || call.status === "in_call";
	const isExpanded = call.presentationMode === "expanded";
	const isMinimized = call.presentationMode === "minimized";
	const isHidden = call.presentationMode === "hidden";
	const isCinemaMode = call.isTheaterMode;

	useEffect(() => {
		if (!isExpanded) return;

		if (call.isCallFocusMode || isCinemaMode) {
			setCallHeight((prev) => Math.max(prev, 90));
			return;
		}

		setCallHeight(52);
	}, [call.isCallFocusMode, isCinemaMode, isExpanded]);

	const roomOptions: RoomOptions = useMemo(() => {
		const cameraPreset = getQualityPreset("camera", "medium");
		const screenSharePreset = getQualityPreset("screenShare", "medium");

		return {
			videoCaptureDefaults: {
				facingMode: "user",
				resolution: {
					width: cameraPreset.width,
					height: cameraPreset.height,
					frameRate: cameraPreset.frameRate,
				},
			},
			audioCaptureDefaults: {
				autoGainControl: true,
				echoCancellation: true,
				noiseSuppression: true,
				voiceIsolation: true,
				channelCount: 1,
				sampleRate: 48000,
				sampleSize: 16,
			},
			adaptiveStream: true,
			dynacast: true,
			publishDefaults: {
				dtx: true,
				red: true,
				videoEncoding: getVideoEncoding(cameraPreset),
				screenShareEncoding: getVideoEncoding(screenSharePreset),
			},
		};
	}, []);

	if (!isCallActive || !call.serverUrl || !call.participantToken) {
		return null;
	}

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (call.isCallFocusMode) return;

		const startY = e.clientY;
		const startHeight = callHeight;

		const onMove = (moveEvent: MouseEvent) => {
			const delta = startY - moveEvent.clientY;
			const vhDelta = (delta / window.innerHeight) * 100;
			const next = Math.min(82, Math.max(38, startHeight + vhDelta));
			setCallHeight(next);
		};

		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};
	const handleOpenChat = () => {
		if (!call.chatRoomId) return;
		navigate(`/dm?roomId=${call.chatRoomId}`);
	};

	return (
		<>
			<LiveKitRoom
				serverUrl={call.serverUrl}
				token={call.participantToken}
				connect={true}
				options={roomOptions}
				className={styles["host-room"]}
				onDisconnected={() => {
					console.debug("[call] LiveKit disconnected locally");
					dispatch(callActions.liveKitDisconnectedLocally());
				}}
			>
				<CallAudioLayer />
				<CallQualityController />
				<CallHotkeys />
				<MicrophoneSettingsSync />

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
							<CallUi
								hasChat={Boolean(call.chatRoomId)}
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
						onEnd={() => dispatch(callActions.endCall())}
					/>
				)}
			</LiveKitRoom>

			{isHidden && (
				<button
					type="button"
					className={styles["hidden-bubble"]}
					onClick={() => dispatch(callActions.setPresentationMode("expanded"))}
				>
					<span className={styles["hidden-bubble-dot"]} />
					<span>Call</span>
				</button>
			)}
		</>
	);
}
