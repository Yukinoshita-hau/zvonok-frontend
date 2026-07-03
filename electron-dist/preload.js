import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("zvonokDesktop", {
    platform: process.platform,
    getScreenShareSources: () => ipcRenderer.invoke("screen-share:get-sources"),
    setSelectedScreenShareSource: (sourceId, includeAudio = false) => {
        return ipcRenderer.invoke("screen-share:set-selected-source", sourceId, includeAudio);
    },
    clearSelectedScreenShareSource: () => ipcRenderer.invoke("screen-share:clear-selected-source"),
    notifications: {
        showNotification: (payload) => ipcRenderer.invoke("notifications:show", payload),
        onNotificationClicked: (callback) => {
            const listener = (_event, payload) => {
                callback(payload);
            };
            ipcRenderer.on("notifications:clicked", listener);
            return () => ipcRenderer.off("notifications:clicked", listener);
        },
    },
    hotkeys: {
        registerHotkey: (action, accelerator) => ipcRenderer.invoke("hotkeys:register", action, accelerator),
        unregisterHotkey: (action) => ipcRenderer.invoke("hotkeys:unregister", action),
        onHotkeyPressed: (callback) => {
            const listener = (_event, action) => {
                callback(action);
            };
            ipcRenderer.on("hotkeys:pressed", listener);
            return () => ipcRenderer.off("hotkeys:pressed", listener);
        },
    },
});
//# sourceMappingURL=preload.js.map