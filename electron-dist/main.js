import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, Menu, Notification, powerMonitor, session, shell, Tray } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { safeExternalUrl } from './desktopContracts.js';
import { setupExternalDock } from './externalDock.js';
import { readWindowState, trackWindowBounds, windowBounds, closeToTray, saveCloseToTray } from './windowState.js';
import { createStartup } from './startup.js';
import { setupUpdates } from './updates.js';
import { showNativeNotification } from './notifications.js';
import { readDesktopEnvironment, setupLocalDockerAssets } from './localDocker.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopEnvironment = app.isPackaged ? readDesktopEnvironment(path.join(__dirname, '..')) : null;
const DEV_SERVER_URL = "http://localhost:3000";
const ICONS_DIR = path.join(__dirname, "../assets/icons");
const WINDOWS_APP_USER_MODEL_ID = app.isPackaged ? "info.zvonok.desktop" : process.execPath;
const DESKTOP_WEB_ORIGIN = process.env.ZVONOK_DESKTOP_WEB_ORIGIN ?? "https://zvonok.info";
const rendererUrl = app.isPackaged ? (desktopEnvironment?.environment === 'LOCAL_DOCKER' ? desktopEnvironment.rendererOrigin + '/' : pathToFileURL(path.join(__dirname, '../dist/index.html')).href) : (process.env.VITE_DEV_SERVER_URL ?? DEV_SERVER_URL);
if (!app.isPackaged) {
    const devUrl = new URL(rendererUrl);
    if (devUrl.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(devUrl.hostname))
        throw new Error('Dev renderer must use loopback HTTP');
    app.setPath('userData', process.env.ZVONOK_DESKTOP_PROFILE || path.join(app.getPath('appData'), 'Zvonok-development'));
}
if (process.platform === "win32") {
    app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);
}
const gotSingleInstanceLock = app.requestSingleInstanceLock();
let mainWindow = null;
let startup;
let mainReady = false;
let retryMainRenderer;
let markRendererReady;
let startupTimer;
let startupRetries = 0;
let tray = null;
let isQuitting = false;
let selectedScreenShareSource = null;
const registeredHotkeys = new Map();
let externalDock;
let updates;
let activity = null;
function validateOwner(event) {
    const frame = event.senderFrame;
    if (!mainWindow || event.sender !== mainWindow.webContents || frame !== mainWindow.webContents.mainFrame || !frame)
        throw new Error('UNTRUSTED_SENDER');
    const current = new URL(frame.url), expected = new URL(rendererUrl);
    if (expected.protocol === 'file:' ? current.protocol !== 'file:' || current.pathname !== expected.pathname || current.search !== expected.search : current.origin !== expected.origin)
        throw new Error('UNTRUSTED_DOCUMENT');
}
function ownerHandle(channel, listener) {
    ipcMain.handle(channel, (event, ...args) => { validateOwner(event); return listener(event, ...args); });
}
async function requestQuit(relaunch = false) {
    if ((activity?.busy || externalDock?.hasCall()) && mainWindow) {
        const answer = await dialog.showMessageBox(mainWindow, { type: 'question', message: 'Звонок будет завершён. Выйти из Zvonok?', buttons: ['Отмена', 'Выйти'], defaultId: 0, cancelId: 0, noLink: true });
        if (answer.response !== 1)
            return;
    }
    await updates?.prepareShutdown();
    isQuitting = true;
    if (relaunch)
        app.relaunch();
    app.quit();
}
function getIconPath(preferIco = process.platform === "win32") {
    return path.join(ICONS_DIR, preferIco ? "icon.ico" : "icon.png");
}
function showMainWindow() {
    if (!app.isReady())
        return;
    if (startup && !mainReady) {
        startup.focus();
        return;
    }
    if (!mainWindow || mainWindow.isDestroyed()) {
        createMainWindow();
        return;
    }
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
}
function mainWindowState() {
    if (!mainWindow || mainWindow.isDestroyed())
        return { focused: false, visible: false, minimized: false };
    return { focused: mainWindow.isFocused(), visible: mainWindow.isVisible(), minimized: mainWindow.isMinimized() };
}
function createMainWindow() {
    mainReady = false;
    mainWindow = new BrowserWindow({
        ...windowBounds('main', { x: 40, y: 40, width: 1400, height: 900 }),
        minWidth: 700,
        minHeight: 500,
        title: "Zvonok",
        icon: getIconPath(),
        backgroundColor: "#111827",
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            devTools: !app.isPackaged,
        },
    });
    trackWindowBounds(mainWindow, 'main');
    const publishWindowState = () => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed())
            mainWindow.webContents.send('desktop:window-state', mainWindowState());
    };
    mainWindow.on('focus', publishWindowState).on('blur', publishWindowState).on('show', publishWindowState)
        .on('hide', publishWindowState).on('minimize', publishWindowState).on('restore', publishWindowState);
    mainWindow.webContents.on('will-navigate', event => event.preventDefault());
    mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
    mainWindow.webContents.on('did-start-navigation', (_event, _url, inPlace, isMainFrame) => {
        if (isMainFrame && !inPlace) {
            activity = null;
            externalDock?.clear();
            selectedScreenShareSource = null;
        }
    });
    mainWindow.webContents.on('render-process-gone', () => {
        activity = null;
        externalDock?.clear();
        selectedScreenShareSource = null;
        globalShortcut.unregisterAll();
        registeredHotkeys.clear();
        if (isQuitting || !mainWindow)
            return;
        void dialog.showMessageBox(mainWindow, { type: 'error', message: 'Окно Zvonok завершило работу. Звонок прерван. Восстановить приложение?', buttons: ['Восстановить', 'Позже'], defaultId: 0, cancelId: 1 }).then(result => {
            if (result.response === 0 && mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.reload();
                showMainWindow();
            }
        });
    });
    mainWindow.on('unresponsive', () => externalDock?.clear());
    let readyToShow = false;
    let rendererLoaded = false;
    const reveal = () => {
        if (!readyToShow || !rendererLoaded || mainReady || isQuitting)
            return;
        mainReady = true;
        clearTimeout(startupTimer);
        mainWindow?.show();
        mainWindow?.focus();
        startup?.close();
        startup = undefined;
        if (!app.isPackaged) {
            mainWindow?.webContents.openDevTools({ mode: "detach" });
        }
    };
    mainWindow.once("ready-to-show", () => { readyToShow = true; reveal(); });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (safeExternalUrl(url))
            void shell.openExternal(url).catch(() => { });
        return { action: "deny" };
    });
    retryMainRenderer = () => {
        rendererLoaded = false;
        void mainWindow?.loadURL(rendererUrl).catch(() => { if (!rendererLoaded)
            startup?.error(); });
    };
    markRendererReady = () => { rendererLoaded = true; reveal(); };
    retryMainRenderer();
    mainWindow.on("close", (event) => {
        if (isQuitting)
            return;
        event.preventDefault();
        if (closeToTray())
            mainWindow?.hide();
        else
            void requestQuit();
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
        activity = null;
        externalDock?.clear();
    });
}
function createTray() {
    if (tray)
        return;
    tray = new Tray(getIconPath());
    tray.setToolTip("Zvonok");
    tray.setContextMenu(Menu.buildFromTemplate([
        {
            label: "Открыть Zvonok",
            click: showMainWindow,
        },
        {
            label: "Панель текущего звонка",
            click: () => { if (externalDock?.hasCall())
                externalDock.open();
            else
                showMainWindow(); },
        },
        {
            label: 'Проверить обновления',
            click: () => {
                void updates?.check().then(() => {
                    const status = updates?.get().status;
                    const message = status === 'disabled' ? 'Автообновление ещё не настроено для этой сборки.' : status === 'error' ? 'Проверка обновлений не удалась. Повторите позже.' : status === 'ready' ? 'Обновление готово. Откройте Настройки → Приложение для перезапуска.' : 'Проверка завершена. Установлена актуальная версия.';
                    void dialog.showMessageBox({ type: 'info', message, noLink: true });
                });
            },
        },
        { type: "separator" },
        {
            label: "Перезапустить",
            click: () => {
                void requestQuit(true);
            },
        },
        {
            label: "Выход",
            click: () => {
                void requestQuit();
            },
        },
    ]));
    tray.on("click", showMainWindow);
    tray.on("double-click", showMainWindow);
}
function setupNotifications() {
    const calls = new Map();
    ownerHandle('notifications:dismiss-call', (_event, callId) => {
        if (!Number.isSafeInteger(callId) || callId <= 0)
            throw new Error('INVALID_CALL_ID');
        calls.get(callId)?.close();
        calls.delete(callId);
    });
    ownerHandle("notifications:show", (_event, payload) => {
        if (!payload || typeof payload.title !== 'string' || payload.title.length > 200 || (payload.body !== undefined && (typeof payload.body !== 'string' || payload.body.length > 4000)))
            throw new Error('INVALID_NOTIFICATION');
        if (!Notification.isSupported())
            throw new Error('NOTIFICATIONS_UNAVAILABLE');
        if (!payload.title)
            return;
        const callId = payload.type === 'call' ? Number(payload.callId) : undefined;
        if (callId !== undefined && (!Number.isSafeInteger(callId) || callId <= 0))
            throw new Error('INVALID_CALL_ID');
        if (callId && calls.has(callId))
            return;
        const notification = new Notification({
            title: payload.title,
            silent: payload.silent === true,
            body: payload.body,
            icon: getIconPath(false),
        });
        notification.on("click", () => {
            showMainWindow();
            mainWindow?.webContents.send("notifications:clicked", payload);
        });
        if (callId) {
            calls.set(callId, notification);
            notification.once('close', () => { if (calls.get(callId) === notification)
                calls.delete(callId); });
            notification.once('failed', () => { calls.delete(callId); });
        }
        return showNativeNotification(notification).catch(error => { if (callId)
            calls.delete(callId); throw error; });
    });
}
function setupGlobalHotkeys() {
    ownerHandle("hotkeys:register", (_event, action, accelerator) => {
        if (!['microphone', 'camera', 'screenShare'].includes(action) || typeof accelerator !== 'string' || accelerator.length > 100)
            throw new Error('INVALID_HOTKEY');
        unregisterHotkey(action);
        if (!accelerator)
            return false;
        const isRegistered = globalShortcut.register(accelerator, () => {
            if (action === "screenShare") {
                showMainWindow();
            }
            mainWindow?.webContents.send("hotkeys:pressed", action);
        });
        if (!isRegistered) {
            console.warn(`Failed to register global hotkey "${action}": ${accelerator}`);
            return false;
        }
        registeredHotkeys.set(action, accelerator);
        return true;
    });
    ownerHandle("hotkeys:unregister", (_event, action) => {
        if (!['microphone', 'camera', 'screenShare'].includes(action))
            throw new Error('INVALID_HOTKEY');
        unregisterHotkey(action);
    });
}
function unregisterHotkey(action) {
    const accelerator = registeredHotkeys.get(action);
    if (!accelerator)
        return;
    globalShortcut.unregister(accelerator);
    registeredHotkeys.delete(action);
}
function setupDesktopWebSocketHeaders() {
    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["ws://*/*", "wss://*/*"] }, (details, callback) => {
        // A delayed handshake from a destroyed document must not replace its new SFU owner.
        if (!mainWindow || details.webContentsId !== mainWindow.webContents.id || !details.frame || details.frame !== mainWindow.webContents.mainFrame) {
            callback({ cancel: true });
            return;
        }
        const nextHeaders = { ...details.requestHeaders };
        const currentOrigin = getHeader(nextHeaders, "Origin");
        if (!currentOrigin || currentOrigin === "null" || currentOrigin.startsWith("file://")) {
            const desktopOrigin = getDesktopWebSocketOrigin(details.url);
            if (desktopOrigin) {
                setHeader(nextHeaders, "Origin", desktopOrigin);
            }
        }
        callback({ requestHeaders: nextHeaders });
    });
}
function getHeader(headers, headerName) {
    const matchingKey = Object.keys(headers).find((key) => key.toLowerCase() === headerName.toLowerCase());
    const value = matchingKey ? headers[matchingKey] : undefined;
    return Array.isArray(value) ? value[0] : value;
}
function setHeader(headers, headerName, value) {
    const matchingKey = Object.keys(headers).find((key) => key.toLowerCase() === headerName.toLowerCase());
    headers[matchingKey ?? headerName] = value;
}
function getDesktopWebSocketOrigin(url) {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname === "api.zvonok.info") {
            return DESKTOP_WEB_ORIGIN;
        }
        const protocol = parsedUrl.protocol === "wss:" ? "https:" : "http:";
        return `${protocol}//${parsedUrl.host}`;
    }
    catch {
        return null;
    }
}
function setupDisplayMediaRequestHandler() {
    ownerHandle("screen-share:get-sources", async () => {
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
    ownerHandle("screen-share:set-selected-source", (_event, sourceId, includeAudio = false) => {
        if (typeof sourceId !== 'string' || !/^(screen|window):[\w:.-]{1,150}$/.test(sourceId) || typeof includeAudio !== 'boolean')
            throw new Error('INVALID_SOURCE');
        selectedScreenShareSource = { sourceId, includeAudio };
    });
    ownerHandle("screen-share:clear-selected-source", () => {
        selectedScreenShareSource = null;
    });
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        if (!mainWindow || request.frame !== mainWindow.webContents.mainFrame) {
            callback({});
            return;
        }
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
}
else {
    app.on("second-instance", showMainWindow);
    void app.whenReady().then(async () => {
        if (desktopEnvironment?.environment === 'LOCAL_DOCKER')
            setupLocalDockerAssets(path.join(__dirname, '..'), desktopEnvironment);
        startup = createStartup(() => {
            if (++startupRetries > 2) {
                app.quit();
                return;
            }
            retryMainRenderer?.();
            clearTimeout(startupTimer);
            startupTimer = setTimeout(() => startup?.error(), 20000);
        }, () => { if (!mainReady && !isQuitting)
            app.quit(); });
        startup.prerequisites();
        await readWindowState();
        ownerHandle('desktop:window-state:get', mainWindowState);
        ownerHandle('desktop:renderer-ready', () => markRendererReady?.());
        ownerHandle('desktop:preferences:get', () => ({ closeToTray: closeToTray(), electron: process.versions.electron, version: app.getVersion(), platform: process.platform, notifications: Notification.isSupported() }));
        ownerHandle('desktop:preferences:set-close-to-tray', async (_event, value) => {
            if (typeof value !== 'boolean')
                throw new Error('INVALID_PREFERENCE');
            await saveCloseToTray(value);
            return closeToTray();
        });
        externalDock = setupExternalDock(() => mainWindow, validateOwner, showMainWindow);
        ownerHandle('desktop:activity', (_event, busy) => {
            if (typeof busy !== 'boolean')
                throw new Error('INVALID_ACTIVITY');
            activity = { busy, at: Date.now() };
        });
        updates = await setupUpdates(() => mainWindow, validateOwner, () => !!activity && !activity.busy && Date.now() - activity.at < 15000 && !externalDock?.hasCall(), state => startup?.update(state), () => gotSingleInstanceLock && !isQuitting && !mainWindow && !activity && !externalDock?.hasCall());
        const allowedPermissions = new Set(['media', 'display-capture', 'speaker-selection', 'fullscreen', 'notifications']);
        session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
            callback(contents === mainWindow?.webContents && details.isMainFrame === true && allowedPermissions.has(permission));
        });
        session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) => contents === mainWindow?.webContents && details.isMainFrame && allowedPermissions.has(permission));
        setupNotifications();
        setupGlobalHotkeys();
        setupDesktopWebSocketHeaders();
        setupDisplayMediaRequestHandler();
        if (await updates.prepareStartup(() => startup?.preparing())) {
            await new Promise(resolve => { startupTimer = setTimeout(resolve, 2500); });
            if (isQuitting)
                return;
            updates.installationTimedOut();
        }
        if (isQuitting)
            return;
        startup?.opening();
        createMainWindow();
        startupTimer = setTimeout(() => startup?.error(), 20000);
        void updates.check();
        createTray();
        const resume = () => mainWindow?.webContents.send('desktop:resume');
        powerMonitor.on('resume', resume);
        powerMonitor.on('unlock-screen', resume);
        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createMainWindow();
            }
        });
    });
}
app.on("before-quit", () => {
    isQuitting = true;
    clearTimeout(startupTimer);
    startup?.close();
    globalShortcut.unregisterAll();
});
//# sourceMappingURL=main.js.map