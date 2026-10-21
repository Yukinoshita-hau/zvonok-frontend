import { ChevronUp } from "lucide-react";
import { Room } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";
import { useDispatch, useSelector } from "react-redux";
import type { ChangeEvent } from "react";
import { selectMediaDevice } from "../../store/slices/device.slice";
import type { AppDispatch, RootState } from "../../store/store";
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
	useRoomContext();
	const dispatch = useDispatch<AppDispatch>();
	const {deviceSwitchPending, mediaError} = useSelector((s: RootState) => s.device);
	const mediaKind: MediaDeviceKind = kind === "microphone" ? "audioinput" : "videoinput";
	const title = kind === "microphone" ? "Выбрать микрофон" : "Выбрать камеру";
	const fallbackLabel = kind === "microphone" ? "Microphone" : "Camera";
	const selectedDeviceIsListed = selectedDeviceId === "default" ||
		devices.some((device) => device.deviceId === selectedDeviceId);

	const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
		const nextDeviceId = event.target.value;
		await dispatch(selectMediaDevice({kind: mediaKind, id: nextDeviceId}));
	};

	return (
		<><label className={styles["device-select-button"]} title={title} aria-label={title}>
			<ChevronUp size={14} />
			<select
				className={styles["device-select-native"]}
				value={selectedDeviceId}
				onChange={handleChange}
				aria-label={title}
				disabled={deviceSwitchPending || (devices.length === 0 && selectedDeviceId === "default")}
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
		</label>{mediaError && <span role="alert">{mediaError}</span>}</>
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
