// Charger MapLibre une seule fois, à la demande. Un échec (hors-ligne avant
// que le service worker ait mis le module en cache) n'est pas définitif : la
// carte suivante retentera.

let pending = null

export function loadMaplibre() {
  pending ||= import('./maplibre.js')
    .then((mod) => mod.default)
    .catch((err) => {
      pending = null
      throw err
    })
  return pending
}

let webgl = null

/** La carte vectorielle demande WebGL ; sans lui, la mini-carte SVG prend le relais. */
export function canUseWebGL() {
  if (webgl !== null) return webgl
  try {
    const canvas = document.createElement('canvas')
    webgl = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    webgl = false
  }
  return webgl
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
