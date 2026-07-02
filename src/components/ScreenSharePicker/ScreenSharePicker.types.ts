import type { ScreenShareQualityPreset } from "../../utils/callQuality";

export type ScreenShareSourceType = "screen" | "window" | "tab";

export interface ScreenShareSource {
	id: string;
	name: string;
	type: ScreenShareSourceType;
	thumbnail?: string | null;
	appIcon?: string | null;
}

export interface ScreenSharePickerResult {
	source: ScreenShareSource;
	quality: ScreenShareQualityPreset;
	includeSystemAudio: boolean;
}

export interface ZvonokDesktopApi {
	platform: string;
	getScreenShareSources: () => Promise<ScreenShareSource[]>;
	setSelectedScreenShareSource: (sourceId: string, includeAudio?: boolean) => Promise<void>;
	clearSelectedScreenShareSource: () => Promise<void>;
}

declare global {
	interface Window {
		zvonokDesktop?: ZvonokDesktopApi;
	}
}
