import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

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
    target: 'esnext'
  }
})
