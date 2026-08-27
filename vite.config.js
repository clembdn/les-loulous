import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Clément & Lise',
        short_name: 'C&L',
        description: 'Notre espace à deux — cuisine, budget et séances',
        lang: 'fr',
        theme_color: '#0B0E13',
        background_color: '#0B0E13',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Fonts auto-hébergées → précachées comme le reste, plus besoin de runtime caching.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Tesseract pèse ~6 Mo : hors de question de l'imposer à l'installation
        // à quelqu'un qui ne scannera jamais d'étiquette. Il est mis en cache
        // au premier usage (voir runtimeCaching), pas avant.
        globIgnores: ['**/tesseract/**'],
        navigateFallback: '/index.html',
        // Le service worker ne doit pas intercepter les requêtes du worker OCR
        // vers ses propres fichiers autrement que par la règle ci-dessous.
        navigateFallbackDenylist: [/^\/tesseract\//],
        runtimeCaching: [
          {
            // Une fois téléchargé, le moteur reste disponible hors-ligne — c'est
            // le cas qui compte : scanner une étiquette dans un magasin sans réseau.
            urlPattern: ({ url }) => url.pathname.startsWith('/tesseract/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ocr-tesseract',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')
          if (!normalizedId.includes('node_modules')) return
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/react-router-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) return 'react-vendor'
          if (
            normalizedId.includes('/node_modules/firebase/') ||
            normalizedId.includes('/node_modules/@firebase/')
          ) return 'firebase'
          if (normalizedId.includes('/node_modules/lucide-react/')) return 'icons'
        },
      },
    },
  },

  server: { host: true, port: 5173 },
})
