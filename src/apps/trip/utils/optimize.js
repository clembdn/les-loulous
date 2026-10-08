// Optimiser l'ordre d'une journée (V3·2) : le trajet le plus court entre ses
// étapes, sans toucher à ce qui est fixé.
//
// Ce qui bouge : les étapes SANS heure et localisées. Ce qui ne bouge pas :
//  · les étapes à heure fixe (une table réservée à 12:30), dans leur ordre ;
//  · les étapes pas encore localisées (on ne sait pas où elles sont) ;
//  · les trajets réservés et les hébergements, que la frise place d'elle-même.
// Une étape libre peut passer d'un côté à l'autre d'une étape fixée, mais
// chaque intervalle garde son NOMBRE d'étapes libres : deux visites avant le
// déjeuner de 12:30 restent deux visites avant lui — les deux plus proches.
// Sans cette règle, l'ordre le plus court mettait le déjeuner en premier et
// toutes les visites l'après-midi (constaté sur une vraie journée à Lisbonne).
// On ne devine pas de durées de visite : la journée garde la forme qu'on lui
// a donnée, on n'en change que la géographie.
//
// La journée part de l'hébergement du matin (ou de ce qui ouvre la frise :
// on rend la chambre, on descend du train) et finit à celui du soir.
//
// Le coût d'un tronçon est sa DISTANCE par la route — à pied jusqu'à 1,5 km
// (cf. `autoMode`), en voiture au-delà — d'après les matrices
// d'OpenRouteService quand on les a, estimée à vol d'oiseau sinon (hors-ligne,
// île sans route). Pas le temps : 1 km à pied (un quart d'heure) « coûterait »
// plus que 2 km en voiture, et l'ordre irait chercher les détours en voiture.
// Le temps est seulement affiché.
//
// Module pur, testé sous `node --test`.

import { hasCoords, haversineM } from './geo.js'
import { autoMode } from './legs.js'
import { buildDayTimeline } from './timeline.js'

// Jusque-là, l'ordre est le meilleur possible (programmation dynamique,
// 2^12 × 13 états par étape fixée) ; au-delà, échanges successifs.
export const EXACT_MAX_FREE = 12
// En dessous, l'ordre actuel est gardé : ce n'est pas la peine de le chambouler.
const MIN_GAIN_M = 200
const MIN_GAIN_RATIO = 0.03

// Estimations à vol d'oiseau : les rues ne vont pas tout droit.
const ESTIMATE = {
  walk: { detour: 1.3, speed: 1.25 },
  car: { detour: 1.4, speed: 9, overhead: 60 },
}

const SLOT = '__slot-'

/** Une étape qu'on peut déplacer : sans heure, et localisée. */
export function isMovable(stop) {
  return !stop.time && hasCoords(stop)
}

// Les points d'une suite d'éléments de frise, comme sur la carte (cf.
// dayRoute) : deux points d'un même trajet réservé portent son identifiant,
// on ne compte pas le tronçon qui les relie (on est dans le train).
function itemPoints(items) {
  const points = []
  for (const item of items) {
    if (item.type === 'stop') {
      if (hasCoords(item.stop)) points.push({ lat: item.stop.lat, lng: item.stop.lng })
    } else if (item.type === 'transport') {
      const t = item.transport
      if (item.phase !== 'arrival' && hasCoords(t.from)) points.push({ lat: t.from.lat, lng: t.from.lng, booked: t.id })
      if (item.phase !== 'departure' && hasCoords(t.to)) points.push({ lat: t.to.lat, lng: t.to.lng, booked: t.id })
    } else if (hasCoords(item.stay)) {
      points.push({ lat: item.stay.lat, lng: item.stay.lng })
    }
  }
  return points
}

/**
 * La journée découpée pour l'optimiser :
 *  · `free` : les étapes déplaçables ; `fixed` : les autres, dans leur ordre ;
 *  · `gates` : `fixed.length + 2` groupes de points — le départ, puis chaque
 *    étape fixée avec ce que la frise place juste avant elle (un train à
 *    11:00 avant la visite de 14:00), puis la fin de journée ;
 *  · `places` : tous les points, numérotés (`i`), pour la matrice.
 *
 * Le découpage vient de la frise elle-même (`buildDayTimeline`, avec des
 * repères entre les étapes fixées) : l'ordre optimisé s'affichera exactement
 * comme il a été calculé.
 */
export function dayModel({ date, stops, stays = [], transports = [], morning = null, tonight = null }) {
  const free = stops.filter(isMovable)
  const fixed = stops.filter((s) => !isMovable(s))
  const slot = (i) => ({ id: `${SLOT}${i}`, name: '', time: null })
  const skeleton = [slot(0), ...fixed.flatMap((s, i) => [s, slot(i + 1)])]

  const groups = [[]]
  for (const item of buildDayTimeline(date, skeleton, stays, transports)) {
    if (item.type === 'stop' && item.stop.id.startsWith(SLOT)) groups.push([])
    else groups[groups.length - 1].push(item)
  }
  // `groups` : [départ (ce qui précède le 1er repère), étape fixée 1, …, fin].
  const gates = groups.map(itemPoints)
  if (!gates[0].length && hasCoords(morning)) gates[0].push({ lat: morning.lat, lng: morning.lng })
  const end = gates[gates.length - 1]
  const last = end[end.length - 1]
  if (hasCoords(tonight) && !(last && haversineM(last, tonight) < 15)) end.push({ lat: tonight.lat, lng: tonight.lng })

  const places = []
  const number = (p) => { p.i = places.length; places.push(p); return p }
  gates.forEach((points) => points.forEach(number))
  const freePoints = free.map((s) => number({ lat: s.lat, lng: s.lng }))
  return { free, fixed, gates, freePoints, places }
}

/**
 * Le temps et la distance d'un lieu à l'autre : `cost(a, b)` →
 * `{ durationS, distanceM }`. `matrix` : la réponse de api/matrix
 * (`{ walk, car }`), indexée comme `places` ; absente ou incomplète, on estime.
 */
export function travelCost(matrix = null) {
  return (a, b) => {
    if (!a || !b) return { durationS: 0, distanceM: 0 }
    const straight = haversineM(a, b)
    const mode = autoMode(straight)
    const m = matrix?.[mode]
    const durationS = m?.durations?.[a.i]?.[b.i]
    const distanceM = m?.distances?.[a.i]?.[b.i]
    if (Number.isFinite(durationS) && Number.isFinite(distanceM)) return { durationS, distanceM }
    const e = ESTIMATE[mode]
    const distance = straight * e.detour
    return { durationS: distance / e.speed + (e.overhead || 0), distanceM: distance }
  }
}

// Un ordre = une suite de jetons : `{ gate: g }` (1 ≤ g ≤ fixed.length) ou `{ free: j }`.
function pathPoints(model, tokens) {
  const points = [...model.gates[0]]
  for (const t of tokens) {
    if (t.free != null) points.push(model.freePoints[t.free])
    else points.push(...model.gates[t.gate])
  }
  points.push(...model.gates[model.gates.length - 1])
  return points
}

/** Le temps et la distance de toute la journée pour un ordre donné. */
export function pathCost(model, tokens, cost) {
  const points = pathPoints(model, tokens)
  let durationS = 0
  let distanceM = 0
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]
    const b = points[k]
    if (a.booked && a.booked === b.booked) continue
    const c = cost(a, b)
    durationS += c.durationS
    distanceM += c.distanceM
  }
  return { durationS, distanceM }
}

/** L'ordre actuel des étapes, en jetons. */
export function currentTokens(model, stops) {
  const freeIndex = new Map(model.free.map((s, j) => [s.id, j]))
  const fixedIndex = new Map(model.fixed.map((s, g) => [s.id, g + 1]))
  return stops.map((s) => (freeIndex.has(s.id) ? { free: freeIndex.get(s.id) } : { gate: fixedIndex.get(s.id) }))
}

// Combien d'étapes libres avant chaque étape fixée (cumulé) : `limits[g]` est
// le nombre d'étapes libres placées une fois la g-ième étape fixée franchie.
function freeLimits(tokens, m) {
  const before = new Array(m + 1).fill(0)
  let g = 0
  for (const t of tokens) {
    if (t.free != null) before[g] += 1
    else g = t.gate
  }
  for (let k = 1; k <= m; k++) before[k] += before[k - 1]
  return before
}

function tokensToStops(model, tokens) {
  return tokens.map((t) => (t.free != null ? model.free[t.free] : model.fixed[t.gate - 1]))
}

// Le dernier point réel avant d'entrer dans `gates[g + 1]` : la sortie du
// groupe g, ou de celui d'avant s'il n'a aucun point (étape pas localisée).
function exits(model) {
  const out = []
  let last = null
  for (const points of model.gates) {
    if (points.length) last = points[points.length - 1]
    out.push(last)
  }
  return out
}

/**
 * Le meilleur ordre (≤ EXACT_MAX_FREE étapes libres) : programmation dynamique
 * sur (étapes libres déjà placées, dernière étape, étapes fixées franchies).
 * Les étapes fixées se franchissent dans leur ordre, chaque intervalle avec
 * son nombre d'étapes libres (`limits`) ; seule la distance compte.
 */
function exactTokens(model, cost, limits) {
  const n = model.free.length
  const m = model.fixed.length
  const exit = exits(model)
  const entry = model.gates.map((points) => points[0] || null)
  const full = (1 << n) - 1
  const lasts = n + 1 // 0..n-1 : une étape libre ; n : la sortie de la dernière étape fixée franchie
  const size = (1 << n) * (m + 1) * lasts
  const best = new Float64Array(size).fill(Infinity)
  const from = new Int32Array(size).fill(-1)
  const id = (mask, g, last) => (mask * (m + 1) + g) * lasts + last
  const where = (g, last) => (last === n ? exit[g] : model.freePoints[last])
  const leg = (a, b) => (a && b ? cost(a, b).distanceM : 0)

  const placed = new Uint8Array(full + 1)
  for (let mask = 1; mask <= full; mask++) placed[mask] = placed[mask & (mask - 1)] + 1

  best[id(0, 0, n)] = 0
  for (let mask = 0; mask <= full; mask++) {
    for (let g = 0; g <= m; g++) {
      for (let last = 0; last <= n; last++) {
        const here = id(mask, g, last)
        const t = best[here]
        if (t === Infinity) continue
        const at = where(g, last)
        // L'intervalle est plein : on ne peut plus que franchir l'étape fixée suivante.
        const room = placed[mask] < limits[g]
        for (let j = 0; room && j < n; j++) {
          if (mask & (1 << j)) continue
          const next = id(mask | (1 << j), g, j)
          const v = t + leg(at, model.freePoints[j])
          if (v < best[next]) { best[next] = v; from[next] = here }
        }
        if (g < m && placed[mask] === limits[g]) {
          const next = id(mask, g + 1, n)
          // Un groupe sans point (étape non localisée) ne coûte rien à franchir.
          const v = t + leg(at, entry[g + 1])
          if (v < best[next]) { best[next] = v; from[next] = here }
        }
      }
    }
  }

  const endEntry = entry[m + 1]
  let end = -1
  let endCost = Infinity
  for (let last = 0; last <= n; last++) {
    const s = id(full, m, last)
    if (best[s] === Infinity) continue
    const v = best[s] + leg(where(m, last), endEntry)
    if (v < endCost) { endCost = v; end = s }
  }

  const tokens = []
  for (let s = end; from[s] !== -1; s = from[s]) {
    const last = s % lasts
    const g = Math.floor(s / lasts) % (m + 1)
    tokens.push(last === n ? { gate: g } : { free: last })
  }
  return tokens.reverse()
}

/**
 * Au-delà de EXACT_MAX_FREE : à partir de l'ordre actuel, on échange deux
 * étapes libres (où qu'elles soient : chaque intervalle garde son nombre
 * d'étapes) et on retourne des suites d'étapes libres, tant que la journée
 * raccourcit.
 */
function improveTokens(model, tokens, cost) {
  let current = tokens
  let currentCost = pathCost(model, current, cost).distanceM
  for (let round = 0; round < 50; round++) {
    let improved = false
    for (let a = 0; a < current.length; a++) {
      for (let b = a + 1; b < current.length; b++) {
        if (current[a].free == null || current[b].free == null) continue
        const candidate = [...current]
        candidate[a] = current[b]
        candidate[b] = current[a]
        const c = pathCost(model, candidate, cost).distanceM
        if (c < currentCost - 1e-6) { current = candidate; currentCost = c; improved = true }
      }
    }
    for (let a = 0; a < current.length; a++) {
      for (let b = a + 1; b < current.length && current[b].free != null; b++) {
        if (current[a].free == null) break
        const candidate = [...current.slice(0, a), ...current.slice(a, b + 1).reverse(), ...current.slice(b + 1)]
        const c = pathCost(model, candidate, cost).distanceM
        if (c < currentCost - 1e-6) { current = candidate; currentCost = c; improved = true }
      }
    }
    if (!improved) break
  }
  return current
}

/**
 * Optimise l'ordre des étapes de la journée. Rend
 * `{ stops, before, after, changed, exact }` : `before` / `after` =
 * `{ durationS, distanceM }` de toute la journée (hébergements compris),
 * `changed` faux quand l'ordre actuel est déjà (presque) le meilleur — on le
 * garde alors tel quel.
 */
export function optimizeDay(model, stops, cost) {
  const now = currentTokens(model, stops)
  const before = pathCost(model, now, cost)
  const exact = model.free.length <= EXACT_MAX_FREE
  const tokens = exact ? exactTokens(model, cost, freeLimits(now, model.fixed.length)) : improveTokens(model, now, cost)
  const after = pathCost(model, tokens, cost)
  const gain = before.distanceM - after.distanceM
  const changed = gain >= MIN_GAIN_M && gain >= before.distanceM * MIN_GAIN_RATIO
  return changed
    ? { stops: tokensToStops(model, tokens), before, after, changed, exact }
    : { stops, before, after: before, changed, exact }
}

/** Une journée vaut d'être optimisée : au moins une étape peut bouger, et pas seule. */
export function canOptimize(stops) {
  const movable = stops.filter(isMovable).length
  return movable >= 2 || (movable === 1 && stops.length >= 2)
}
