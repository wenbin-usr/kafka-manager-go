import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 构建产物输出到 web/dist，供 Go embed 或本地静态服务使用
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:18855',
        changeOrigin: true,
      },
    },
  },
});
