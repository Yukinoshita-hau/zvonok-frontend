import { contextBridge, ipcRenderer } from "electron";

interface DesktopNotificationPayload {
	title: string;
	body?: string;
	roomId?: string | number;
	userId?: string | number;
	callId?: string | number;
	type?: "message" | "call" | "friend_request" | "room";
}

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
});
