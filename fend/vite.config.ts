import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@views': path.resolve(__dirname, './src/views'),
      '@components': path.resolve(__dirname, './src/components'),
      '@composables': path.resolve(__dirname, './src/composables'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@api': path.resolve(__dirname, './src/api'),
      // The hidden engine - looks like CSS internals
      '@styles': path.resolve(__dirname, './src/styles'),
      '@viewport': path.resolve(__dirname, './src/viewport'),
    },
  },
  server: {
    port: 3003,
    proxy: {
      '/api/trpc': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/trpc/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log(`[PROXY] ${req.method} ${req.url} -> ${proxyReq.path}`)
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log(`[PROXY] ${req.method} ${req.url} <- ${proxyRes.statusCode}`)
          })
          proxy.on('error', (err, req) => {
            console.error(`[PROXY ERROR] ${req.method} ${req.url}:`, err.message)
          })
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
