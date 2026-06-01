# MVP « Liste de courses » — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire l'app « Liste de courses » (projet 2) : une liste partagée unique, temps réel, sans friction, avec rayons auto-classés, catalogue léger (fréquents/favoris), mode magasin, et rendre la plateforme installable (PWA).

**Architecture:** Nouvelle app autonome `src/apps/courses/` (lazy-loaded), thème clair/vert via `useAppTheme('light','emerald')`. Données Firestore sous `couples/main/{shoppingItems,shoppingCatalog}`, services `subscribe/add/update/delete` temps réel (`onSnapshot`) sur le modèle de `transactionService.js`, hook central `useCoursesData`. UI en tokens (Button/Input/Badge token-based réutilisés) + un petit `Sheet` token-based local (le `sheet.jsx` partagé est sombre, inadapté au thème clair).

**Tech Stack:** Vite 6, React 18, react-router-dom 7, Firebase Firestore, Tailwind (tokens CSS), `@radix-ui/react-dialog`, lucide-react, `vite-plugin-pwa`.

**Vérification :** pas de tests automatisés (cohérent avec les specs précédentes). Chaque tâche finit par un `npm run build` vert ; le smoke test manuel complet (lancé par Clément avec `! …`) intervient à la Task 7 (intégration) puis Tasks 8.

**Note de séquencement :** le projet est en JavaScript (pas de typecheck). Les composants présentables des Tasks 4–6 ne sont branchés dans le graphe d'imports qu'à la Task 7 (ListView) — c'est là que le build les valide réellement et que le smoke test de bout en bout a lieu.

---

## Structure des fichiers (cible)

```
src/apps/courses/
├─ CoursesApp.jsx                 # NOUVEAU : useAppTheme('light','emerald') + <ListView/>
├─ config/aisles.js               # NOUVEAU : rayons (preset ordonné) + dico mots-clés
├─ utils/aisleGuess.js            # NOUVEAU : normalizeName, slugify, guessAisle
├─ utils/grouping.js              # NOUVEAU : groupByAisle
├─ services/shoppingItemsService.js  # NOUVEAU : CRUD items + check + clear (batch)
├─ services/catalogService.js     # NOUVEAU : upsert usage, favoris, rayon mémorisé
├─ hooks/useCoursesData.js        # NOUVEAU : abonnements items + catalogue
├─ views/ListView.jsx             # NOUVEAU : orchestrateur (header, liste, mode magasin)
└─ components/
   ├─ Sheet.jsx                   # NOUVEAU : bottom-sheet token-based (Radix dialog)
   ├─ ItemRow.jsx                 # NOUVEAU
   ├─ AisleSection.jsx            # NOUVEAU
   ├─ CheckedZone.jsx             # NOUVEAU
   ├─ QuickAddBar.jsx             # NOUVEAU
   ├─ ItemEditSheet.jsx           # NOUVEAU
   ├─ ConfirmDialog.jsx           # NOUVEAU
   ├─ StoreModeView.jsx           # NOUVEAU
   └─ FavoritesSheet.jsx          # NOUVEAU

Modifiés : vite.config.js, index.html, firestore.rules, src/App.jsx,
src/platform/apps.config.js, package.json, README.md. Nouveau : pwa-assets.config.js.
```

---

## Task 1 : PWA installable (plateforme entière)

**Files:**
- Modify: `package.json` (via npm)
- Create: `pwa-assets.config.js`
- Modify: `vite.config.js`
- Modify: `index.html`
- Generated (public/): `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, etc.

- [ ] **Step 1 : Installer vite-plugin-pwa + générateur d'icônes**

Run: `npm install -D vite-plugin-pwa @vite-pwa/assets-generator`
Expected: ajout dans `devDependencies`, pas d'erreur.

- [ ] **Step 2 : Créer `pwa-assets.config.js`**

```js
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
})
```

- [ ] **Step 3 : Générer les icônes depuis le favicon**

Run: `npx pwa-assets-generator`
Expected: génère dans `public/` notamment `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`,
`maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`. (Source vectorielle → mise à l'échelle propre.)

- [ ] **Step 4 : Réécrire `vite.config.js` (ajout du plugin PWA)**

```js
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
        description: 'Notre espace à deux — courses & budget',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
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
          if (
            normalizedId.includes('/node_modules/recharts/') ||
            normalizedId.includes('/node_modules/d3-') ||
            normalizedId.includes('/node_modules/victory-vendor/')
          ) return 'charts'
          if (normalizedId.includes('/node_modules/lucide-react/')) return 'icons'
        },
      },
    },
  },

  server: { host: true, port: 5173 },
})
```

- [ ] **Step 5 : Ajouter le lien apple-touch-icon dans `index.html`**

Dans `<head>`, juste après la ligne `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`, ajouter :

```html
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 6 : Build + vérifier les artefacts PWA**

Run: `npm run build`
Expected: `✓ built in …`. Vérifier la présence de `dist/manifest.webmanifest`, `dist/sw.js`,
`dist/registerSW.js` et des icônes `dist/pwa-192x192.png` / `dist/pwa-512x512.png`.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "feat(pwa): make platform installable (manifest, icons, service worker)"
```

---

## Task 2 : Couche données Courses (config, utils, services, hook)

**Files:**
- Create: `src/apps/courses/config/aisles.js`
- Create: `src/apps/courses/utils/aisleGuess.js`
- Create: `src/apps/courses/utils/grouping.js`
- Create: `src/apps/courses/services/shoppingItemsService.js`
- Create: `src/apps/courses/services/catalogService.js`
- Create: `src/apps/courses/hooks/useCoursesData.js`

- [ ] **Step 1 : Créer `src/apps/courses/config/aisles.js`**

```js
import {
  Apple, Beef, Milk, Wheat, Cookie, Snowflake, CupSoda, Sparkles, Home, ShoppingBasket,
} from 'lucide-react'

// Rayons, ordonnés « comme on traverse le magasin ». Classes de couleur pré-bakées
// (littéraux scannés par Tailwind) pour les en-têtes de section.
export const AISLES = [
  { id: 'fruits-legumes', label: 'Fruits & légumes',           icon: Apple,          colorClass: 'text-green-600',  order: 1 },
  { id: 'boucherie',      label: 'Boucherie / poissonnerie',   icon: Beef,           colorClass: 'text-rose-600',   order: 2 },
  { id: 'cremerie',       label: 'Crémerie / frais',           icon: Milk,           colorClass: 'text-sky-600',    order: 3 },
  { id: 'epicerie-salee', label: 'Épicerie salée',             icon: Wheat,          colorClass: 'text-amber-600',  order: 4 },
  { id: 'epicerie-sucree',label: 'Épicerie sucrée / petit-déj',icon: Cookie,         colorClass: 'text-orange-600', order: 5 },
  { id: 'surgeles',       label: 'Surgelés',                   icon: Snowflake,      colorClass: 'text-cyan-600',   order: 6 },
  { id: 'boissons',       label: 'Boissons',                   icon: CupSoda,        colorClass: 'text-indigo-600', order: 7 },
  { id: 'hygiene',        label: 'Hygiène & beauté',           icon: Sparkles,       colorClass: 'text-pink-600',   order: 8 },
  { id: 'maison',         label: 'Maison & entretien',         icon: Home,           colorClass: 'text-teal-600',   order: 9 },
  { id: 'autres',         label: 'Autres',                     icon: ShoppingBasket, colorClass: 'text-slate-500',  order: 99 },
]

export const AISLE_BY_ID = Object.fromEntries(AISLES.map((a) => [a.id, a]))
export const DEFAULT_AISLE = 'autres'

export function getAisle(id) {
  return AISLE_BY_ID[id] || AISLE_BY_ID[DEFAULT_AISLE]
}

// Dictionnaire mots-clés → rayon. Les mots sont normalisés à l'exécution (cf. aisleGuess).
export const AISLE_KEYWORDS = [
  { aisle: 'fruits-legumes', words: ['pomme', 'banane', 'tomate', 'salade', 'carotte', 'courgette', 'oignon', 'ail', 'citron', 'fraise', 'poire', 'patate', 'pomme de terre', 'legume', 'fruit', 'avocat', 'concombre', 'poivron', 'champignon', 'epinard', 'brocoli', 'raisin', 'clementine'] },
  { aisle: 'boucherie',      words: ['poulet', 'boeuf', 'steak', 'poisson', 'saumon', 'jambon', 'viande', 'dinde', 'porc', 'lardon', 'saucisse', 'escalope', 'thon', 'crevette', 'merguez', 'hache'] },
  { aisle: 'cremerie',       words: ['lait', 'beurre', 'oeuf', 'yaourt', 'fromage', 'creme', 'parmesan', 'mozzarella', 'emmental', 'comte', 'skyr', 'feta'] },
  { aisle: 'epicerie-salee', words: ['pates', 'riz', 'conserve', 'huile', 'sel', 'poivre', 'farine', 'sauce', 'lentille', 'haricot', 'pois chiche', 'semoule', 'quinoa', 'vinaigre', 'moutarde', 'bouillon', 'epice'] },
  { aisle: 'epicerie-sucree',words: ['cafe', 'the', 'cereale', 'biscuit', 'chocolat', 'sucre', 'confiture', 'miel', 'nutella', 'gateau', 'madeleine', 'compote'] },
  { aisle: 'surgeles',       words: ['surgele', 'glace', 'frites', 'poelee', 'pizza'] },
  { aisle: 'boissons',       words: ['eau', 'jus', 'soda', 'biere', 'vin', 'coca', 'limonade', 'sirop', 'boisson'] },
  { aisle: 'hygiene',        words: ['savon', 'shampoing', 'dentifrice', 'gel douche', 'deodorant', 'coton', 'rasoir', 'brosse', 'papier toilette', 'mouchoir', 'tampon'] },
  { aisle: 'maison',         words: ['lessive', 'eponge', 'sac poubelle', 'liquide vaisselle', 'nettoyant', 'essuie-tout', 'sopalin', 'ampoule', 'pile'] },
]
```

- [ ] **Step 2 : Créer `src/apps/courses/utils/aisleGuess.js`**

```js
import { AISLE_KEYWORDS, DEFAULT_AISLE } from '../config/aisles.js'

// Minuscules, accents retirés, espaces compactés.
export function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

// Identifiant déterministe pour le catalogue (dédoublonnage par nom).
export function slugify(name) {
  const base = normalizeName(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'item'
}

// Devine le rayon depuis le nom via le dictionnaire de mots-clés (premier match).
export function guessAisle(name) {
  const n = normalizeName(name)
  if (!n) return DEFAULT_AISLE
  for (const entry of AISLE_KEYWORDS) {
    for (const w of entry.words) {
      if (n.includes(w)) return entry.aisle
    }
  }
  return DEFAULT_AISLE
}
```

- [ ] **Step 3 : Créer `src/apps/courses/utils/grouping.js`**

```js
import { AISLES } from '../config/aisles.js'

// Regroupe les items par rayon, dans l'ordre du preset, rayons vides exclus.
export function groupByAisle(items) {
  const buckets = new Map(AISLES.map((a) => [a.id, []]))
  for (const it of items) {
    if (!buckets.has(it.aisle)) buckets.set('autres', buckets.get('autres') || [])
    ;(buckets.get(it.aisle) || buckets.get('autres')).push(it)
  }
  return AISLES
    .filter((a) => (buckets.get(a.id) || []).length > 0)
    .map((a) => ({ aisle: a, items: buckets.get(a.id) }))
}
```

- [ ] **Step 4 : Créer `src/apps/courses/services/shoppingItemsService.js`**

```js
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  getDocs, writeBatch, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { AISLE_BY_ID, DEFAULT_AISLE } from '../config/aisles.js'

const ITEMS_PATH = 'couples/main/shoppingItems'
function itemsCol() { return collection(db, ITEMS_PATH) }
function itemDoc(id) { return doc(db, ITEMS_PATH, id) }

function resolveAisle(raw) {
  return AISLE_BY_ID[raw] ? raw : DEFAULT_AISLE
}

function normalize(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    quantityLabel: raw.quantityLabel || null,
    aisle: resolveAisle(raw.aisle),
    checked: raw.checked === true,
    checkedBy: raw.checkedBy || null,
    checkedAt: raw.checkedAt || null,
    note: raw.note || null,
    createdAt: raw.createdAt,
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    updatedBy: raw.updatedBy,
  }
}

export function subscribeToItems(callback, onError) {
  const q = query(itemsCol(), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[Courses] items error:', err)
    onError?.(err)
  })
}

export async function addItem(input, currentUid) {
  const now = new Date().toISOString()
  const data = {
    name: String(input.name || '').trim(),
    quantityLabel: input.quantityLabel ? String(input.quantityLabel).trim() : null,
    aisle: resolveAisle(input.aisle),
    checked: false,
    checkedBy: null,
    checkedAt: null,
    note: input.note ? String(input.note).trim() : null,
    createdAt: now,
    createdBy: currentUid,
    updatedAt: now,
    updatedBy: currentUid,
  }
  const ref = await addDoc(itemsCol(), data)
  return ref.id
}

export async function updateItem(id, updates, currentUid) {
  const payload = { ...updates, updatedAt: new Date().toISOString(), updatedBy: currentUid }
  if (updates.name != null) payload.name = String(updates.name).trim()
  if (updates.aisle != null) payload.aisle = resolveAisle(updates.aisle)
  if ('quantityLabel' in updates) {
    payload.quantityLabel = updates.quantityLabel ? String(updates.quantityLabel).trim() : null
  }
  await updateDoc(itemDoc(id), payload)
}

export async function setItemChecked(item, checked, currentUid) {
  const now = new Date().toISOString()
  await updateDoc(itemDoc(item.id), {
    checked,
    checkedBy: checked ? currentUid : null,
    checkedAt: checked ? now : null,
    updatedAt: now,
    updatedBy: currentUid,
  })
}

export async function deleteItem(id) {
  await deleteDoc(itemDoc(id))
}

async function deleteWhere(predicate) {
  const snap = await getDocs(itemsCol())
  const batch = writeBatch(db)
  snap.docs.forEach((d) => {
    if (predicate({ id: d.id, ...d.data() })) batch.delete(d.ref)
  })
  await batch.commit()
}

// Supprime les articles cochés (fin de courses).
export function clearChecked() {
  return deleteWhere((it) => it.checked === true)
}

// Supprime tous les articles (le catalogue persiste).
export function clearAll() {
  return deleteWhere(() => true)
}
```

- [ ] **Step 5 : Créer `src/apps/courses/services/catalogService.js`**

```js
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc,
} from 'firebase/firestore'
import { db } from '@/shared/lib/firebase.js'
import { slugify, normalizeName } from '../utils/aisleGuess.js'
import { AISLE_BY_ID, DEFAULT_AISLE } from '../config/aisles.js'

const CATALOG_PATH = 'couples/main/shoppingCatalog'
function catalogCol() { return collection(db, CATALOG_PATH) }
function catalogDoc(slug) { return doc(db, CATALOG_PATH, slug) }

function resolveAisle(raw) {
  return AISLE_BY_ID[raw] ? raw : DEFAULT_AISLE
}

function normalize(raw) {
  return {
    id: raw.id,
    name: raw.name || '',
    nameLower: raw.nameLower || '',
    aisle: resolveAisle(raw.aisle),
    favorite: raw.favorite === true,
    useCount: Number(raw.useCount) || 0,
    lastUsedAt: raw.lastUsedAt || null,
  }
}

export function subscribeToCatalog(callback, onError) {
  return onSnapshot(catalogCol(), (snap) => {
    callback(snap.docs.map((d) => normalize({ id: d.id, ...d.data() })))
  }, (err) => {
    console.error('[Courses] catalog error:', err)
    onError?.(err)
  })
}

// Upsert appelé à chaque ajout : compte d'usage + rayon mémorisé.
// (createdBy n'est posé qu'à la création pour satisfaire les règles Firestore.)
export async function recordUsage(name, aisle, currentUid) {
  const slug = slugify(name)
  const ref = catalogDoc(slug)
  const now = new Date().toISOString()
  const snap = await getDoc(ref)
  if (snap.exists()) {
    const prev = snap.data()
    await updateDoc(ref, {
      name: String(name).trim(),
      nameLower: normalizeName(name),
      aisle: resolveAisle(aisle),
      useCount: (Number(prev.useCount) || 0) + 1,
      lastUsedAt: now,
      updatedAt: now,
      updatedBy: currentUid,
    })
  } else {
    await setDoc(ref, {
      name: String(name).trim(),
      nameLower: normalizeName(name),
      aisle: resolveAisle(aisle),
      favorite: false,
      useCount: 1,
      lastUsedAt: now,
      createdAt: now,
      createdBy: currentUid,
      updatedAt: now,
      updatedBy: currentUid,
    })
  }
  return slug
}

export async function toggleFavorite(entry, currentUid) {
  await updateDoc(catalogDoc(entry.id), {
    favorite: !entry.favorite,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

export async function setCatalogAisle(entry, aisle, currentUid) {
  await updateDoc(catalogDoc(entry.id), {
    aisle: resolveAisle(aisle),
    updatedAt: new Date().toISOString(),
    updatedBy: currentUid,
  })
}

export async function removeCatalogEntry(slug) {
  await deleteDoc(catalogDoc(slug))
}
```

- [ ] **Step 6 : Créer `src/apps/courses/hooks/useCoursesData.js`**

```js
import { useEffect, useState } from 'react'
import { subscribeToItems } from '../services/shoppingItemsService.js'
import { subscribeToCatalog } from '../services/catalogService.js'

export function useCoursesData() {
  const [items, setItems] = useState([])
  const [catalog, setCatalog] = useState([])
  const [itemsReady, setItemsReady] = useState(false)
  const [catalogReady, setCatalogReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubItems = subscribeToItems(
      (x) => { setItems(x); setItemsReady(true) },
      (err) => setError(err),
    )
    const unsubCatalog = subscribeToCatalog(
      (x) => { setCatalog(x); setCatalogReady(true) },
      (err) => setError(err),
    )
    return () => { unsubItems(); unsubCatalog() }
  }, [])

  return { items, catalog, isLoading: !itemsReady || !catalogReady, error }
}
```

- [ ] **Step 7 : Build (compilation des nouveaux modules par import indirect plus tard)**

Run: `npm run build`
Expected: `✓ built in …`. (Ces fichiers ne sont pas encore importés dans le graphe ; le build reste vert.)

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "feat(courses): data layer (aisles, services, catalog, hook)"
```

---

## Task 3 : Règles Firestore (shoppingItems + shoppingCatalog)

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1 : Ajouter les deux blocs de règles**

Dans `firestore.rules`, **avant** le bloc final `match /{document=**} { allow read, write: if false; }`,
insérer (les fonctions `isAuthorizedUser`, `isValidPersonUid`, `hasValidMetadata` existent déjà) :

```
    function hasValidShoppingItemShape(data) {
      return data.name is string
        && data.name.size() > 0
        && data.name.size() <= 120
        && data.aisle is string
        && data.checked is bool
        && (!('quantityLabel' in data) || data.quantityLabel == null || (data.quantityLabel is string && data.quantityLabel.size() <= 40))
        && (!('note' in data) || data.note == null || (data.note is string && data.note.size() <= 500));
    }

    // Shopping list items (shared single list)
    match /couples/main/shoppingItems/{itemId} {
      allow read: if isAuthorizedUser();

      allow create: if isAuthorizedUser()
        && hasValidShoppingItemShape(request.resource.data)
        && hasValidMetadata(request.resource.data)
        && request.resource.data.createdBy == request.auth.uid;

      allow update: if isAuthorizedUser()
        && hasValidShoppingItemShape(request.resource.data)
        && request.resource.data.updatedBy == request.auth.uid;

      allow delete: if isAuthorizedUser();
    }

    function hasValidCatalogShape(data) {
      return data.name is string
        && data.name.size() > 0
        && data.name.size() <= 120
        && data.nameLower is string
        && data.aisle is string
        && data.favorite is bool
        && data.useCount is number
        && data.useCount >= 0;
    }

    // Shopping catalog (known products: frequents/favorites/remembered aisle)
    match /couples/main/shoppingCatalog/{slug} {
      allow read: if isAuthorizedUser();

      allow create: if isAuthorizedUser()
        && hasValidCatalogShape(request.resource.data)
        && hasValidMetadata(request.resource.data)
        && request.resource.data.createdBy == request.auth.uid;

      allow update: if isAuthorizedUser()
        && hasValidCatalogShape(request.resource.data)
        && request.resource.data.updatedBy == request.auth.uid;

      allow delete: if isAuthorizedUser();
    }
```

- [ ] **Step 2 : Commit**

```bash
git add firestore.rules
git commit -m "feat(courses): firestore rules for shoppingItems and shoppingCatalog"
```

> ⚠️ **Étape manuelle (Clément)** : publier ces règles dans la console Firebase
> (Firestore › Rules › Publish) **avant** le smoke test de la Task 7, sinon toutes les
> écritures `shopping*` seront refusées.

---

## Task 4 : Sheet token-based + lignes & sections

**Files:**
- Create: `src/apps/courses/components/Sheet.jsx`
- Create: `src/apps/courses/components/ItemRow.jsx`
- Create: `src/apps/courses/components/AisleSection.jsx`
- Create: `src/apps/courses/components/CheckedZone.jsx`

- [ ] **Step 1 : Créer `src/apps/courses/components/Sheet.jsx`**

```jsx
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

// Bottom-sheet token-based (le sheet.jsx partagé est codé en dur sombre).
// Mobile : panneau bas ; desktop (sm+) : modale centrée.
export function Sheet({ open, onOpenChange, title, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed z-50 inset-x-0 bottom-0 max-h-[90vh] flex flex-col rounded-t-2xl border-t border-border bg-surface text-fg shadow-2xl
            data-[state=open]:animate-in data-[state=closed]:animate-out duration-300
            data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom
            sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <Dialog.Title className="text-base font-semibold text-fg">{title}</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-fg p-1 rounded-lg transition" aria-label="Fermer">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2 : Créer `src/apps/courses/components/ItemRow.jsx`**

```jsx
import { Check } from 'lucide-react'
import { getPerson } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'

export default function ItemRow({ item, onToggle, onEdit }) {
  const person = getPerson(item.createdBy)
  return (
    <div className="flex items-center gap-3 py-2.5">
      <button
        onClick={() => onToggle(item)}
        aria-label={item.checked ? 'Décocher' : 'Cocher'}
        className={cn(
          'h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition',
          item.checked
            ? 'bg-accent border-accent text-accent-fg'
            : 'border-border-strong text-transparent hover:border-accent',
        )}
      >
        <Check size={14} strokeWidth={3} />
      </button>
      <button onClick={() => onEdit(item)} className="flex-1 min-w-0 text-left">
        <span className={cn('text-[15px] text-fg', item.checked && 'line-through text-faint')}>
          {item.name}
        </span>
        {item.quantityLabel && <span className="ml-2 text-sm text-muted">{item.quantityLabel}</span>}
      </button>
      {person && (
        <span
          className={cn('h-2 w-2 rounded-full shrink-0', person.dotClass)}
          title={`Ajouté par ${person.label}`}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3 : Créer `src/apps/courses/components/AisleSection.jsx`**

```jsx
import ItemRow from './ItemRow.jsx'

export default function AisleSection({ aisle, items, onToggle, onEdit }) {
  const Icon = aisle.icon
  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={aisle.colorClass} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{aisle.label}</h3>
        <span className="text-xs text-faint">{items.length}</span>
      </div>
      <div className="divide-y divide-border">
        {items.map((it) => (
          <ItemRow key={it.id} item={it} onToggle={onToggle} onEdit={onEdit} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4 : Créer `src/apps/courses/components/CheckedZone.jsx`**

```jsx
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import ItemRow from './ItemRow.jsx'

export default function CheckedZone({ items, onToggle, onEdit }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-fg transition"
      >
        <ChevronRight size={16} className={cn('transition-transform', open && 'rotate-90')} />
        Cochés ({items.length})
      </button>
      {open && (
        <div className="mt-1 opacity-70 divide-y divide-border">
          {items.map((it) => (
            <ItemRow key={it.id} item={it} onToggle={onToggle} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5 : Build + commit**

Run: `npm run build` → Expected: vert.

```bash
git add -A
git commit -m "feat(courses): item row, aisle section, checked zone, token sheet"
```

---

## Task 5 : Ajout rapide, édition, confirmation

**Files:**
- Create: `src/apps/courses/components/QuickAddBar.jsx`
- Create: `src/apps/courses/components/ItemEditSheet.jsx`
- Create: `src/apps/courses/components/ConfirmDialog.jsx`

- [ ] **Step 1 : Créer `src/apps/courses/components/QuickAddBar.jsx`**

```jsx
import { useState } from 'react'
import { Plus, Star } from 'lucide-react'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'

export default function QuickAddBar({ catalog, suggestions, onAdd }) {
  const [name, setName] = useState('')

  function submit(e) {
    e.preventDefault()
    const v = name.trim()
    if (!v) return
    onAdd(v)
    setName('')
  }

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          list="courses-catalog"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ajouter un article…"
          autoComplete="off"
          aria-label="Nom de l'article"
        />
        <Button type="submit" className="px-4 shrink-0" aria-label="Ajouter">
          <Plus size={18} />
        </Button>
      </form>
      <datalist id="courses-catalog">
        {catalog.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => onAdd(s.name)}
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition',
                'bg-surface-2 border-border text-fg hover:border-accent hover:text-accent',
              )}
            >
              {s.favorite && <Star size={12} className="fill-current text-accent" />}
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Créer `src/apps/courses/components/ItemEditSheet.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { AISLES } from '../config/aisles.js'

export default function ItemEditSheet({ item, onClose, onSave, onDelete }) {
  const [name, setName] = useState('')
  const [quantityLabel, setQuantityLabel] = useState('')
  const [aisle, setAisle] = useState('autres')

  useEffect(() => {
    if (item) {
      setName(item.name)
      setQuantityLabel(item.quantityLabel || '')
      setAisle(item.aisle)
    }
  }, [item])

  function save() {
    const v = name.trim()
    if (!v) return
    onSave(item.id, { name: v, quantityLabel: quantityLabel.trim() || null, aisle })
    onClose()
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()} title="Modifier l'article">
      {item && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Nom</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Quantité (libre)</label>
            <Input
              value={quantityLabel}
              onChange={(e) => setQuantityLabel(e.target.value)}
              placeholder="ex. 500 g, 2, 1 paquet"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Rayon</label>
            <div className="flex flex-wrap gap-2">
              {AISLES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAisle(a.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs border transition',
                    aisle === a.id
                      ? 'bg-accent text-accent-fg border-accent'
                      : 'bg-surface-2 text-muted border-border hover:text-fg',
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => { onDelete(item.id); onClose() }}>
              <Trash2 size={16} /> Supprimer
            </Button>
            <Button className="flex-1" onClick={save}>Enregistrer</Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 3 : Créer `src/apps/courses/components/ConfirmDialog.jsx`**

```jsx
import { Sheet } from './Sheet.jsx'
import { Button } from '@/shared/ui/Button.jsx'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', onConfirm, onClose }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title}>
      <p className="text-sm text-muted mb-5">{message}</p>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
        <Button className="flex-1" onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
      </div>
    </Sheet>
  )
}
```

- [ ] **Step 4 : Build + commit**

Run: `npm run build` → Expected: vert.

```bash
git add -A
git commit -m "feat(courses): quick-add bar, item edit sheet, confirm dialog"
```

---

## Task 6 : Mode magasin + favoris

**Files:**
- Create: `src/apps/courses/components/StoreModeView.jsx`
- Create: `src/apps/courses/components/FavoritesSheet.jsx`

- [ ] **Step 1 : Créer `src/apps/courses/components/StoreModeView.jsx`**

```jsx
import { X } from 'lucide-react'
import { Button } from '@/shared/ui/Button.jsx'
import { groupByAisle } from '../utils/grouping.js'

export default function StoreModeView({ items, onToggle, onExit }) {
  const visible = items.filter((i) => !i.checked)
  const groups = groupByAisle(visible)

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-semibold text-fg">Mode magasin</h1>
        <Button variant="secondary" size="sm" onClick={onExit}><X size={16} /> Fini</Button>
      </header>
      <div className="max-w-xl mx-auto px-4 py-4">
        {groups.length === 0 ? (
          <p className="text-center text-muted py-16">Tout est coché 🎉</p>
        ) : (
          groups.map(({ aisle, items: its }) => {
            const Icon = aisle.icon
            return (
              <section key={aisle.id} className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={18} className={aisle.colorClass} />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{aisle.label}</h2>
                </div>
                <div className="space-y-2">
                  {its.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => onToggle(it)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface border border-border text-left active:scale-[0.99] transition"
                    >
                      <span className="h-7 w-7 rounded-full border-2 border-border-strong shrink-0" />
                      <span className="flex-1 text-lg text-fg">{it.name}</span>
                      {it.quantityLabel && <span className="text-base text-muted">{it.quantityLabel}</span>}
                    </button>
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Créer `src/apps/courses/components/FavoritesSheet.jsx`**

```jsx
import { Star, Trash2 } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { cn } from '@/shared/lib/utils.js'
import { AISLES, getAisle } from '../config/aisles.js'

export default function FavoritesSheet({ open, onClose, catalog, onToggleFavorite, onSetAisle, onRemove }) {
  const sorted = [...catalog].sort(
    (a, b) => (Number(b.favorite) - Number(a.favorite)) || (b.useCount - a.useCount) || a.name.localeCompare(b.name),
  )

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Favoris & fréquents">
      {sorted.length === 0 ? (
        <p className="text-sm text-muted py-8 text-center">Aucun produit mémorisé pour l'instant.</p>
      ) : (
        <div className="divide-y divide-border">
          {sorted.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2.5">
              <button
                onClick={() => onToggleFavorite(c)}
                aria-label={c.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                className={cn('p-1 transition', c.favorite ? 'text-accent' : 'text-faint hover:text-muted')}
              >
                <Star size={18} className={c.favorite ? 'fill-current' : ''} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-fg truncate">{c.name}</p>
                <p className="text-xs text-faint">{getAisle(c.aisle).label} · {c.useCount}×</p>
              </div>
              <select
                value={c.aisle}
                onChange={(e) => onSetAisle(c, e.target.value)}
                aria-label="Rayon par défaut"
                className="text-xs bg-surface-2 border border-border rounded-md px-1.5 py-1 text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {AISLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <button
                onClick={() => onRemove(c.id)}
                aria-label="Retirer du catalogue"
                className="text-faint hover:text-danger p-1 transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 3 : Build + commit**

Run: `npm run build` → Expected: vert.

```bash
git add -A
git commit -m "feat(courses): store mode + favorites/catalog sheet"
```

---

## Task 7 : Assemblage (ListView, CoursesApp) + câblage route → smoke test complet

**Files:**
- Create: `src/apps/courses/views/ListView.jsx`
- Create: `src/apps/courses/CoursesApp.jsx`
- Modify: `src/App.jsx`
- Modify: `src/platform/apps.config.js`

- [ ] **Step 1 : Créer `src/apps/courses/views/ListView.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Store, MoreVertical, Star } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { useCoursesData } from '../hooks/useCoursesData.js'
import {
  addItem, setItemChecked, updateItem, deleteItem, clearChecked, clearAll,
} from '../services/shoppingItemsService.js'
import {
  recordUsage, toggleFavorite, setCatalogAisle, removeCatalogEntry,
} from '../services/catalogService.js'
import { guessAisle, slugify, normalizeName } from '../utils/aisleGuess.js'
import { groupByAisle } from '../utils/grouping.js'
import QuickAddBar from '../components/QuickAddBar.jsx'
import AisleSection from '../components/AisleSection.jsx'
import CheckedZone from '../components/CheckedZone.jsx'
import ItemEditSheet from '../components/ItemEditSheet.jsx'
import StoreModeView from '../components/StoreModeView.jsx'
import FavoritesSheet from '../components/FavoritesSheet.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

export default function ListView() {
  const { currentUid } = useAuth()
  const { items, catalog, isLoading } = useCoursesData()
  const [storeMode, setStoreMode] = useState(false)
  const [editing, setEditing] = useState(null)
  const [favOpen, setFavOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)

  const active = useMemo(() => items.filter((i) => !i.checked), [items])
  const checked = useMemo(() => items.filter((i) => i.checked), [items])
  const groups = useMemo(() => groupByAisle(active), [active])
  const suggestions = useMemo(() => {
    const inList = new Set(items.map((i) => normalizeName(i.name)))
    return [...catalog]
      .filter((c) => !inList.has(c.nameLower))
      .sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || (b.useCount - a.useCount) || a.name.localeCompare(b.name))
      .slice(0, 6)
  }, [catalog, items])

  async function handleAdd(name) {
    const slug = slugify(name)
    const known = catalog.find((c) => c.id === slug)
    const aisle = known?.aisle || guessAisle(name)
    await addItem({ name, aisle }, currentUid)
    await recordUsage(name, aisle, currentUid)
  }
  const handleToggle = (it) => setItemChecked(it, !it.checked, currentUid)
  const handleSave = (id, updates) => updateItem(id, updates, currentUid)
  const handleDelete = (id) => deleteItem(id)

  if (storeMode) {
    return <StoreModeView items={items} onToggle={handleToggle} onExit={() => setStoreMode(false)} />
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-xl mx-auto px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition mb-1">
            <ArrowLeft size={14} /> Nos apps
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-fg">Nos courses</h1>
            <div className="flex items-center gap-1">
              <button onClick={() => setFavOpen(true)} className="p-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition" aria-label="Favoris">
                <Star size={18} />
              </button>
              <div className="relative">
                <button onClick={() => setMenuOpen((o) => !o)} className="p-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition" aria-label="Menu">
                  <MoreVertical size={18} />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 z-20 w-52 rounded-xl border border-border bg-surface shadow-lift py-1">
                      <button
                        onClick={() => { clearChecked(); setMenuOpen(false) }}
                        disabled={checked.length === 0}
                        className="w-full text-left px-4 py-2.5 text-sm text-fg hover:bg-surface-2 transition disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Vider les cochés ({checked.length})
                      </button>
                      <button
                        onClick={() => { setConfirmAll(true); setMenuOpen(false) }}
                        disabled={items.length === 0}
                        className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-surface-2 transition disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Tout vider
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 pb-28 pt-4">
        <QuickAddBar catalog={catalog} suggestions={suggestions} onAdd={handleAdd} />

        <div className="mt-5">
          {isLoading ? (
            <p className="text-center text-muted py-16">Chargement…</p>
          ) : active.length === 0 && checked.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-fg font-medium">Ta liste est vide</p>
              <p className="text-sm text-muted mt-1">Ajoute un article ci-dessus ou via les fréquents.</p>
            </div>
          ) : (
            <>
              {groups.map(({ aisle, items: its }) => (
                <AisleSection key={aisle.id} aisle={aisle} items={its} onToggle={handleToggle} onEdit={setEditing} />
              ))}
              <CheckedZone items={checked} onToggle={handleToggle} onEdit={setEditing} />
            </>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-bg to-transparent pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto">
          <Button className="w-full shadow-lift" size="lg" onClick={() => setStoreMode(true)}>
            <Store size={18} /> Mode magasin
          </Button>
        </div>
      </div>

      <ItemEditSheet item={editing} onClose={() => setEditing(null)} onSave={handleSave} onDelete={handleDelete} />
      <FavoritesSheet
        open={favOpen}
        onClose={() => setFavOpen(false)}
        catalog={catalog}
        onToggleFavorite={(c) => toggleFavorite(c, currentUid)}
        onSetAisle={(c, aisle) => setCatalogAisle(c, aisle, currentUid)}
        onRemove={removeCatalogEntry}
      />
      <ConfirmDialog
        open={confirmAll}
        title="Tout vider ?"
        message="Tous les articles de la liste seront supprimés. Les favoris et l'historique sont conservés."
        confirmLabel="Tout vider"
        onConfirm={clearAll}
        onClose={() => setConfirmAll(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2 : Créer `src/apps/courses/CoursesApp.jsx`**

```jsx
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import ListView from './views/ListView.jsx'

export default function CoursesApp() {
  useAppTheme('light', 'emerald')
  return <ListView />
}
```

- [ ] **Step 3 : Brancher la route dans `src/App.jsx`**

Remplacer tout le contenu par (ComingSoonView retiré des imports — le fichier reste pour de futures apps `soon`) :

```jsx
import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/platform/ProtectedRoute.jsx'
import Splash from '@/platform/Splash.jsx'
import LoginView from '@/platform/LoginView.jsx'
import DashboardView from '@/platform/DashboardView.jsx'

const FinauziApp = lazy(() => import('@/apps/finauzi/FinauziApp.jsx'))
const CoursesApp = lazy(() => import('@/apps/courses/CoursesApp.jsx'))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginView />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardView />} />
        <Route
          path="/finauzi"
          element={<Suspense fallback={<Splash />}><FinauziApp /></Suspense>}
        />
        <Route
          path="/courses"
          element={<Suspense fallback={<Splash />}><CoursesApp /></Suspense>}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 4 : Passer la card Courses en `live` dans `src/platform/apps.config.js`**

Dans l'entrée `courses`, changer la ligne `status: 'soon',` → `status: 'live',`.

- [ ] **Step 5 : Build**

Run: `npm run build`
Expected: `✓ built in …`. (Tout le graphe Courses est désormais compilé. Corriger toute erreur d'import signalée avant de poursuivre.)

- [ ] **Step 6 : Smoke test complet (Clément)**

> Pré-requis : règles Firestore de la Task 3 **publiées** (sinon les écritures échouent).

Run: `! npm run dev` puis vérifier sur deux navigateurs/onglets (toi + simulateur de Lise si possible) :
- Dashboard → card **Liste de courses** (claire/verte) → `/courses` : transition sombre→clair fluide, en-tête « Nos courses », « ← Nos apps ».
- **Ajout rapide** : taper « lait » + Entrée → apparaît sous **Crémerie / frais** (auto-classement) ; taper « tomates » → **Fruits & légumes** ; un nom inconnu → **Autres**.
- **Temps réel** : l'article ajouté apparaît dans le 2e onglet sans rafraîchir.
- **Quantité** : tap sur un article → sheet → saisir « 500 g », changer le rayon, Enregistrer.
- **Cocher** : la case se remplit (vert), l'article barré bascule dans « Cochés (n) » (repliable).
- **Fréquents** : les chips proposent les produits déjà ajoutés (hors liste courante) ; tap = ajout 1-clic.
- **Menu ⋮** : « Vider les cochés » retire les cochés ; « Tout vider » → confirmation → vide la liste (les chips fréquents restent).
- **PWA** : après `! npm run build` puis `! npm run preview`, vérifier l'invite « Installer » / « Ajouter à l'écran d'accueil ».

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "feat(courses): wire ListView + CoursesApp, activate /courses card"
```

---

## Task 8 : Finitions & documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1 : Documenter les collections Firestore dans `README.md`**

Dans la section « Firestore Data Structure », sous le bloc existant, ajouter sous `couples/main/` :

```
    shoppingItems/
      {itemId}                # { name, quantityLabel, aisle, checked, checkedBy, checkedAt, note, createdAt, createdBy, updatedAt, updatedBy }
    shoppingCatalog/
      {slug}                  # { name, nameLower, aisle, favorite, useCount, lastUsedAt, createdAt, createdBy, updatedAt, updatedBy }
```

- [ ] **Step 2 : Build final + commit**

Run: `npm run build` → Expected: vert.

```bash
git add -A
git commit -m "docs(courses): document shopping Firestore collections"
```

---

## Étapes manuelles (hors code, à faire par Clément)

1. **Firebase** : publier les nouvelles `firestore.rules` (Firestore › Rules › Publish) **avant** d'utiliser l'app courses.
2. **PWA / iOS (optionnel plus tard)** : l'icône d'écran d'accueil iOS utilise `apple-touch-icon-180x180.png` (généré). Pour une icône plus léchée, remplacer les PNG de `public/` par un visuel dédié et relancer `npx pwa-assets-generator`.

---

## Self-Review — couverture de la spec

- **§4.1 structure `src/apps/courses/`** → Tasks 2, 4–7 (tous les fichiers prévus créés) ✓
- **§4.2 route `/courses` + `apps.config` live** → Task 7 Steps 3–4 ✓
- **§4.3 thème `useAppTheme('light','emerald')`** → Task 7 Step 2 (CoursesApp) ✓
- **§5.1 `shoppingItems` (champs + métadonnées)** → Task 2 Step 4 (service) + Task 3 (règles) ✓
- **§5.2 `shoppingCatalog` (slug, useCount, favorite, aisle)** → Task 2 Step 5 + Task 3 ✓
- **§5.3 rayons preset + dico mots-clés** → Task 2 Step 1 (aisles.js) ✓
- **§6 logique ajout/catalogue (slug, rayon mémorisé > devinette, upsert ; cocher ; vider cochés ; tout vider ; fréquents ; favoris)** → Task 2 (services) + Task 7 (`handleAdd`, suggestions, menu) ✓
- **§7.1 liste (barre d'ajout, fréquents, rayons non vides, tap→édition, cochés repliables, menu)** → Tasks 4–5 + Task 7 ✓
- **§7.2 mode magasin (état, grosses lignes, cochés masqués)** → Task 6 Step 1 + Task 7 (`storeMode`) ✓
- **§7.3 favoris/fréquents (épingler, rayon par défaut, retirer)** → Task 6 Step 2 (`FavoritesSheet`) + services ✓
- **§8 règles Firestore (2 blocs calqués sur l'existant)** → Task 3 ✓
- **§9 PWA légère (manifest, icônes, SW, cache polices)** → Task 1 ✓
- **§10 déploiement / étapes manuelles (publier règles)** → section « Étapes manuelles » + notes Task 3 ✓
- **§11 vérification (build + smoke)** → builds par tâche + smoke Task 7 ✓
- **§13 attribution « qui a ajouté »** → Task 4 (`ItemRow` pastille `dotClass`) ✓

**Placeholders :** aucun (pas de TODO/TBD). **Cohérence des noms** vérifiée entre couches :
`addItem/updateItem/setItemChecked/deleteItem/clearChecked/clearAll` (items),
`recordUsage/toggleFavorite/setCatalogAisle/removeCatalogEntry/subscribeToCatalog` (catalog),
`subscribeToItems` + `useCoursesData` → `{ items, catalog, isLoading }`,
`AISLES/AISLE_BY_ID/DEFAULT_AISLE/getAisle`, `slugify/normalizeName/guessAisle`, `groupByAisle`.
Le catalogue est indexé par `slug` = `id` du doc → `catalog.find((c) => c.id === slug)` cohérent
avec `recordUsage` qui écrit sous `catalogDoc(slugify(name))`.
