import { contextBridge, ipcRenderer } from "electron";

interface DesktopNotificationPayload {
	title: string;
	body?: string;
	roomId?: string | number;
	userId?: string | number;
	callId?: string | number;
	type?: "message" | "call" | "friend_request" | "room";
}

type DesktopHotkeyAction = "microphone" | "camera" | "screenShare";

contextBridge.exposeInMainWorld("zvonokDesktop", {
	platform: process.platform,
	getScreenShareSources: () => ipcRenderer.invoke("screen-share:get-sources"),
	setSelectedScreenShareSource: (sourceId: string, includeAudio = false) => {
		return ipcRenderer.invoke("screen-share:set-selected-source", sourceId, includeAudio);
	},
	clearSelectedScreenShareSource: () => ipcRenderer.invoke("screen-share:clear-selected-source"),
	notifications: {
		showNotification: (payload: DesktopNotificationPayload) => ipcRenderer.invoke("notifications:show", payload),
		onNotificationClicked: (callback: (payload: DesktopNotificationPayload) => void) => {
			const listener = (_event: Electron.IpcRendererEvent, payload: DesktopNotificationPayload) => {
				callback(payload);
			};

			ipcRenderer.on("notifications:clicked", listener);
			return () => ipcRenderer.off("notifications:clicked", listener);
		},
	},
	hotkeys: {
		registerHotkey: (action: DesktopHotkeyAction, accelerator: string) =>
			ipcRenderer.invoke("hotkeys:register", action, accelerator),
		unregisterHotkey: (action: DesktopHotkeyAction) =>
			ipcRenderer.invoke("hotkeys:unregister", action),
		onHotkeyPressed: (callback: (action: DesktopHotkeyAction) => void) => {
			const listener = (_event: Electron.IpcRendererEvent, action: DesktopHotkeyAction) => {
				callback(action);
			};

			ipcRenderer.on("hotkeys:pressed", listener);
			return () => ipcRenderer.off("hotkeys:pressed", listener);
		},
	},
});
