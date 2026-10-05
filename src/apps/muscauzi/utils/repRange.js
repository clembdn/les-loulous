/**
 * Fourchettes de répétitions — « 4 × 6–10 » plutôt que « 4 × 8 ».
 *
 * ── Pas de migration ────────────────────────────────────────────────────────
 *
 * Les programmes et les séances ne connaissaient qu'un nombre fixe (`reps`,
 * `prescribedReps`). Un document sans bornes explicites se relit comme une
 * fourchette fermée sur ce nombre : min = max = reps. Rien n'est réécrit, et
 * tout ce qui a été saisi avant se compare encore à tout ce qui vient après.
 *
 * Pur, sans Firestore ni React : se teste.
 */
export const MAX_REPS = 50

function toReps(value) {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n >= 1 ? Math.min(MAX_REPS, n) : 0
}

/**
 * La fourchette d'un document, ancien ou neuf.
 *
 * `fallback` est l'ancien nombre fixe : il vaut pour les deux bornes quand
 * elles manquent. Des bornes inversées sont remises dans l'ordre plutôt que
 * refusées — un document mal écrit doit rester lisible.
 */
export function normalizeRange(min, max, fallback) {
  const top = toReps(max) || toReps(fallback) || toReps(min) || 1
  const bottom = toReps(min) || top
  return bottom <= top ? { min: bottom, max: top } : { min: top, max: bottom }
}

/** « 10 » ou « 6–10 ». */
export function formatRepRange(range) {
  if (!range) return ''
  return range.min === range.max ? String(range.max) : `${range.min}–${range.max}`
}

/** « 4 × 6–10 » — la prescription telle qu'on la lit partout. */
export function formatPrescription(sets, range) {
  return `${sets} × ${formatRepRange(range)}`
}

/** L'entrée porte-t-elle sa propre fourchette, ou date-t-elle d'avant ? */
function hasOwnRange(entry) {
  return entry?.prescribedRepsMin != null || entry?.prescribedRepsMax != null
}

/**
 * La fourchette d'une entrée de séance (ou d'une ligne de séance), dans
 * l'ordre :
 *
 * 1. celle FIGÉE dans l'entrée — ce qui était prescrit ce jour-là ;
 * 2. à défaut (séance d'avant les fourchettes), `fallback` : la ligne de
 *    programme ACTUELLE du même exercice. Sans ce repli, toutes les anciennes
 *    séances se liraient en nombre fixe (« 4 × 10 »), et la barre d'XP
 *    jugerait la dernière séance contre une règle qui n'est plus la tienne ;
 * 3. à défaut, l'ancien nombre fixe : min = max = `prescribedReps`.
 */
export function entryRange(entry, fallback) {
  if (hasOwnRange(entry) || !fallback) {
    return normalizeRange(entry?.prescribedRepsMin, entry?.prescribedRepsMax, entry?.prescribedReps)
  }
  return normalizeRange(fallback.min, fallback.max, fallback.max)
}

/**
 * La fourchette de chaque exercice dans le programme actuel — le repli de
 * `entryRange`. Le programme de la semaine en cours d'abord, puis l'autre ;
 * pour un exercice présent plusieurs fois, sa première occurrence (lundi avant
 * mardi, dans l'ordre de la journée).
 *
 * @param {{ even, odd }} programs  programmes normalisés (cf. programService)
 * @returns {Object} { [exerciseId]: { min, max } }
 */
export function programRangeIndex(programs, parity = 'even') {
  const out = {}
  const order = parity === 'odd' ? ['odd', 'even'] : ['even', 'odd']
  for (const p of order) {
    for (const dow of [1, 2, 3, 4, 5, 6, 7]) {
      for (const line of programs?.[p]?.days?.[dow] || []) {
        if (!line?.exerciseId || out[line.exerciseId]) continue
        out[line.exerciseId] = normalizeRange(line.repsMin, line.repsMax, line.reps)
      }
    }
  }
  return out
}
