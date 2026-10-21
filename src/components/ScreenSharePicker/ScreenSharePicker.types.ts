import type { ScreenShareQualityPreset } from "../../utils/callQuality";
import type { DesktopNotificationPayload } from "../../services/desktop.service";
import type { DockState, DockCommand, DockAck, UpdateState, DesktopPreferences, DesktopWindowState } from '../../../electron/desktopTypes';

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

export type DesktopHotkeyAction = "microphone" | "camera" | "screenShare";

export interface ZvonokDesktopApi {
	preferences?: {
		get: () => Promise<DesktopPreferences>;
		setCloseToTray: (value: boolean) => Promise<boolean>;
	};
	platform: string;
	lifecycle?: {
		ready?: () => Promise<void>;
		publish: (busy: boolean) => Promise<void>;
		getWindowState?: () => Promise<DesktopWindowState>;
		onWindowState?: (callback: (state: DesktopWindowState) => void) => () => void;
	};
	updates?: {
		get: () => Promise<UpdateState>;
		check: () => Promise<void>;
		install: () => Promise<void>;
		onState: (callback: (state: UpdateState) => void) => () => void;
	};
	dock?: {
		publish: (state: DockState | null) => Promise<void>;
		open: () => Promise<void>;
		ack: (ack: DockAck) => Promise<boolean>;
		onCommand: (callback: (command: DockCommand) => void) => () => void;
	};
	onResume?: (callback: () => void) => () => void;
	getScreenShareSources: () => Promise<ScreenShareSource[]>;
	setSelectedScreenShareSource: (sourceId: string, includeAudio?: boolean) => Promise<void>;
	clearSelectedScreenShareSource: () => Promise<void>;
	notifications?: {
		dismissCall?: (callId: number) => Promise<void>;
		showNotification: (payload: DesktopNotificationPayload) => Promise<void>;
		onNotificationClicked: (callback: (payload: DesktopNotificationPayload) => void) => () => void;
	};
	hotkeys?: {
		registerHotkey: (action: DesktopHotkeyAction, accelerator: string) => Promise<boolean>;
		unregisterHotkey: (action: DesktopHotkeyAction) => Promise<void>;
		onHotkeyPressed: (callback: (action: DesktopHotkeyAction) => void) => () => void;
	};
}

declare global {
	interface Window {
		zvonokDesktop?: ZvonokDesktopApi;
	}
}
