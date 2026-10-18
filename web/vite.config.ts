import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/transcriptapi': {
        target: 'https://transcriptapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/transcriptapi/, '/api/v2'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const apiKeyHeader = req.headers['x-transcriptapi-api-key']
            const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader
            if (apiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`)
            }
            proxyReq.removeHeader('x-transcriptapi-api-key')
          })
        },
      },
    },
  },
})
