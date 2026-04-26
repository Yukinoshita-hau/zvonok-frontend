import { ParticipantVolumeRow } from "../AudioMixPanel/ParticipantVolumeRow";

interface ParticipantVolumeMenuProps {
	micVolume: number;
	streamVolume: number;
	hasScreenShareAudio: boolean;
	onMicChange: (value: number) => void;
	onMicReset: () => void;
	onStreamChange: (value: number) => void;
	onStreamReset: () => void;
}

export function ParticipantVolumeMenu({
	micVolume,
	streamVolume,
	hasScreenShareAudio,
	onMicChange,
	onMicReset,
	onStreamChange,
	onStreamReset,
}: ParticipantVolumeMenuProps) {
	return (
		<div>
			<ParticipantVolumeRow
				source="microphone"
				value={micVolume}
				onChange={onMicChange}
				onReset={onMicReset}
			/>
			{hasScreenShareAudio && (
				<ParticipantVolumeRow
					source="screenShareAudio"
					value={streamVolume}
					onChange={onStreamChange}
					onReset={onStreamReset}
				/>
			)}
		</div>
	);
}
