import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'bundle.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'output.css';
          return '[name].[ext]';
        },
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
});
