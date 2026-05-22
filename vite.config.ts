import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import cloudIDEReactRefresh from '@coze-arch/vite-plugin-react-refresh-cloudide';
import path from "path";

function getPlugins() {
  const plugins = [cloudIDEReactRefresh(), react(), tsconfigPaths()];
  return plugins;
}

export default defineConfig({
  plugins: getPlugins(),
  server: {
    port: 5001,
    strictPort: true,
    host: '0.0.0.0',
    hmr: {
      overlay: true,
      path: '/hot/vite-hmr',
      port: 6000,
      clientPort: 443,
      timeout: 30000,
    },
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  cacheDir: path.resolve(__dirname, './node_modules/.vite'),
});
