import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
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
