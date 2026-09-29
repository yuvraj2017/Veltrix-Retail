import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Route chunks are created by React.lazy in src/app/router.tsx. These
    // manual groups keep the long-lived library code in its own files so a
    // change to application code does not invalidate the vendor cache.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-motion': ['framer-motion'],
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
    // Raise the warning threshold only after splitting, so it still flags
    // genuine regressions rather than firing on the known-large main bundle.
    chunkSizeWarningLimit: 600,
  },
})
