import { doneSets } from './sets.js'

/**
 * Les RECORDS personnels — la meilleure série jamais faite sur un mouvement.
 *
 * ── Pourquoi ce n'est pas « mieux que la dernière fois » ────────────────────
 *
 * Le badge « Mieux » compare à la séance précédente. C'est le bon signal au
 * quotidien, mais il s'allume aussi quand on remonte d'une semaine creuse, et
 * il ne dit jamais qu'on vient de battre son meilleur chiffre de l'année. Les
 * deux répondent à deux questions ; celle-ci est la question qui donne envie de
 * pousser la série de plus.
 *
 * ── Le piège, le même que pour « la dernière fois » ─────────────────────────
 *
 * Un record calculé sur TOUT l'historique, séance du jour comprise, se bat
 * lui-même : la première série du jour devient le record, et la deuxième ne
 * peut plus rien annoncer. `dateKey` est donc exclue du calcul — le record
 * qu'on affiche est celui d'AVANT aujourd'hui, et c'est lui qu'on cherche à
 * dépasser.
 *
 * ── Ce qui fait la valeur d'une série ───────────────────────────────────────
 *
 * `score` est fourni par l'appelant (`setScore` de `utils/metrics.js`) : au
 * poids du corps c'est le nombre de répétitions, sinon l'estimation de charge
 * maximale, qui tranche entre 70 × 5 et 60 × 8. La règle ne se redéfinit pas
 * ici, elle se réutilise.
 */

/**
 * @param {Array} sessions   séances normalisées, triées par date croissante
 * @param {string} excludeDate  date à écarter (la séance en cours)
 * @param {Function} scoreOf  (set, exerciseId) => number
 * @returns {Object} { [exerciseId]: { set, score, date } }
 */
export function buildRecordIndex(sessions, excludeDate, scoreOf) {
  const out = {}
  for (const session of sessions || []) {
    if (!session?.date || session.date === excludeDate) continue
    for (const entry of Object.values(session.entries || {})) {
      if (!entry?.exerciseId) continue
      for (const set of doneSets(entry)) {
        const score = scoreOf(set, entry.exerciseId)
        if (!(score > 0)) continue
        const current = out[entry.exerciseId]
        // Strictement supérieur : à égalité, on garde la PLUS ANCIENNE. Un
        // record est une date autant qu'un chiffre, et refaire exactement le
        // même n'est pas le battre.
        if (!current || score > current.score) {
          out[entry.exerciseId] = { set: { weightKg: set.weightKg, reps: set.reps }, score, date: session.date }
        }
      }
    }
  }
  return out
}

/**
 * Cette série bat-elle le record ?
 *
 * Sans record établi, on ne dit rien : une première série n'est pas un exploit,
 * et un badge sur chaque premier passage ne voudrait plus rien dire.
 */
export function beatsRecord(score, record) {
  if (!record || !(record.score > 0)) return false
  return score > record.score
}
