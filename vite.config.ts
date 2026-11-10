import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base:
    process.env.GITHUB_PAGES === 'true' || process.env.GITHUB_ACTIONS === 'true'
      ? '/overseas-stock-tax-helper/'
      : './',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'zustand', 'lucide-react'],
          'vendor-pdf': ['pdfjs-dist', 'pdf-lib'],
          'vendor-ocr': ['tesseract.js'],
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },
});
