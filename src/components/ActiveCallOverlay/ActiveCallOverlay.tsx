import { LiveKitRoom } from "@livekit/components-react";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { VideoPresets, type RoomOptions } from "livekit-client";
import styles from "./ActiveCallOverlay.module.css";
import type { AppDispatch, RootState } from "../../store/store";
import { CallUi } from "../CallUi/CallUi";
import { callActions } from "../../store/slices/call.slice";
import { CallAudioLayer } from "./CallAudioLayer";

export function ActiveCallOverlay() {
	const [callHeight, setCallHeight] = useState(52);
	const [callWidth, setCallWidth] = useState(52);

	const dispatch = useDispatch<AppDispatch>();
	const navigate = useNavigate();
	const device = useSelector((s: RootState) => s.device);
	const call = useSelector((s: RootState) => s.call);

	const isCallActive = call.status === "connecting" || call.status === "in_call";
	const isExpanded = call.presentationMode === "expanded";
	const isMinimized = call.presentationMode === "minimized";
	const isHidden = call.presentationMode === "hidden";

	useEffect(() => {
		if (!isExpanded) return;

		if (call.isCallFocusMode) {
			setCallHeight((prev) => Math.max(prev, 90));
			return;
		}

		setCallHeight(52);
	}, [call.isCallFocusMode, isExpanded]);

	const roomOptions: RoomOptions = useMemo(() => {
		let resolution = VideoPresets.h1080.resolution;
		let maxBitrate = 3_000_000;
		let maxFramerate = 30;

		if (device.videoQuality === "medium") {
			resolution = VideoPresets.h720.resolution;
			maxBitrate = 1_500_000;
			maxFramerate = 24;
		} else if (device.videoQuality === "low") {
			resolution = VideoPresets.h360.resolution;
			maxBitrate = 500_000;
			maxFramerate = 15;
		}

		return {
			videoCaptureDefaults: {
				deviceId:
					device.selectedCameraId !== "default"
						? device.selectedCameraId
						: undefined,
				facingMode: "user",
				resolution,
			},
			audioCaptureDefaults: {
				deviceId:
					device.selectedMicrophoneId !== "default"
						? device.selectedMicrophoneId
						: undefined,
				echoCancellation: true,
				noiseSuppression: device.isNoiseSuppressionEnabled,
			},
			adaptiveStream: true,
			dynacast: true,
			publishDefaults: {
				videoEncoding: {
					maxBitrate,
					maxFramerate,
					priority: "high",
				},
				screenShareEncoding: {
					priority: "high",
					maxBitrate: 5_000_000,
					maxFramerate: 60,
				},
			},
		};
	}, [
		device.selectedCameraId,
		device.selectedMicrophoneId,
		device.videoQuality,
		device.isNoiseSuppressionEnabled,
	]);

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


	const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
		if (call.isCallFocusMode) return;

		const startX = e.clientX;
		const startWidth = callWidth;

		const onMove = (moveEvent: MouseEvent) => {
			const delta = startX - moveEvent.clientX;
			const vwDelta = (delta / window.innerWidth) * 100;
			const next = Math.min(82, Math.max(38, startWidth + vwDelta));
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
			>
				<CallAudioLayer />

				{isExpanded && (
					<div
						className={[
							styles["call-shell"],
							call.isCallFocusMode ? styles["call-shell-focus"] : "",
						].join(" ")}
					>
						{!call.isCallFocusMode && (
							<div
								className={styles["resize-handle"]}
								onMouseDown={handleMouseDown}
							/>
						)}
						<div className={styles["call-header"]}>

							<div className={styles["call-header-actions"]}>
								{call.chatRoomId && (
									<button
										type="button"
										className={styles["header-button"]}
										onClick={handleOpenChat}
									>
										Open chat
									</button>
								)}
								<button
									type="button"
									className={styles["header-button"]}
									onClick={() => dispatch(callActions.setPresentationMode("minimized"))}
								>
									Minimize
								</button>

								<div className={styles["status-row"]}>
									<button
										type="button"
										className={styles["header-button"]}
										onClick={() => dispatch(callActions.setCallFocusMode(!call.isCallFocusMode))}
									>
										{call.isCallFocusMode ? "Unfocus" : "Focus"}
									</button>
								</div>
							</div>
						</div>

						<div
							className={styles["room-container"]}
							style={{ height: `${callHeight}vh` }}
						>
							<CallUi
								onHide={() => dispatch(callActions.setPresentationMode("hidden"))}
								onMinimize={() => dispatch(callActions.setPresentationMode("minimized"))}
							/>
						</div>

					</div>
				)}
			</LiveKitRoom>

			{isMinimized && (
				<div className={styles["mini-dock"]}>
					<div className={styles["mini-copy"]}>
						<div className={styles["mini-title"]}>Call in progress</div>
						<div className={styles["mini-subtitle"]}>
							Voice stays connected while you browse.
						</div>
					</div>

					<div className={styles["mini-actions"]}>
						{call.chatRoomId && (
							<button
								type="button"
								className={styles["mini-button"]}
								onClick={handleOpenChat}
							>
								Chat
							</button>
						)}
						<button
							type="button"
							className={styles["mini-button"]}
							onClick={() => dispatch(callActions.setPresentationMode("expanded"))}
						>
							Expand
						</button>
						<button
							type="button"
							className={styles["mini-button"]}
							onClick={() => dispatch(callActions.setPresentationMode("hidden"))}
						>
							Hide
						</button>
						<button
							type="button"
							className={styles["mini-leave"]}
							onClick={() => dispatch(callActions.endCall())}
						>
							End
						</button>
					</div>
				</div>
			)}

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
