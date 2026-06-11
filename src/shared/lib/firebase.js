import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

function readEnv(key) {
  const value = import.meta.env[key]
  if (typeof value === 'string' && value.trim()) return value
  throw new Error(`[FinAuzi] Missing environment variable: ${key}`)
}

const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID'),
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// Cache persistant (IndexedDB) : démarrage instantané depuis le cache local,
// app utilisable hors-ligne (magasin sans réseau), sync auto au retour du réseau.
// Multi-onglets pour que PWA installée + onglet navigateur cohabitent.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
export default app
