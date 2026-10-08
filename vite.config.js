import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// En dev, sert les fonctions Vercel de `api/` comme en production : même
// fichier, même signature Node `(req, res)`. Rechargées à chaque requête
// (ssrLoadModule) : on les modifie sans redémarrer, et `npm run dev` suffit,
// sans CLI Vercel ni compte.
function vercelApiDev() {
  return {
    name: 'vercel-api-dev',
    configureServer(server) {
      // Les secrets des fonctions (ORS_API_KEY) se lisent dans .env, comme
      // Vercel les lit dans ses variables. Sans préfixe VITE_ : jamais envoyés au navigateur.
      const env = loadEnv(server.config.mode, process.cwd(), '')
      if (env.ORS_API_KEY && !process.env.ORS_API_KEY) process.env.ORS_API_KEY = env.ORS_API_KEY
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([\w-]+)(?:\?|$)/)
        if (!match) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.js`)
          await mod.default(req, res)
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    vercelApiDev(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-96x96.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Loulous',
        short_name: 'Loulous',
        description: 'Notre espace à deux — cuisine, budget, séances et voyages',
        lang: 'fr',
        theme_color: '#0B0E13',
        background_color: '#0B0E13',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        // Android : Loulous apparaît dans « Partager » de Google Maps (PWA
        // installée). Le lieu arrive sur /trip/partage, à ranger dans un jour.
        share_target: {
          action: '/trip/partage',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Fonts auto-hébergées → précachées comme le reste, plus besoin de runtime caching.
        // `json` : le style des cartes de Trip Planner (public/trip-map/style.json),
        // pour qu'une carte se dessine sans réseau.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,json}'],
        // Tesseract pèse ~6 Mo : hors de question de l'imposer à l'installation
        // à quelqu'un qui ne scannera jamais d'étiquette. Il est mis en cache
        // au premier usage (voir runtimeCaching), pas avant.
        globIgnores: ['**/tesseract/**'],
        navigateFallback: '/index.html',
        // Le service worker ne doit pas intercepter les requêtes du worker OCR
        // vers ses propres fichiers autrement que par la règle ci-dessous.
        // Ni répondre l'app à la place d'une fonction serveur ouverte à la main.
        navigateFallbackDenylist: [/^\/tesseract\//, /^\/api\//],
        runtimeCaching: [
          {
            // Trip Planner · le TileJSON d'OpenFreeMap donne l'adresse (versionnée)
            // des tuiles. Réseau d'abord pour suivre les mises à jour ; hors-ligne,
            // la copie en cache pointe vers les tuiles déjà téléchargées.
            urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org' && url.pathname === '/planet',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'trip-map-meta',
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Tuiles, polices et pictogrammes des cartes : une tuile ne change
            // pas sous une même adresse. Préchargées avant le départ
            // (src/apps/trip/services/mapTiles.js), dans ce même cache.
            urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'trip-map-tiles',
              expiration: { maxEntries: 8000, maxAgeSeconds: 60 * 60 * 24 * 120 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
    // MapLibre (~1 050 Ko, 285 Ko gzip) est un chunk à part, chargé seulement
    // à l'affichage d'une carte de Trip Planner : pas d'alerte pour lui.
    chunkSizeWarningLimit: 1100,
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
