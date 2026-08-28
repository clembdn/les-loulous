/**
 * Comparer une valeur à une référence — une seule définition pour toute l'appli.
 *
 * Elle était recopiée dans trois écrans (bilan de séance, tableau des
 * exercices, progression par séance), à chaque fois avec la même bande morte de
 * 1 % réécrite à la main. Trois copies, c'est trois occasions de faire diverger
 * ce que « stable » veut dire d'un écran à l'autre.
 *
 * ── Pourquoi une bande morte ────────────────────────────────────────────────
 *
 * Sans elle, 4 002 kg contre 4 000 kg s'annonce comme un progrès. Ce n'en est
 * pas un : c'est une demi-répétition d'écart sur une séance entière. En dessous
 * de 1 %, on dit « stable » — et une flèche qui ne bouge pas pour rien garde sa
 * valeur d'information quand elle bouge vraiment.
 */
const DEAD_BAND = 0.01

/**
 * @returns {{ direction: 'up'|'down'|'flat', delta: number, ratio: number }|null}
 *   `null` quand il n'y a rien à comparer — une première fois n'est pas un
 *   progrès, et un écart inventé vaut moins que pas d'écart du tout.
 */
export function compare(current, previous) {
  const now = Number(current) || 0
  const before = Number(previous) || 0
  if (before <= 0) return null

  const delta = now - before
  const ratio = delta / before
  const direction = Math.abs(ratio) < DEAD_BAND ? 'flat' : (ratio > 0 ? 'up' : 'down')
  return { direction, delta, ratio }
}

/** « +4,2 % » / « −1,8 % » / « stable » — l'écart, écrit. */
export function formatTrend(trend) {
  if (!trend) return null
  if (trend.direction === 'flat') return 'stable'
  const percent = Math.abs(trend.ratio * 100)
  // Une décimale seulement sous 10 % : au-delà, elle n'apprend plus rien.
  const shown = percent < 10 ? percent.toFixed(1).replace('.', ',') : String(Math.round(percent))
  return `${trend.direction === 'up' ? '+' : '−'}${shown} %`
}

export { DEAD_BAND }
