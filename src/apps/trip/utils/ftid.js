// L'identifiant d'un lieu Google Maps (« ftid ») : `0x47e66e2964e34e2d:0x8ddca9ee380ef7e0`.
//
// Les liens de partage récents ne donnent plus de coordonnées, seulement lui :
//   maps.google.com/maps?q=Tour+Eiffel,+…&ftid=0x47e6…:0x8ddc…
//   google.com/maps/place/data=!4m2!3m1!1s0x47e6…:0x8ddc…
// Sa première moitié est une cellule S2 (le découpage de la Terre de Google)
// qui contient le lieu : décodée, elle donne une position à quelques
// centaines de mètres près (2,5 km pour un très grand lieu), sans réseau.
// Assez pour vérifier une position trouvée ailleurs, ou pour s'en contenter
// en la disant approximative.
//
// Module pur, sans dépendance : importé par l'app ET par la fonction serveur,
// testé sous `node --test`.

const FTID_RE = /(0x[0-9a-f]{1,16}):(0x[0-9a-f]{1,16})/i

/** Le ftid d'un lien Google Maps (paramètre `ftid`, ou `!1s` de `data=`), sinon `null`. */
export function mapsFtid(text) {
  if (typeof text !== 'string') return null
  let decoded = text
  try { decoded = decodeURIComponent(text) } catch { /* lien mal encodé : tel quel */ }
  const param = decoded.match(/[?&]ftid=(0x[0-9a-f]{1,16}:0x[0-9a-f]{1,16})/i)
  if (param) return param[1].toLowerCase()
  const data = decoded.match(/!1s(0x[0-9a-f]{1,16}:0x[0-9a-f]{1,16})/i)
  return data ? data[1].toLowerCase() : null
}

// Courbe de Hilbert de S2 : position (2 bits) → quadrant (i, j), selon l'orientation.
const POS_TO_IJ = [[0, 1, 3, 2], [0, 2, 3, 1], [3, 2, 0, 1], [3, 1, 0, 2]]
const POS_TO_ORIENTATION = [1, 0, 0, 3]

// Projection quadratique de S2 : [0, 1] → [-1, 1] sur la face du cube.
function stToUv(s) {
  return s >= 0.5 ? (4 * s * s - 1) / 3 : (1 - 4 * (1 - s) * (1 - s)) / 3
}

/**
 * La zone d'un ftid : `{ lat, lng }` à quelques centaines de mètres près,
 * ou `null` si la première moitié n'est pas une cellule S2 plausible.
 */
export function ftidArea(ftid) {
  const m = typeof ftid === 'string' && ftid.match(FTID_RE)
  if (!m) return null
  const id = BigInt(m[1])
  const face = Number(id >> 61n)
  // Une vraie cellule occupe les 64 bits ; « 0x1 » n'en est pas une.
  if (face > 5 || id < 1n << 40n) return null

  let orientation = face & 1
  let i = 0
  let j = 0
  for (let level = 0; level < 30; level += 1) {
    const pos = Number((id >> BigInt(59 - 2 * level)) & 3n)
    const ij = POS_TO_IJ[orientation][pos]
    i = i * 2 + (ij >> 1)
    j = j * 2 + (ij & 1)
    orientation ^= POS_TO_ORIENTATION[pos]
  }
  const u = stToUv((2 * i + 1) / 2 ** 31)
  const v = stToUv((2 * j + 1) / 2 ** 31)
  const [x, y, z] = [[1, u, v], [-u, 1, v], [-u, -v, 1], [-1, -v, -u], [v, -1, -u], [v, u, -1]][face]
  const toDeg = 180 / Math.PI
  return {
    lat: Math.round(Math.atan2(z, Math.hypot(x, y)) * toDeg * 1e6) / 1e6,
    lng: Math.round(Math.atan2(y, x) * toDeg * 1e6) / 1e6,
  }
}
