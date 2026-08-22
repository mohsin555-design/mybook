import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['pwa-192.svg', 'pwa-512.svg', 'pwa-maskable.svg'],
    manifest: {
      name: 'MyBook',
      short_name: 'MyBook',
      description: 'MyBook file and document workspace',
      theme_color: '#f7f4ee',
      background_color: '#f7f4ee',
      display: 'standalone',
      icons: [
        { src: '/pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
        { src: '/pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
        { src: '/pwa-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    workbox: {
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api\//],
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      runtimeCaching: [
        { urlPattern: /^https:\/\/www\.googleapis\.com\/drive\//, handler: 'NetworkOnly' },
        { urlPattern: /^https:\/\/accounts\.google\.com\//, handler: 'NetworkOnly' },
      ],
    },
  })],
})
