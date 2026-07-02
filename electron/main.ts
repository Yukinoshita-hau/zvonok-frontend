import { app, BrowserWindow, desktopCapturer, session, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_SERVER_URL = "http://localhost:3000";

let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 1000,
		minHeight: 700,
		title: "Zvonok",
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

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

function setupDisplayMediaRequestHandler() {
	session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
		void desktopCapturer.getSources({ types: ["screen", "window"] })
			.then((sources) => {
				const videoSource = sources.find((source) => source.id.startsWith("screen:")) ?? sources[0];

				if (!videoSource) {
					callback({});
					return;
				}

				if (process.platform === "win32") {
					callback({ video: videoSource, audio: "loopback" });
					return;
				}

				callback({ video: videoSource });
			})
			.catch(() => {
				callback({});
			});
	});
}

void app.whenReady().then(() => {
	setupDisplayMediaRequestHandler();
	createMainWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createMainWindow();
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
