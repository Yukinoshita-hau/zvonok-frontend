import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function developmentOptions(args) {
  if (args.some(arg => !['--hmr', '--watch-main'].includes(arg))) throw new Error('Unknown Electron development option');
  return { hmr: args.includes('--hmr'), watchMain: args.includes('--watch-main') };
}
async function main() {
  const options = developmentOptions(process.argv.slice(2));
  console.log(options.hmr ? 'Renderer HMR explicitly enabled: owner module changes can interrupt test calls.' : 'Stable desktop development: renderer reloads are manual. Use dev:desktop:hmr for test-call HMR.');
  if (options.watchMain) console.warn('Main/preload watch explicitly enabled: every restart ends active test media.');
  const server = await createServer({ cacheDir: 'node_modules/.vite-desktop', server: { host: '127.0.0.1', port: 3000, strictPort: true, hmr: options.hmr } });
  await server.listen();
  let child;
  const stop = async () => { child?.kill(); await server.close(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    const env = { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:3000' }; delete env.ELECTRON_RUN_AS_NODE;
    if (options.watchMain) child = spawn(process.execPath, ['scripts/electron-dev-watch.cjs'], { env, stdio: 'inherit', windowsHide: true });
    else {
      const compiler = spawn(process.execPath, [path.resolve('node_modules/typescript/bin/tsc'), '-p', 'electron/tsconfig.json'], { stdio: 'inherit', windowsHide: true });
      const code = await new Promise((resolve, reject) => { compiler.once('exit', resolve); compiler.once('error', reject); });
      if (code !== 0) throw new Error('Electron compilation failed');
      child = spawn(createRequire(import.meta.url)('electron'), ['.'], { env, stdio: 'inherit', windowsHide: true });
    }
    const code = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
    process.exitCode = code ?? 0;
  } finally { await stop(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
