import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // относительные пути: сайт работает и в корне домена, и в подпапке GitHub Pages (/repo/)
  base: './',
  server: { port: 5192, strictPort: true },
  preview: { port: 5193, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1700,
  },
})
