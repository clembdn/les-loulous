// Compresser une capture d'écran pour qu'elle tienne dans UN document
// Firestore (1 Mo, base64 compris), dans le navigateur, sans dépendance.
//
// WebP d'abord, JPEG sinon : Safari ne sait pas ENCODER le WebP depuis un
// canevas — il rend alors un PNG, sans erreur, cinq fois plus lourd. On
// vérifie donc le type réellement produit plutôt que de le supposer.

import { fitWithin } from '../utils/image.js'

// Sous la limite de 1 Mo, avec de la marge pour les autres champs.
export const MAX_DATA_CHARS = 900_000
const QUALITIES = [0.82, 0.7, 0.58, 0.46]
const SHRINK = 0.75
const MAX_PASSES = 5

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Format que le décodeur rapide ne prend pas : on passe par <img>.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function encode(image, width, height, quality) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // Fond blanc : une capture PNG transparente deviendrait noire en JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)
  const webp = await toBlob(canvas, 'image/webp', quality)
  if (webp?.type === 'image/webp') return webp
  return toBlob(canvas, 'image/jpeg', quality)
}

/**
 * Fichier image → `{ name, mime, data, width, height }` prêt pour Firestore
 * (`data` en base64, sans préfixe). Qualité dégressive, puis réduction, jusqu'à
 * tenir sous `MAX_DATA_CHARS`. Une capture interminable finit donc plus petite
 * plutôt que refusée.
 */
export async function compressImage(file) {
  const image = await loadImage(file)
  try {
    let { width, height } = fitWithin(image.width, image.height)
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      for (const quality of QUALITIES) {
        const blob = await encode(image, width, height, quality)
        if (!blob) throw new Error('encode-failed')
        const data = await blobToBase64(blob)
        if (data.length <= MAX_DATA_CHARS) {
          return { name: file.name || 'capture', mime: blob.type, data, width, height }
        }
      }
      width = Math.max(1, Math.round(width * SHRINK))
      height = Math.max(1, Math.round(height * SHRINK))
    }
    throw new Error('too-large')
  } finally {
    image.close?.()
  }
}
