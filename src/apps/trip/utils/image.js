// Dimensions d'une capture avant compression. Module pur, testé sous `node --test`.

// Plus large ne se lit pas mieux sur un téléphone, et pèse quatre fois plus.
export const MAX_WIDTH = 1600

// Safari iOS refuse de dessiner un canevas de plus de ~16,7 millions de
// pixels (4096²) : au-delà il rend une image vide, sans erreur. Une très
// longue capture de mail doit donc rapetisser pour tenir sous ce seuil.
export const MAX_AREA = 16_000_000

/** La taille de travail : jamais agrandie, réduite pour tenir dans les deux limites. */
export function fitWithin(width, height, { maxWidth = MAX_WIDTH, maxArea = MAX_AREA } = {}) {
  let scale = Math.min(1, maxWidth / width)
  if (width * height * scale * scale > maxArea) scale = Math.sqrt(maxArea / (width * height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
