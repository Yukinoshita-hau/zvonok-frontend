import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_BROWSER_ACTIVITY': JSON.stringify('true'),
    'import.meta.env.VITE_API_URL': JSON.stringify('/api'),
    'import.meta.env.VITE_WS_URL': JSON.stringify('ws://127.0.0.1:18080/api/ws-raw'),
  },
  server: { host: '127.0.0.1', port: 3018, strictPort: true, proxy: { '/api': 'http://127.0.0.1:18080' } },
  build: { outDir: 'artifacts/stages/work/browser-activity-20261021/acceptance-dist', emptyOutDir: false },
  preview: { host: '127.0.0.1', port: 3018, strictPort: true, proxy: { '/api': 'http://127.0.0.1:18080' } },
});
