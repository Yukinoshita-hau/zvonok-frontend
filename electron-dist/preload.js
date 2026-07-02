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
});
//# sourceMappingURL=preload.js.map