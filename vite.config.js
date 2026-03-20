import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Needed for Docker
    proxy: {
      '/api/generate': {
        target: process.env.VITE_OLLAMA_TARGET || 'http://127.0.0.1:11434',
        changeOrigin: true,
      },
      '/v1': {
        target: process.env.VITE_CHATTERBOX_TARGET || 'http://127.0.0.1:4123',
        changeOrigin: true,
      }
    }
  }
})
