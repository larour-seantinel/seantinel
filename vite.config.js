import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        haig: resolve(__dirname, 'haig.html'),
        hermosa: resolve(__dirname, 'hermosa.html'),
        dev: resolve(__dirname, 'dev.html')
      }
    }
  }
});
