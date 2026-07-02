import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("zvonokDesktop", {
	platform: process.platform,
});
