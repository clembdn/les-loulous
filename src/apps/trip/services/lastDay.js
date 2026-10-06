// Le dernier jour consulté de chaque voyage, propre à l'appareil : c'est le
// jour proposé quand on partage un lieu depuis Google Maps avant le départ
// (« je prépare le mercredi, j'y ajoute ce que je trouve »).

const KEY = 'trip:lastDay'

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function getLastDay(tripId) {
  return read()[tripId] || null
}

export function rememberDay(tripId, date) {
  try {
    const all = read()
    if (all[tripId] === date) return
    localStorage.setItem(KEY, JSON.stringify({ ...all, [tripId]: date }))
  } catch {
    // Navigation privée : on proposera le premier jour.
  }
}
