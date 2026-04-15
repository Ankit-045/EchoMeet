import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        // Absorb WS proxy errors so HTTP proxy (/api) stays alive
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('[vite-proxy] socket.io error (non-fatal):', err.message);
          });
          proxy.on('proxyReqWs', (_proxyReq, _req, _socket) => {
            _socket.on('error', (err) => {
              console.log('[vite-proxy] ws socket error:', err.message);
            });
          });
        },
      },
    },
  },
});
