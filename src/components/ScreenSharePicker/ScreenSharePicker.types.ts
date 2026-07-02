import type { ScreenShareQualityPreset } from "../../utils/callQuality";
import type { DesktopNotificationPayload } from "../../services/desktop.service";

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
	notifications?: {
		showNotification: (payload: DesktopNotificationPayload) => Promise<void>;
		onNotificationClicked: (callback: (payload: DesktopNotificationPayload) => void) => () => void;
	};
}

declare global {
	interface Window {
		zvonokDesktop?: ZvonokDesktopApi;
	}
}
