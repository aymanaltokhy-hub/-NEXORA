import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
// The Vite entry lives in /app so the repository root can hold the published (built) site for GitHub Pages.
export default defineConfig(({ mode }) => ({
  root: path.resolve(__dirname, 'app'), publicDir: path.resolve(__dirname, 'public'), base: './',
  build: { outDir: path.resolve(__dirname, mode === 'web' ? 'dist-web' : 'dist'), emptyOutDir: true },
  plugins: [react()], server: { host: '127.0.0.1', port: 5173, strictPort: true, fs: { allow: [__dirname] } }
}))
