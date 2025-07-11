import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'ExpandableBlocks',
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      external: ['vue', '@directus/extensions-sdk'],
      output: {
        globals: {
          vue: 'Vue',
          '@directus/extensions-sdk': 'DirectusExtensionsSDK'
        }
      }
    }
  }
});