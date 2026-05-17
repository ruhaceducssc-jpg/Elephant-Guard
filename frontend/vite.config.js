import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd']
  },
  resolve: {
    alias: {
      '@tensorflow/tfjs': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs/dist/tf.js')
    }
  }
})
