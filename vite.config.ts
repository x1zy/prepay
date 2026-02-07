import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vite.dev/config/
export default defineConfig({
  base: '/prepay/',
  plugins: [
    nodePolyfills(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    })
  ],
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api/bicycle': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bicycle/, ''),
      },
    },
    // В development режиме файлы из public доступны по корневому пути
    // независимо от base path
    fs: {
      strict: false,
    },
    // Middleware для правильной отдачи mockServiceWorker.js
    middlewareMode: false,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  // Настройка для правильной обработки статических файлов
  publicDir: 'public',
})