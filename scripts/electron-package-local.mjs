import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build, Platform } from 'electron-builder';
import { desktopConnectSources } from '../electron-dist/desktopContracts.js';
import { validateLocalDocker } from '../electron-dist/environment.js';

const require = createRequire(import.meta.url);
const asar = require('@electron/asar');
const root = 'artifacts/stages/local-docker';
const metadata = validateLocalDocker(JSON.parse(await readFile(`${root}/renderer/desktop-environment.json`, 'utf8')));
assert.deepEqual(metadata, JSON.parse(await readFile('config/desktop-local-docker.json', 'utf8')), 'Renderer does not match the selected build profile');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (!process.argv.includes('--verify-only')) await build({
  targets: Platform.WINDOWS.createTarget('dir'), publish: 'never',
  config: {
    ...pkg.build, appId: 'info.zvonok.desktop.local-docker',
    electronDist: path.resolve('node_modules/electron/dist'),
    directories: { output: `${root}/package` },
    files: [...pkg.build.files.filter(file => file !== 'dist/**/*'), { from: `${root}/renderer`, to: 'dist' }],
    extraMetadata: { name: 'zvonok-local-docker' },
  },
});
const archive = path.resolve(`${root}/package/win-unpacked/resources/app.asar`);
const extract = file => asar.extractFile(archive, path.normalize(file)).toString();
assert.deepEqual(validateLocalDocker(JSON.parse(extract('dist/desktop-environment.json'))), metadata);
const html = extract('dist/index.html');
const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1];
assert(csp, 'Packaged CSP is missing');
const connect = csp.split(';').find(value => value.trim().startsWith('connect-src ')).trim().split(/\s+/).slice(1);
assert.deepEqual(connect.sort(), ["'self'", ...desktopConnectSources(metadata.api, metadata.websocket, true, metadata.livekit)].sort());
const entry = html.match(/<script[^>]+src="([^"]+\.js)"[^>]*type="module"/)?.[1] ?? html.match(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/)?.[1];
assert(entry, 'Packaged renderer entry missing');
const javascript = extract('dist/' + entry.replace(/^\.\//, '').replace(/^\//, ''));
for (const endpoint of [metadata.api, metadata.websocket]) assert(javascript.includes(endpoint), 'Bundled renderer endpoint mismatch');
assert(!/127\.0\.0\.1:(18086|48886)/.test(html + javascript), 'Isolated E6 endpoint found in local package');
assert(extract('electron-dist/main.js').includes('setupLocalDockerAssets'), 'Stale Electron main');
const result = { status: 'PASS', ...metadata, executable: path.resolve(`${root}/package/win-unpacked/Zvonok.exe`), cspConnectSources: connect, checked: ['Метаданные внутри app.asar', 'Адреса API/STOMP внутри JS', 'Точный список CSP origins', 'Отсутствие E6 API/SFU', 'Обработчик упакованных локальных ресурсов'] };
await mkdir(root, { recursive: true });
await writeFile(`${root}/bundle-verification.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
