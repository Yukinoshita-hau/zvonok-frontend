import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5197, strictPort: true, open: '/scripts/spaces-preview/index.html' },
  build: { outDir: 'artifacts/stages/spaces-design/build', rollupOptions: { input: 'scripts/spaces-preview/index.html' } },
});
