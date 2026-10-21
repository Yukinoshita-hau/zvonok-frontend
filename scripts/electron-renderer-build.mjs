import { build, loadEnv } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { desktopConnectSources } from '../electron-dist/desktopContracts.js';
import { validateLocalDocker } from '../electron-dist/environment.js';

const local = process.argv.includes('--local-docker');
const metadata = local ? validateLocalDocker(JSON.parse(await readFile('config/desktop-local-docker.json', 'utf8'))) : null;
const selected = metadata ? { VITE_API_URL: metadata.api, VITE_WS_URL: metadata.websocket, VITE_LIVEKIT_URL: metadata.livekit, ZVONOK_DESKTOP_STAGING: '1' } : null;
if (selected) for (const [key, value] of Object.entries(selected)) {
  assert(!process.env[key] || process.env[key] === value, `LOCAL_DOCKER inherited ${key} conflicts with the selected profile`);
  process.env[key] = value;
}
const env = { ...loadEnv('production', process.cwd()), ...process.env };
assert(env.VITE_LIVEKIT_URL, 'Desktop build requires explicit VITE_LIVEKIT_URL for signaling and validation CSP origins');
const sources = desktopConnectSources(env.VITE_API_URL, env.VITE_WS_URL, env.ZVONOK_DESKTOP_STAGING === '1', env.VITE_LIVEKIT_URL);
const outDir = local ? 'artifacts/stages/local-docker/renderer' : 'dist';
if (metadata) {
  const options = { signal: AbortSignal.timeout(10000), redirect: 'error' };
  const web = await fetch(metadata.rendererOrigin, options); assert(web.ok, 'Normal Docker web is unavailable');
  const html = await web.text();
  const entry = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(match => match[1]).find(value => value.startsWith('/assets/'));
  assert(entry, 'Normal web renderer entry missing');
  const javascript = await (await fetch(new URL(entry, metadata.rendererOrigin), options)).text();
  assert(javascript.includes(metadata.api) && javascript.includes(metadata.websocket), 'Normal web and LOCAL_DOCKER API/STOMP endpoints differ');
  const cors = await fetch(metadata.api + '/auth/refresh', { ...options, method: 'OPTIONS', headers: { Origin: metadata.rendererOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert(cors.ok && cors.headers.get('access-control-allow-origin') === metadata.rendererOrigin && cors.headers.get('access-control-allow-credentials') === 'true', 'Existing backend CORS does not permit the local web cookie contract');
  assert((await fetch(metadata.livekit.replace(/^ws/, 'http'), options)).ok, 'Normal Docker SFU is unavailable');
}
console.log(JSON.stringify(metadata ?? { environment: env.ZVONOK_DESKTOP_STAGING === '1' ? 'ISOLATED_E6' : 'PRODUCTION', api: env.VITE_API_URL, websocket: env.VITE_WS_URL, livekit: env.VITE_LIVEKIT_URL }, null, 2));
await build({ base: local ? '/' : './', build: { outDir, emptyOutDir: true } });
const file = `${outDir}/index.html`;
const html = await readFile(file, 'utf8');
assert(html.includes('<head>') && !html.includes('Content-Security-Policy'));
const localMedia = sources.filter(source => source.startsWith('http:')).join(' ');
const policy = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data: blob: ${localMedia}; media-src 'self' https: blob: ${localMedia}; connect-src 'self' ${local ? '' : 'https: wss: '}${sources.join(' ')}; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'`;
const result = html.replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${policy}">`);
assert(result.includes("script-src 'self'") && !result.includes('unsafe-eval'));
await writeFile(file, result);
await writeFile(`${outDir}/desktop-environment.json`, JSON.stringify(metadata ?? { environment: env.ZVONOK_DESKTOP_STAGING === '1' ? 'ISOLATED_E6' : 'PRODUCTION', api: env.VITE_API_URL, websocket: env.VITE_WS_URL, livekit: env.VITE_LIVEKIT_URL }, null, 2));
console.log('Desktop renderer built with explicit endpoints and a packaged CSP.');
