import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/ta/v1': {
        target: 'http://127.0.0.1:4520',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ta\/v1/, '/api/tenant-admin/v1'),
      },
      '/api/op/v1': {
        target: 'http://127.0.0.1:4510',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/op\/v1/, '/api/control-plane-admin/v1'),
      },
    },
  },
});
