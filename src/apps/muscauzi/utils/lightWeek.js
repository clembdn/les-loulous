import { shiftDateKey } from '../../../shared/lib/dates.js'

/**
 * La SEMAINE ALLÉGÉE — souffler sans rien défaire.
 *
 * Pendant 7 jours à partir du jour où on la lance, chaque exercice du
 * programme compte une série de moins, sans descendre sous deux. Ni le
 * programme ni les charges ne bougent : on fait moins, pas plus léger.
 *
 * Les séances de cette semaine sont MARQUÉES (`session.lightWeek`) et la barre
 * d'XP les ignore : trois séries au lieu de quatre videraient la barre d'une
 * semaine qu'on a justement voulue plus facile, et la suggestion d'après doit
 * repartir de la dernière vraie séance.
 *
 * Pur : se teste.
 */
export const LIGHT_WEEK_DAYS = 7

/** Le dernier jour de la semaine allégée lancée le jour `start`. */
export function lightWeekEnd(start) {
  return shiftDateKey(start, LIGHT_WEEK_DAYS - 1)
}

/** `dateKey` tombe-t-il dans la semaine allégée lancée le jour `start` ? */
export function isInLightWeek(dateKey, start) {
  if (!start || !dateKey) return false
  return dateKey >= start && dateKey <= lightWeekEnd(start)
}

/**
 * Une série de moins, jamais sous deux — et jamais PLUS qu'avant : un exercice
 * prescrit en une seule série le reste.
 */
export function lightSets(sets) {
  const n = Math.max(1, Math.round(Number(sets) || 1))
  return n <= 2 ? n : n - 1
}
