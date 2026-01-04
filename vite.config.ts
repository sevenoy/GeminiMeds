import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: '/GeminiMeds/',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        minify: 'esbuild',
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom'],
                    'supabase-vendor': ['@supabase/supabase-js'],
                    'dexie-vendor': ['dexie']
                }
            }
        }
    },
    server: {
        port: 3000,
        open: true
    }
})
