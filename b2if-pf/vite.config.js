import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// Plugin para copiar o worker do PDF.js para o dist a cada build
function copyPdfWorker() {
  return {
    name: 'copy-pdf-worker',
    buildStart() {
      try {
        const src = resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
        const dest = resolve('public/pdf.worker.min.mjs')
        copyFileSync(src, dest)
      } catch (e) {
        console.warn('Aviso: não foi possível copiar pdf.worker.min.mjs:', e.message)
      }
    }
  }
}

export default defineConfig({
  plugins: [react(), copyPdfWorker()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
})
