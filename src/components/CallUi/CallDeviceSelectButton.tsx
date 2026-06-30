import { ChevronUp } from "lucide-react";
import { Room } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";
import { useDispatch } from "react-redux";
import type { ChangeEvent } from "react";
import { deviceActions } from "../../store/slices/device.slice";
import type { AppDispatch } from "../../store/store";
import styles from "./CallUi.module.css";

interface CallDeviceSelectButtonProps {
	kind: "microphone" | "camera";
	devices: MediaDeviceInfo[];
	selectedDeviceId: string;
}

export function CallDeviceSelectButton({
	kind,
	devices,
	selectedDeviceId,
}: CallDeviceSelectButtonProps) {
	const room = useRoomContext();
	const dispatch = useDispatch<AppDispatch>();
	const mediaKind: MediaDeviceKind = kind === "microphone" ? "audioinput" : "videoinput";
	const title = kind === "microphone" ? "Выбрать микрофон" : "Выбрать камеру";
	const fallbackLabel = kind === "microphone" ? "Microphone" : "Camera";
	const selectedDeviceIsListed = selectedDeviceId === "default" ||
		devices.some((device) => device.deviceId === selectedDeviceId);

	const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
		const nextDeviceId = event.target.value;
		if (kind === "microphone") {
			dispatch(deviceActions.setMicrophone(nextDeviceId));
		} else {
			dispatch(deviceActions.setCamera(nextDeviceId));
		}

		try {
			await room.switchActiveDevice(mediaKind, nextDeviceId, nextDeviceId !== "default");
		} catch (error) {
			console.error(`Failed to switch ${kind}`, error);
		}
	};

	return (
		<label className={styles["device-select-button"]} title={title} aria-label={title}>
			<ChevronUp size={14} />
			<select
				className={styles["device-select-native"]}
				value={selectedDeviceId}
				onChange={handleChange}
				aria-label={title}
				disabled={devices.length === 0 && selectedDeviceId === "default"}
			>
				<option value="default">Default</option>
				{!selectedDeviceIsListed && (
					<option value={selectedDeviceId}>Selected device</option>
				)}
				{devices.map((device, index) => (
					<option key={device.deviceId} value={device.deviceId}>
						{getDeviceLabel(device, index, fallbackLabel)}
					</option>
				))}
			</select>
		</label>
	);
}

export async function getCallDevices(kind: MediaDeviceKind): Promise<MediaDeviceInfo[]> {
	if (!navigator.mediaDevices?.enumerateDevices) return [];
	const devices = await Room.getLocalDevices(kind, false);
	return devices.filter((device) => device.deviceId !== "default");
}

function getDeviceLabel(device: MediaDeviceInfo, index: number, fallbackType: string) {
	const trimmed = device.label?.trim();
	if (trimmed) return trimmed;
	return `${fallbackType} ${index + 1}`;
}
