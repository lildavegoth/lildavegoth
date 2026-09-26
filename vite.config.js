import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util', 'events', 'path', 'crypto'],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    })
  ],
  build: {
    outDir: 'dist-kiraku',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'kiraku-storage': resolve(__dirname, 'pages/kiraku-storage.html')
      }
    }
  }
})
