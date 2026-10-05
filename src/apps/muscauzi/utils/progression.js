import { entryRange } from './repRange.js'
import { passagesByExercise } from './previous.js'

/**
 * La BARRE D'XP — quand monter la charge.
 *
 * ── La règle ────────────────────────────────────────────────────────────────
 *
 * Double progression : on reste à la même charge tant que toutes les séries
 * n'ont pas atteint le haut de la fourchette. Barre pleine, on monte d'un cran
 * (le pas de l'exercice). La barre mesure le chemin parcouru entre le bas et le
 * haut de la fourchette, série par série.
 *
 * ── Tout se recalcule depuis les séances ────────────────────────────────────
 *
 * Aucun cache. Un cache de « dernière perf » a existé (`meta/lastPerf`) : réécrit
 * au fil de la saisie, il contenait déjà la séance du jour au moment où on le
 * consultait, et le repère se transformait en la série qu'on venait de taper.
 * Ici, comme dans `previous.js` et `records.js`, la date affichée et tout ce qui
 * suit sont exclus : ce qu'on fait aujourd'hui ne se juge pas lui-même.
 *
 * Les échauffements n'entrent jamais en compte — ils sont écartés en amont par
 * `doneSets`, que traverse le regroupement partagé avec « la dernière fois »
 * (`passagesByExercise`, utils/previous.js).
 *
 * Pur, sans Firestore ni React : se teste.
 */

// Comparaisons de charges : 62,5 + 2,5 doit valoir 65, pas 64,99999.
const EPS = 1e-6

export function roundKg(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

/**
 * La charge de TRAVAIL d'un passage : celle du plus grand nombre de séries.
 *
 * Ni la plus lourde (une série tentée à 30 kg après trois à 25 ne fait pas de
 * 30 kg la charge du jour), ni la dernière. En cas d'égalité, la plus lourde.
 * `null` quand il n'y a aucune série.
 */
export function workingLoad(sets) {
  const counts = new Map()
  for (const s of sets || []) {
    if (!(Number(s?.reps) > 0)) continue
    const load = roundKg(s.weightKg)
    counts.set(load, (counts.get(load) || 0) + 1)
  }
  let best = null
  let bestCount = 0
  for (const [load, count] of counts) {
    if (count > bestCount || (count === bestCount && load > best)) {
      best = load
      bestCount = count
    }
  }
  return best
}

/**
 * L'XP d'un passage, entre 0 et 1.
 *
 * On prend les N premières séries à la charge de travail (N = séries prévues ce
 * jour-là) ; une série manquante compte 0. Trois cas :
 *
 * - fourchette (6–10) : chaque série vaut ce qu'elle a gagné au-dessus du bas,
 *   plafonné au haut ; la somme se rapporte à N × (haut − bas) ;
 * - nombre fixe (min = max) : la part des séries qui ont atteint ce nombre ;
 * - poids du corps NON lesté : le total des reps de ces N séries rapporté à
 *   N × haut. Le lest, lui, se traite comme n'importe quelle charge.
 *
 * @param {{ sets, prescribedSets, range: { min, max } }} passage
 * @returns {null | { load, reps, done, xp, full, allBelowMin }}
 *   `reps` : les N valeurs, manquantes à 0 · `done` : les séries réellement
 *   faites à la charge de travail (la « perf à battre »).
 */
export function passageXp(passage, { bodyweight = false } = {}) {
  const load = workingLoad(passage?.sets)
  if (load === null) return null

  const n = Math.max(1, Math.round(Number(passage.prescribedSets) || 1))
  const { min, max } = passage.range
  const done = passage.sets
    .filter((s) => Number(s?.reps) > 0 && Math.abs(roundKg(s.weightKg) - load) < EPS)
    .slice(0, n)
    .map((s) => Number(s.reps))
  const reps = Array.from({ length: n }, (_, i) => done[i] || 0)

  let xp
  if (bodyweight && load === 0) {
    xp = Math.min(reps.reduce((acc, r) => acc + r, 0) / (n * max), 1)
  } else if (min === max) {
    xp = reps.filter((r) => r >= max).length / n
  } else {
    const span = max - min
    xp = reps.reduce((acc, r) => acc + Math.min(Math.max(r - min, 0), span), 0) / (n * span)
  }

  return {
    load,
    reps,
    done,
    xp,
    full: xp >= 1 - EPS,
    allBelowMin: reps.every((r) => r < min),
  }
}

/**
 * Les passages de chaque mouvement, du plus ancien au plus récent, prêts pour
 * la barre d'XP.
 *
 * Le regroupement est celui de « la dernière fois » (`passagesByExercise`) : un
 * passage par DATE, les occurrences d'un même jour mises bout à bout. La
 * prescription (N, fourchette) est celle FIGÉE dans la première occurrence du
 * jour : changer le programme aujourd'hui ne réécrit pas le verdict d'hier.
 * Seule exception, les séances d'avant les fourchettes, qui n'en portent pas :
 * `rangeOf` leur prête celle du programme actuel (cf. `entryRange`).

 *
 * @param {Array} sessions  séances normalisées, triées par date croissante
 * @param {string} beforeDate  exclue, ainsi que tout ce qui suit
 * @param {Function} [rangeOf]  (exerciseId) => { min, max } | undefined
 * @returns {Object} { [exerciseId]: [{ date, prescribedSets, range, sets }] }
 */
export function buildPassageIndex(sessions, beforeDate, rangeOf) {
  const out = {}
  for (const [exerciseId, passages] of Object.entries(passagesByExercise(sessions, beforeDate))) {
    out[exerciseId] = passages.map(({ date, entries, sets }) => ({
      date,
      prescribedSets: entries[0].prescribedSets,
      range: entryRange(entries[0], rangeOf?.(exerciseId)),
      sets: sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })),
    }))
  }
  return out
}

/**
 * Faut-il redescendre ? Oui si les deux dernières séances sont à la MÊME
 * charge et que, dans chacune, toutes les séries sont restées sous le bas de
 * la fourchette. Une seule mauvaise séance ne suffit pas : c'est la deuxième
 * qui dit que la charge est trop lourde, pas la fatigue d'un jour.
 */
function needsDeload(scored) {
  const n = scored.length
  if (n < 2) return false
  const [before, last] = [scored[n - 2], scored[n - 1]]
  if (!(last.load > 0) || Math.abs(before.load - last.load) >= EPS) return false
  return before.allBelowMin && last.allBelowMin
}

/**
 * Où en est un mouvement, et que faire aujourd'hui.
 *
 * @param {Array} passages  cf. `buildPassageIndex`, du plus ancien au plus récent
 * @param {{ incrementKg, bodyweight }} options
 * @returns {{ last, level, suggestion: { kind, load } }}
 *
 * `level` : le nombre de montées VALIDÉES — une charge en hausse alors que la
 * barre du passage précédent était pleine. Monter avant d'avoir rempli la
 * barre ne fait pas gagner de niveau.
 *
 * `suggestion.kind`, par priorité :
 * - `deload`  : redescendre d'un cran (cf. `needsDeload`) ;
 * - `levelUp` : barre pleine → charge + pas ;
 * - `full`    : barre pleine mais aucun pas réglé (poids du corps) ;
 * - `stay`    : rester à la même charge ;
 * - `first`   : aucun historique.
 */
export function exerciseProgress(passages, { incrementKg = 0, bodyweight = false } = {}) {
  const scored = []
  for (const passage of passages || []) {
    const result = passageXp(passage, { bodyweight })
    if (result) scored.push({ ...passage, ...result })
  }

  let level = 0
  for (let i = 1; i < scored.length; i += 1) {
    if (scored[i].load > scored[i - 1].load + EPS && scored[i - 1].full) level += 1
  }

  const last = scored.length > 0 ? scored[scored.length - 1] : null
  const step = Math.max(0, Number(incrementKg) || 0)

  let suggestion
  if (!last) suggestion = { kind: 'first', load: null }
  else if (step > 0 && needsDeload(scored)) {
    suggestion = { kind: 'deload', load: roundKg(Math.max(0, last.load - step)) }
  } else if (last.full) {
    suggestion = step > 0
      ? { kind: 'levelUp', load: roundKg(last.load + step) }
      : { kind: 'full', load: last.load }
  } else suggestion = { kind: 'stay', load: last.load }

  return { last, level, suggestion }
}

/**
 * L'index complet, un appel par écran.
 *
 * @param {Function} optionsOf  (exerciseId) => { incrementKg, bodyweight }
 * @param {Function} [rangeOf]  repli de fourchette, cf. `buildPassageIndex`
 */
export function buildProgressIndex(sessions, beforeDate, optionsOf, rangeOf) {
  const out = {}
  for (const [exerciseId, passages] of Object.entries(buildPassageIndex(sessions, beforeDate, rangeOf))) {
    out[exerciseId] = exerciseProgress(passages, optionsOf?.(exerciseId) || {})
  }
  return out
}

/**
 * A-t-on monté aujourd'hui avant d'avoir rempli la barre ?
 *
 * Un constat, pas un reproche : l'avertissement reste neutre. Se déclenche dès
 * que la charge de travail du jour dépasse la précédente alors que la barre
 * précédente n'était pas pleine.
 */
export function jumpedEarly(todaySets, progress) {
  const last = progress?.last
  if (!last || last.full) return false
  const today = workingLoad(todaySets)
  return today !== null && today > last.load + EPS
}

/** La charge conseillée est-elle atteinte par au moins une série de travail ? */
export function reachedLoad(sets, load) {
  if (!(load > 0)) return false
  return (sets || []).some((s) => Number(s?.reps) > 0 && roundKg(s.weightKg) >= load - EPS)
}
