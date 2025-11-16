// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

  return {
    plugins: [react()],
    server: {
      host: true,         // listen on 0.0.0.0 for LAN/devcontainers
      port: 5173,
      watch: {
        // avoid noisy restarts when editing .env
        ignored: ['**/.env'],
      },
      proxy: {
        // Flask/FastAPI/whatever backend
        '/api': {
          target: backend,
          changeOrigin: true,
        },
        // Socket.IO (keep path '/socket.io' exactly)
        '/socket.io': {
          target: backend,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@erp': path.resolve(__dirname, './src/modules/erp'),
      },
    },
    optimizeDeps: {
      // lucide-react can be ESM-quirky in optimize step
      exclude: ['lucide-react'],
    },
    define: {
      // some libs expect process.env to exist in browser
      'process.env': {},
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
