// Tracés compacts : l'algorithme « encoded polyline » de Google (précision
// 1e-5, ~1 m), celui que rend OpenRouteService.
//
// Firestore refuse les tableaux de tableaux : un tracé y est rangé en
// chaîne, ~4 caractères par point au lieu de ~20 en JSON.
// Module pur, testé sous `node --test` — et partagé avec api/route.js.

/** `"_p~iF~ps|U…"` → `[[lat, lng], …]`. Une chaîne illisible rend ce qui précède. */
export function decodePolyline(str) {
  const points = []
  if (typeof str !== 'string') return points
  let index = 0
  let lat = 0
  let lng = 0
  while (index < str.length) {
    const dLat = readValue()
    const dLng = readValue()
    if (dLat === null || dLng === null) break
    lat += dLat
    lng += dLng
    points.push([lat / 1e5, lng / 1e5])
  }
  return points

  function readValue() {
    let result = 0
    let shift = 0
    let byte
    do {
      if (index >= str.length) return null
      byte = str.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
}

/** `[[lat, lng], …]` → chaîne encodée. */
export function encodePolyline(points) {
  let out = ''
  let prevLat = 0
  let prevLng = 0
  for (const [lat, lng] of points) {
    const iLat = Math.round(lat * 1e5)
    const iLng = Math.round(lng * 1e5)
    out += writeValue(iLat - prevLat) + writeValue(iLng - prevLng)
    prevLat = iLat
    prevLng = iLng
  }
  return out
}

function writeValue(value) {
  let v = value < 0 ? ~(value << 1) : value << 1
  let out = ''
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
    v >>= 5
  }
  return out + String.fromCharCode(v + 63)
}

/**
 * Allège un tracé (Douglas-Peucker) : les points à moins de `tolerance`
 * degrés (~1e-4 ≈ 10 m) de la ligne qui les entoure disparaissent. Une
 * autoroute droite n'a pas besoin d'un point tous les 20 m pour se dessiner.
 */
export function simplifyPoints(points, tolerance = 1e-4) {
  if (points.length <= 2) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    let maxDist = 0
    let index = -1
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i], points[first], points[last])
      if (d > maxDist) {
        maxDist = d
        index = i
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }
  return points.filter((_, i) => keep[i])
}

function segmentDistance([y, x], [y1, x1], [y2, x2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len)) : 0
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}
