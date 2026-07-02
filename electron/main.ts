import { app, BrowserWindow, desktopCapturer, ipcMain, Menu, Notification, session, shell, Tray } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = "http://localhost:3000";
const ICONS_DIR = path.join(__dirname, "../assets/icons");
const WINDOWS_APP_USER_MODEL_ID = app.isPackaged ? "info.zvonok.desktop" : process.execPath;

if (process.platform === "win32") {
	app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let hasShownTrayHint = false;
let selectedScreenShareSource: { sourceId: string; includeAudio: boolean } | null = null;

interface DesktopNotificationPayload {
	title: string;
	body?: string;
	roomId?: string | number;
	userId?: string | number;
	callId?: string | number;
	type?: "message" | "call" | "friend_request" | "room";
}

function getIconPath(preferIco = process.platform === "win32") {
	return path.join(ICONS_DIR, preferIco ? "icon.ico" : "icon.png");
}

function showMainWindow() {
	if (!mainWindow) {
		createMainWindow();
		return;
	}

	if (mainWindow.isMinimized()) {
		mainWindow.restore();
	}

	mainWindow.show();
	mainWindow.focus();
}

function toggleMainWindow() {
	if (!mainWindow || !mainWindow.isVisible()) {
		showMainWindow();
		return;
	}

	mainWindow.hide();
}

function showTrayHintOnce() {
	if (hasShownTrayHint || !Notification.isSupported()) return;

	hasShownTrayHint = true;
	new Notification({
		title: "Zvonok",
		body: "Zvonok продолжает работать в фоне",
		icon: getIconPath(false),
	}).show();
}

function createMainWindow() {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 1000,
		minHeight: 700,
		title: "Zvonok",
		icon: getIconPath(),
		backgroundColor: "#111827",
		show: false,
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	mainWindow.once("ready-to-show", () => {
		mainWindow?.show();
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url);
		return { action: "deny" };
	});

	if (app.isPackaged) {
		void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
	} else {
		void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL ?? DEV_SERVER_URL);
		mainWindow.webContents.openDevTools({ mode: "detach" });
	}

	mainWindow.on("close", (event) => {
		if (isQuitting) return;

		event.preventDefault();
		mainWindow?.hide();
		showTrayHintOnce();
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

function createTray() {
	if (tray) return;

	tray = new Tray(getIconPath());
	tray.setToolTip("Zvonok");
	tray.setContextMenu(Menu.buildFromTemplate([
		{
			label: "Открыть Zvonok",
			click: showMainWindow,
		},
		{
			label: "Статус: Online",
			enabled: false,
		},
		{
			label: "Настройки",
			enabled: false,
		},
		{ type: "separator" },
		{
			label: "Перезапустить",
			click: () => {
				isQuitting = true;
				app.relaunch();
				app.quit();
			},
		},
		{
			label: "Выход",
			click: () => {
				isQuitting = true;
				app.quit();
			},
		},
	]));

	tray.on("click", showMainWindow);
	tray.on("double-click", toggleMainWindow);
}

function setupNotifications() {
	ipcMain.handle("notifications:show", (_event, payload: DesktopNotificationPayload) => {
		if (!Notification.isSupported() || !payload?.title) return;

		const notification = new Notification({
			title: payload.title,
			body: payload.body,
			icon: getIconPath(false),
		});

		notification.on("click", () => {
			showMainWindow();
			mainWindow?.webContents.send("notifications:clicked", payload);
		});

		notification.show();
	});
}

function setupDesktopWebSocketHeaders() {
	session.defaultSession.webRequest.onBeforeSendHeaders(
		{ urls: ["ws://*/*", "wss://*/*"] },
		(details, callback) => {
			const nextHeaders = { ...details.requestHeaders };
			const currentOrigin = getHeader(nextHeaders, "Origin");

			if (!currentOrigin || currentOrigin === "null" || currentOrigin.startsWith("file://")) {
				const endpointOrigin = getWebSocketHttpOrigin(details.url);
				if (endpointOrigin) {
					nextHeaders.Origin = endpointOrigin;
				}
			}

			callback({ requestHeaders: nextHeaders });
		}
	);
}

function getHeader(headers: Record<string, string | string[]>, headerName: string) {
	const matchingKey = Object.keys(headers).find((key) => key.toLowerCase() === headerName.toLowerCase());
	const value = matchingKey ? headers[matchingKey] : undefined;
	return Array.isArray(value) ? value[0] : value;
}

function getWebSocketHttpOrigin(url: string) {
	try {
		const parsedUrl = new URL(url);
		const protocol = parsedUrl.protocol === "wss:" ? "https:" : "http:";
		return `${protocol}//${parsedUrl.host}`;
	} catch {
		return null;
	}
}

function setupDisplayMediaRequestHandler() {
	ipcMain.handle("screen-share:get-sources", async () => {
		const sources = await desktopCapturer.getSources({
			types: ["screen", "window"],
			thumbnailSize: { width: 320, height: 180 },
			fetchWindowIcons: true,
		});

		return sources.map((source) => ({
			id: source.id,
			name: source.name,
			type: source.id.startsWith("screen:") ? "screen" : "window",
			thumbnail: source.thumbnail.toDataURL(),
			appIcon: source.appIcon?.toDataURL() ?? null,
		}));
	});

	ipcMain.handle("screen-share:set-selected-source", (_event, sourceId: string, includeAudio = false) => {
		selectedScreenShareSource = { sourceId, includeAudio };
	});

	ipcMain.handle("screen-share:clear-selected-source", () => {
		selectedScreenShareSource = null;
	});

	session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
		const selectedSource = selectedScreenShareSource;
		if (!selectedSource) {
			callback({});
			return;
		}

		void desktopCapturer.getSources({ types: ["screen", "window"] })
			.then((sources) => {
				const videoSource = sources.find((source) => source.id === selectedSource.sourceId);

				if (!videoSource) {
					callback({});
					selectedScreenShareSource = null;
					return;
				}

				if (process.platform === "win32" && selectedSource.includeAudio) {
					callback({ video: videoSource, audio: "loopback" });
					selectedScreenShareSource = null;
					return;
				}

				callback({ video: videoSource });
				selectedScreenShareSource = null;
			})
			.catch(() => {
				callback({});
				selectedScreenShareSource = null;
			});
	});
}

if (!gotSingleInstanceLock) {
	app.quit();
} else {
	app.on("second-instance", showMainWindow);

	void app.whenReady().then(() => {
		setupNotifications();
		setupDesktopWebSocketHeaders();
		setupDisplayMediaRequestHandler();
		createMainWindow();
		createTray();

		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				createMainWindow();
			}
		});
	});
}

app.on("before-quit", () => {
	isQuitting = true;
});
