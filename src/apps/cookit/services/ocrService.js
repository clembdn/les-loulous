// OCR d'étiquette via Tesseract.
//
// Tesseract pèse lourd (~6 Mo : moteur wasm + modèle de langue). Deux règles
// pour que ça reste supportable sur un téléphone :
//
//   1. `import('tesseract.js')` est DYNAMIQUE — rien n'entre dans le bundle de
//      démarrage, le téléchargement n'a lieu qu'au premier scan d'étiquette ;
//   2. les fichiers sont auto-hébergés dans /tesseract (pas de CDN), donc mis en
//      cache par le service worker : le deuxième usage marche hors-ligne, ce qui
//      compte quand on est dans un magasin sans réseau.
//
// Modèle anglais seulement : ils font leurs courses en Australie, les étiquettes
// sont en anglais. Le parseur, lui, reconnaît aussi les mots-clés français.

const BASE = '/tesseract'
let workerPromise = null

async function getWorker(onProgress) {
  if (workerPromise) return workerPromise
  workerPromise = (async () => {
    const { createWorker } = await import('tesseract.js')
    return createWorker('eng', 1, {
      workerPath: `${BASE}/worker.min.js`,
      corePath: BASE,
      langPath: BASE,
      // `gzip` : le modèle est servi tel quel, déjà compressé.
      gzip: true,
      logger: (m) => {
        if (m.status === 'recognizing text') onProgress?.(m.progress)
        else onProgress?.(null, m.status)
      },
    })
  })().catch((err) => {
    // Un échec ne doit pas condamner les essais suivants (réseau coupé au
    // premier téléchargement, par exemple).
    workerPromise = null
    throw err
  })
  return workerPromise
}

/**
 * Image (File, Blob ou dataURL) → texte brut.
 * `onProgress(progress, status)` : progress ∈ [0,1] pendant la reconnaissance,
 * null pendant les phases de chargement (le status dit laquelle).
 */
export async function readImageText(image, onProgress) {
  const worker = await getWorker(onProgress)
  const { data } = await worker.recognize(image)
  return data?.text || ''
}

// Libère la mémoire du worker. À appeler quand on quitte l'écran : le moteur
// wasm garde plusieurs dizaines de Mo vivants.
export async function disposeOcr() {
  if (!workerPromise) return
  const p = workerPromise
  workerPromise = null
  try { (await p).terminate() } catch { /* déjà mort */ }
}
