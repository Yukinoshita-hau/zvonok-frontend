import { defineConfig } from 'vite';
import base from '../vite.config';
const headers = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
const proxy = { '/api': { target: 'http://127.0.0.1:18081', ws: true, changeOrigin: true,
  configure(proxy: import('vite').HttpProxy.ProxyServer) { proxy.on('proxyReq', req => req.setHeader('Origin', 'http://localhost:3001')); } } };
export default defineConfig({ ...base,
  server: { port: 3001, strictPort: true, headers, proxy },
  preview: { port: 3001, strictPort: true, headers, proxy }
});
