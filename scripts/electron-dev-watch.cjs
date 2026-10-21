const { spawn } = require('node:child_process');
const { watch } = require('node:fs');
const path = require('node:path');
let desktop, building = false, queued = false, timer, stopping = false;
console.warn('Explicit main/preload watch mode: changes restart Electron and end active test calls. Use dev:desktop to keep main stable.');
async function rebuild() {
  if (stopping) return;
  if (building) { queued = true; return; }
  building = true;
  const compiler = spawn(process.execPath, [path.resolve('node_modules/typescript/bin/tsc'), '-p', 'electron/tsconfig.json'], { stdio: 'inherit', windowsHide: true });
  const code = await new Promise(resolve => compiler.on('exit', resolve));
  if (code === 0 && !stopping) {
    if (desktop && desktop.exitCode === null) { desktop.kill(); await new Promise(resolve => desktop.once('exit', resolve)); }
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    desktop = spawn(require('electron'), ['.'], { env, stdio: 'inherit', windowsHide: true });
    desktop.on('error', error => console.error(error.message));
  }
  building = false;
  if (queued) { queued = false; void rebuild(); }
}
const watcher = watch('electron', (_event, file) => {
  if (!file || !/\.(ts|cts|js|css|html|json)$/.test(file)) return;
  clearTimeout(timer); timer = setTimeout(() => void rebuild(), 300);
});
function stop() { stopping = true; watcher.close(); clearTimeout(timer); desktop?.kill(); }
process.once('SIGINT', stop); process.once('SIGTERM', stop);
void rebuild();
