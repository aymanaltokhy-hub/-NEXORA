import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig(({ mode }) => ({ base: './', build: { outDir: mode === 'web' ? 'dist-web' : 'dist' }, plugins: [react()], server: { host: '127.0.0.1', port: 5173, strictPort: true } }))
