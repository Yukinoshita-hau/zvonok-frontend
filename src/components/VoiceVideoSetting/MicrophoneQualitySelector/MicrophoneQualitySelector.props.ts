import type { MicQualitySetting } from "../../../utils/microphoneQuality";

export interface MicrophoneQualitySelectorProps {
	value: MicQualitySetting;
	onChange: (value: MicQualitySetting) => void;
}
