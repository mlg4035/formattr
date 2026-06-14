import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/toolerbox/youtube-transcript': {
        target: 'https://toolerbox.com',
        changeOrigin: true,
        rewrite: () => '/api/v1/youtube-transcript',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const apiKeyHeader = req.headers['x-toolerbox-api-key']
            const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader
            if (apiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`)
            }
            proxyReq.removeHeader('x-toolerbox-api-key')
          })
        },
      },
    },
  },
})
