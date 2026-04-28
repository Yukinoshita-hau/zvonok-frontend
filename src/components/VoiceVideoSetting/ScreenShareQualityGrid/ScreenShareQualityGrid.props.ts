import type {
	ScreenShareManualQuality,
	ScreenSharePresetGroup,
	ScreenShareQualitySetting,
} from "../../../utils/callQuality";

export interface ScreenShareQualityGridProps {
	value: ScreenShareQualitySetting;
	onChange: (value: ScreenShareQualitySetting) => void;
	showExperimental: boolean;
	onShowExperimentalChange: (value: boolean) => void;
	runtimeInfo: {
		requestedFps: number | null;
		actualFps: number | null;
		requestedResolution: string | null;
		actualResolution: string | null;
		activePreset: string | null;
		fallbackReason: string | null;
		updatedAt: string | null;
	};
}

export interface QualityGroupSection {
	group: ScreenSharePresetGroup;
	label: string;
	description: string;
	items: ScreenShareManualQuality[];
}
