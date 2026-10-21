import { createServer } from 'vite';
const server = await createServer({
  cacheDir: 'artifacts/stages/electron-e6/vite-cache',
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:18086/api'), 'import.meta.env.VITE_WS_URL': JSON.stringify('ws://127.0.0.1:18086/api/ws-raw') },
  server: { host: '127.0.0.1', port: 3038, strictPort: true, hmr: false, watch: { ignored: ['**/artifacts/**'] } },
});
await server.listen();
console.log('E6 UI: 3038; isolated Core: 18086');
