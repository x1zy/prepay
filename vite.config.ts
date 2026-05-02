import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
  base: "/prepay/",
  plugins: [
    nodePolyfills(), // Add this as a separate plugin
    react({
      babel: {
        plugins: [], // Keep this empty or add Babel plugins here (not Vite plugins)
      },
    }),
  ],
  server: {
    port: 5174,
    host: true,
    allowedHosts: ["grubbily-acclamatory-kai.ngrok-free.dev"],
    proxy: {
      // "/api/bicycle": {
      //   target: "http://localhost:8081",
      //   changeOrigin: true,
      //   rewrite: (path) => path.replace(/^\/api\/bicycle/, ""),
      // },
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
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
    outDir: "dist",
    assetsDir: "assets",
  },
  // Настройка для правильной обработки статических файлов
  publicDir: "public",
});
