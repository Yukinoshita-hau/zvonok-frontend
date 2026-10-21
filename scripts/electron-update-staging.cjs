// Real NSIS updater/provider/hash pipeline with an isolated AppAdapter and loopback feed.
// The payload is deliberately not an installer. Nothing is installed or executed.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { NsisUpdater } = require('electron-updater');
const { NodeHttpExecutor } = require('builder-util/out/nodeHttpExecutor');
const { configureRequestOptionsFromUrl } = require('builder-util-runtime');
const output = path.resolve('artifacts/stages/work/electron-native/update-staging');
(async () => {
  await fs.mkdir(output, { recursive: true });
  const runDirectory = await fs.mkdtemp(path.join(output, 'run-'));
  let mode = 'current';
  let artifactRequests = 0;
  const payload = Buffer.alloc(1024 * 1024, 'STAGING DATA - NOT AN INSTALLER\n');
  const hash = crypto.createHash('sha512').update(payload).digest('base64');
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/latest.yml')) {
      if (mode === 'offline') { response.writeHead(503); response.end(); return; }
      response.setHeader('Content-Type', 'text/yaml');
      if (mode === 'corrupt') { response.end('invalid: ['); return; }
      response.end(JSON.stringify({ version: mode === 'current' ? '0.0.0' : mode === 'downgrade' ? '0.0.0-older' : '0.0.1', files: [{ url: 'staging-data.exe', sha512: mode === 'bad-hash' ? Buffer.alloc(64).toString('base64') : hash, size: payload.length }], path: 'staging-data.exe', sha512: hash }));
    } else if (request.url.startsWith('/staging-data.exe')) {
      artifactRequests++;
      if (mode === 'broken-download') { response.writeHead(503); response.end(); return; }
      response.setHeader('Content-Length', payload.length);
      if (mode === 'interrupted') { response.write(payload.subarray(0, payload.length / 2)); setImmediate(() => response.destroy()); return; }
      response.end(payload);
    } else { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const feed = `http://127.0.0.1:${server.address().port}/`;
  const results = [];
  try {
    for (mode of ['current', 'available', 'bad-hash', 'corrupt', 'offline', 'downgrade', 'interrupted']) {
      const profile = path.join(runDirectory, mode); await fs.mkdir(profile, { recursive: true });
      const config = path.join(profile, 'app-update.yml');
      await fs.writeFile(config, JSON.stringify({ provider: 'generic', url: feed, updaterCacheDirName: 'cache' }));
      const adapter = { version: '0.0.0', name: 'Zvonok staging', isPackaged: true, appUpdateConfigPath: config, userDataPath: profile, baseCachePath: profile, whenReady: async () => {}, onQuit: () => {}, quit: () => assert.fail('staging must not quit'), relaunch: () => assert.fail('staging must not relaunch') };
      const updater = new NsisUpdater({ provider: 'generic', url: feed }, adapter);
      updater.logger = null; updater.autoDownload = false; updater.autoInstallOnAppQuit = false;
      updater.disableDifferentialDownload = true; updater.disableWebInstaller = true; updater.allowDowngrade = false;
      const executor = new NodeHttpExecutor();
      const createRequest = executor.createRequest.bind(executor);
      executor.createRequest = (options, callback) => createRequest({ ...options, agent: false }, callback);
      executor.download = (url, destination, options) => options.cancellationToken.createPromise((resolve, reject, onCancel) => {
        executor.doDownload(configureRequestOptionsFromUrl(url.href, {}), { destination, options, onCancel, responseHandler: null, callback: error => error ? reject(error) : resolve() }, 0);
      });
      updater.httpExecutor = executor;
      updater.setFeedURL({ provider: 'generic', url: feed });
      const events = [];
      for (const event of ['update-available', 'update-not-available', 'download-progress', 'update-downloaded', 'error']) updater.on(event, () => events.push(event));
      let error;
      try {
        const result = await updater.checkForUpdates();
        if (mode === 'available' || mode === 'bad-hash' || mode === 'interrupted') await updater.downloadUpdate(result.cancellationToken);
      } catch (e) { error = e.code || e.name; console.log({ mode, error, message: e.message }); }
      if (mode === 'available') { assert(events.includes('update-available')); assert(events.includes('download-progress')); assert(events.includes('update-downloaded')); assert(!error); }
      else if (mode === 'current' || mode === 'downgrade') { assert(events.includes('update-not-available')); assert(!events.includes('update-downloaded')); }
      else { assert(error, `${mode} must fail closed`); assert(!events.includes('update-downloaded')); }
      results.push({ mode, status: 'PASS', events, error, scope: 'real updater + loopback feed; synthetic non-executable payload; no native app/install/signature acceptance' });
      if (mode === 'available') {
        const cached = new NsisUpdater({ provider: 'generic', url: feed }, adapter);
        cached.logger = null; cached.autoDownload = false; cached.autoInstallOnAppQuit = false;
        cached.disableDifferentialDownload = true; cached.disableWebInstaller = true; cached.httpExecutor = executor;
        cached.setFeedURL({ provider: 'generic', url: feed }); cached.on('error', () => {});
        const requests = artifactRequests;
        await cached.checkForUpdates(); const files = await cached.downloadUpdate();
        assert.equal(artifactRequests, requests, 'Validated prepared cache must be reused by updater');
        results.push({ mode: 'prepared-cache', status: 'PASS', scope: 'new NsisUpdater instance, real cache validation, no executable/signature/install acceptance' });
        await fs.writeFile(files[0], 'corrupted prepared payload');
        mode = 'broken-download';
        const invalid = new NsisUpdater({ provider: 'generic', url: feed }, adapter);
        invalid.logger = null; invalid.autoDownload = false; invalid.autoInstallOnAppQuit = false;
        invalid.disableDifferentialDownload = true; invalid.disableWebInstaller = true; invalid.httpExecutor = executor;
        invalid.setFeedURL({ provider: 'generic', url: feed }); invalid.on('error', () => {});
        await invalid.checkForUpdates();
        await assert.rejects(invalid.downloadUpdate());
        assert(artifactRequests > requests, 'Corrupt cache must not be accepted as ready');
        results.push({ mode: 'corrupt-cache-download-failure', status: 'PASS', scope: 'real hash rejection and failed replacement download, no installer executed' });
      }
    }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.table(results.map(({ mode, status, error }) => ({ mode, status, error })));
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
