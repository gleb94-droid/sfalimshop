import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split vendor libs to separate chunks so the app code stays small
        // and vendor bundles stay cached across deploys (they change rarely).
        manualChunks: {
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
    // App is one big file (per CLAUDE.md); bumping the limit silences the warning.
    chunkSizeWarningLimit: 700,
  },
})
