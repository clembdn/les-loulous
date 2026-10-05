import { fromLocalDateKey, shiftDateKey } from '../../../shared/lib/dates.js'

/**
 * La tendance du poids — ce que la balance dit vraiment, sous le bruit.
 *
 * Une pesée isolée bouge d'un kilo d'un jour à l'autre (eau, sel, repas de la
 * veille) : sur un objectif de +0,3 kg par semaine, c'est trois semaines de
 * progrès noyées dans une seule matinée. Deux lectures lissent ce bruit :
 *
 * - la MOYENNE GLISSANTE sur 7 jours, tracée sous les pesées ;
 * - le RYTHME en kg/semaine sur les 14 derniers jours — la pente de la droite
 *   qui passe au plus près des pesées (moindres carrés). Une droite plutôt que
 *   « dernière moins première » : une seule pesée haute ne fait pas le rythme.
 *
 * Les fenêtres sont en jours CALENDAIRES, pas en nombre de pesées : on ne se
 * pèse pas tous les jours, et « 7 jours » doit rester 7 jours.
 *
 * Dates en clés locales (cf. shared/lib/dates.js). Pur : se teste.
 */

const DAY_MS = 86400000

const round2 = (n) => Math.round(n * 100) / 100

/** Écart en jours entre deux clés — arrondi : un changement d'heure fait 23 ou 25 h. */
export function daysBetween(fromKey, toKey) {
  return Math.round((fromLocalDateKey(toKey) - fromLocalDateKey(fromKey)) / DAY_MS)
}

/**
 * Chaque pesée, avec la moyenne des pesées des `windowDays` derniers jours
 * (elle comprise).
 *
 * @param {Array} weights  [{ date, value }], triées par date croissante
 * @returns {Array} [{ date, value, average }]
 */
export function movingAverage(weights, windowDays = 7) {
  const list = weights || []
  return list.map((w, i) => {
    const from = shiftDateKey(w.date, -(windowDays - 1))
    let sum = 0
    let count = 0
    for (let j = i; j >= 0 && list[j].date >= from; j -= 1) {
      sum += list[j].value
      count += 1
    }
    return { date: w.date, value: w.value, average: round2(sum / count) }
  })
}

/**
 * Le rythme, en kg par semaine, sur les `days` derniers jours.
 *
 * `null` tant qu'il n'y a pas de quoi tracer une droite honnête : au moins
 * trois pesées, étalées sur au moins une semaine. Deux pesées à trois jours
 * d'écart donneraient un « rythme » de pur bruit.
 *
 * @returns {null | { rate, count, from }}  `rate` en kg/semaine, arrondi au centième
 */
export function weeklyRate(weights, todayKey, days = 14) {
  const from = shiftDateKey(todayKey, -(days - 1))
  const pts = (weights || []).filter((w) => w.date >= from && w.date <= todayKey)
  if (pts.length < 3) return null

  const xs = pts.map((w) => daysBetween(from, w.date))
  if (xs[xs.length - 1] - xs[0] < 6) return null

  const n = pts.length
  const meanX = xs.reduce((a, x) => a + x, 0) / n
  const meanY = pts.reduce((a, w) => a + w.value, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - meanX) * (pts[i].value - meanY)
    den += (xs[i] - meanX) ** 2
  }
  return { rate: round2((num / den) * 7), count: n, from }
}

/**
 * Le rythme face à la zone cible : 'below', 'within' ou 'above'.
 * Sans rythme ou sans cible, rien à dire (`null`).
 */
export function rateStatus(rate, target) {
  if (rate == null || !target) return null
  if (rate < target.min - 1e-9) return 'below'
  if (rate > target.max + 1e-9) return 'above'
  return 'within'
}

/** Jours depuis la dernière pesée ; `null` s'il n'y en a jamais eu. */
export function daysSinceLastWeighIn(weights, todayKey) {
  const list = weights || []
  if (list.length === 0) return null
  return daysBetween(list[list.length - 1].date, todayKey)
}

/**
 * Faut-il rappeler de se peser ? Au bout de trois jours sans pesée. Jamais pour
 * un profil qui ne s'est encore jamais pesé : l'écran de pesée le dit déjà.
 */
export const WEIGH_IN_REMINDER_DAYS = 3

export function needsWeighIn(weights, todayKey) {
  const days = daysSinceLastWeighIn(weights, todayKey)
  return days !== null && days >= WEIGH_IN_REMINDER_DAYS
}
