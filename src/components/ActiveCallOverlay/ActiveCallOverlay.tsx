import { useSelector } from "react-redux";
import styles from "./ActiveCallOverlay.module.css";
import type { RootState } from "../../store/store";
import type { ActiveCallOverlayProps } from "./ActiveCallOverlay.props";
import { LiveKitRoom } from "@livekit/components-react";
import { CallUi } from "../CallUi/CallUi";
import { useEffect, useMemo, useState } from "react";
import { VideoPresets, type RoomOptions } from "livekit-client";

export function ActiveCallOverlay({ currentRoomId }: ActiveCallOverlayProps) {
	const [callHeight, setCallHeight] = useState(55);

	const device = useSelector((s: RootState) => s.device);
	const call = useSelector((s: RootState) => s.call);

	const hideChat = call.isChatHiddenInCall;
	const isFocusMode = call.isCallFocusMode;

	useEffect(() => {
		if (hideChat) {
			setCallHeight(100);
			return;
		}

		if (isFocusMode) {
			setCallHeight((prev) => Math.max(prev, 70));
			return;
		}

		setCallHeight((prev) => Math.min(prev, 50));
	}, [hideChat, isFocusMode]);

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

	if (
		call.chatRoomId !== currentRoomId ||
		(call.status !== "connecting" && call.status !== "in_call")
	) {
		return null;
	}

	if (!call.serverUrl || !call.participantToken) return null;

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (hideChat) return;

		const startY = e.clientY;
		const startHeight = callHeight;

		const onMove = (moveEvent: MouseEvent) => {
			const delta = moveEvent.clientY - startY;
			const vhDelta = (delta / window.innerHeight) * 100;

			const maxHeight = isFocusMode ? 92 : 65;
			const minHeight = isFocusMode ? 70 : 55;

			const next = Math.min(
				maxHeight,
				Math.max(minHeight, startHeight + vhDelta)
			);

			setCallHeight(next);
		};

		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	return (
		<div className={styles["call-bar"]}>
			<div className={styles["room-wrapper"]}>
				<div
					className={styles["room-container"]}
					style={{ height: `${callHeight}vh` }}
				>
					<LiveKitRoom
						serverUrl={call.serverUrl}
						token={call.participantToken}
						connect={true}
						options={roomOptions}
					>
						<CallUi />
					</LiveKitRoom>
				</div>

				{!hideChat && (
					<div
						className={styles["resize-handle"]}
						onMouseDown={handleMouseDown}
					/>
				)}
			</div>
		</div>
	);
}
