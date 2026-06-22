import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { spawn } from 'node:child_process'

const backendProcessKey = Symbol.for('lankaBeacon.backendProcess')

const isBackendHealthy = async () => {
  try {
    const response = await fetch('http://127.0.0.1:5000/api/health', {
      signal: AbortSignal.timeout(1000),
    })
    const payload = await response.json()
    return response.ok && payload?.databaseConnected === true
  } catch {
    return false
  }
}

const ensureBackendPlugin = () => ({
  name: 'lanka-beacon-backend',
  apply: 'serve',
  async configureServer() {
    const currentProcess = globalThis[backendProcessKey]

    if (currentProcess && currentProcess.exitCode === null) {
      return
    }

    if (await isBackendHealthy()) {
      return
    }

    const backendProcess = spawn(process.execPath, ['src/server.js'], {
      cwd: path.resolve(__dirname, '../backend'),
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    })

    globalThis[backendProcessKey] = backendProcess

    backendProcess.on('exit', (code) => {
      if (globalThis[backendProcessKey] === backendProcess) {
        globalThis[backendProcessKey] = null
      }

      if (code && code !== 0) {
        console.error(`[LankaBeacon] Backend stopped with exit code ${code}`)
      }
    })

    if (!globalThis.__lankaBeaconBackendCleanupRegistered) {
      globalThis.__lankaBeaconBackendCleanupRegistered = true
      process.once('exit', () => {
        const child = globalThis[backendProcessKey]
        if (child && child.exitCode === null) {
          child.kill()
        }
      })
    }

    console.log('[LankaBeacon] Starting backend on http://localhost:5000')
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), ensureBackendPlugin()],
  optimizeDeps: {
    include: ['@tensorflow/tfjs', '@tensorflow-models/coco-ssd']
  },
  resolve: {
    alias: {
      '@tensorflow/tfjs': path.resolve(__dirname, 'node_modules/@tensorflow/tfjs/dist/tf.js')
    }
  }
})
