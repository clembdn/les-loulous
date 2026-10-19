import { entryRange } from './repRange.js'
import { passagesByExercise } from './previous.js'

/**
 * La BARRE D'XP — quand monter la charge.
 *
 * ── La règle ────────────────────────────────────────────────────────────────
 *
 * Double progression : on reste à la même charge tant que toutes les séries
 * n'ont pas atteint le haut de la fourchette. Barre pleine, on monte — du plus
 * petit cran de l'appareil (le pas de l'exercice), jamais de plus de ~5 % de la
 * charge sauf quand un seul cran les dépasse déjà (cf. `loadJump`). La barre
 * mesure le chemin parcouru entre le bas et le haut de la fourchette, série par
 * série, À LA CHARGE DU NIVEAU : une série plus légère ne compte pas, une série
 * plus lourde réussie compte pour ce qu'elle vaut à cette charge.
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
 * Ce que vaut une série plus lourde, en reps à la charge du niveau.
 *
 * Epley : 1RM ≈ charge × (1 + reps/30) — la mesure de `setScore`
 * (utils/metrics.js). Dix reps à 17,5 kg valent ainsi seize reps à 15 kg. Arrondi vers le bas : le coach ne crédite pas ce qui n'est
 * qu'à moitié fait.
 */
export function equivalentReps(weightKg, reps, refLoad) {
  if (!(refLoad > 0)) return reps
  return Math.max(0, Math.floor(30 * ((weightKg * (1 + reps / 30)) / refLoad - 1) + EPS))
}

/**
 * L'XP d'un passage, entre 0 et 1, jugé à la charge du NIVEAU (`refLoad`).
 *
 * Par défaut, le niveau est la charge de travail du passage : l'historique se
 * lit tel qu'il a été fait. Pour la séance du jour, c'est la charge que le
 * coach a demandée (cf. `targetLoad`) — sinon 12 reps à 5 kg rempliraient une
 * barre à 15 kg.
 *
 * On prend les N premières séries à `refLoad` OU AU-DESSUS (N = séries prévues
 * ce jour-là) ; une série plus légère ne compte pas, une série manquante
 * compte 0. Chaque série retenue est créditée :
 *
 * - à la charge du niveau : de ses reps ;
 * - plus lourde ET dans la fourchette (reps ≥ bas) : de ses reps converties à
 *   la charge du niveau (`equivalentReps`). Sous le bas, c'est une tentative,
 *   pas une preuve : elle garde ses vraies reps ;
 * - au poids du corps, le lest ne se convertit pas (la masse totale nous
 *   échappe) : ses vraies reps.
 *
 * Puis trois cas :
 *
 * - fourchette (6–10) : chaque série vaut ce qu'elle a gagné au-dessus du bas,
 *   plafonné au haut ; la somme se rapporte à N × (haut − bas) ;
 * - nombre fixe (min = max) : la part des séries qui ont atteint ce nombre ;
 * - poids du corps NON lesté : le total des reps de ces N séries rapporté à
 *   N × haut. Le lest, lui, se traite comme n'importe quelle charge.
 *
 * @param {{ sets, prescribedSets, range: { min, max } }} passage
 * @param {{ bodyweight?, refLoad? }} options
 * @returns {null | { load, lifted, reps, done, xp, full, allBelowMin }}
 *   `load` : la charge du niveau · `lifted` : la charge de travail réellement
 *   soulevée · `reps` : les N valeurs créditées, manquantes à 0 · `done` : les
 *   séries réellement faites à la charge du niveau (la « perf à battre »).
 */
export function passageXp(passage, { bodyweight = false, refLoad } = {}) {
  const lifted = workingLoad(passage?.sets)
  if (lifted === null) return null
  const load = refLoad != null && Number.isFinite(Number(refLoad)) ? roundKg(refLoad) : lifted

  const n = Math.max(1, Math.round(Number(passage.prescribedSets) || 1))
  const { min, max } = passage.range
  const counted = passage.sets
    .filter((s) => Number(s?.reps) > 0 && roundKg(s.weightKg) >= load - EPS)
    .slice(0, n)
  const credited = counted.map((s) => {
    const r = Number(s.reps)
    const w = roundKg(s.weightKg)
    if (bodyweight || w <= load + EPS || r < min) return r
    return equivalentReps(w, r, load)
  })
  const reps = Array.from({ length: n }, (_, i) => credited[i] || 0)
  const done = counted
    .filter((s) => Math.abs(roundKg(s.weightKg) - load) < EPS)
    .map((s) => Number(s.reps))

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
    lifted,
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
 * Les séances d'une SEMAINE ALLÉGÉE sont écartées : une série de moins par
 * exercice, voulue, ne doit ni vider la barre ni compter comme une montée
 * (cf. utils/lightWeek.js). La suggestion repart de la dernière vraie séance.
 *
 * @param {Array} sessions  séances normalisées, triées par date croissante
 * @param {string} beforeDate  exclue, ainsi que tout ce qui suit
 * @param {Function} [rangeOf]  (exerciseId) => { min, max } | undefined
 * @returns {Object} { [exerciseId]: [{ date, prescribedSets, range, sets }] }
 */
export function buildPassageIndex(sessions, beforeDate, rangeOf) {
  const out = {}
  const counted = (sessions || []).filter((s) => !s?.lightWeek)
  for (const [exerciseId, passages] of Object.entries(passagesByExercise(counted, beforeDate))) {
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

// Monter : ~5 % de la charge au plus. Redescendre : ~10 %.
const JUMP_UP = 0.05
const JUMP_DOWN = 0.1

/**
 * De combien changer la charge : un multiple du cran, jamais moins d'un cran,
 * et pas plus de `ratio` de la charge quand plusieurs crans y tiennent.
 *
 * Un pas fixe ne convient à aucune charge : 7 kg, c'est +9 % à 80 kg mais +47 %
 * à 15 kg — de quoi tomber sous le bas de la fourchette, vider la barre et
 * redescendre deux séances plus tard. À 15 kg on monte d'un cran (2,5) ; à
 * 100 kg, de deux (5).
 */
export function loadJump(load, step, ratio) {
  if (!(step > 0)) return 0
  const crans = Math.max(1, Math.floor(((Number(load) || 0) * ratio + EPS) / step))
  return roundKg(crans * step)
}

/**
 * Où en est un mouvement, et que faire aujourd'hui.
 *
 * @param {Array} passages  cf. `buildPassageIndex`, du plus ancien au plus récent
 * @param {{ incrementKg, bodyweight }} options
 * @returns {{ last, level, suggestion: { kind, load } }}
 *
 * `level` : le nombre de montées VALIDÉES — une charge en hausse alors que la
 * barre du passage précédent était pleine, ou que le nouveau passage, jugé à
 * l'ancienne charge, la remplit (monter d'emblée et réussir prouve le niveau
 * d'avant). Monter et rater ne fait pas gagner de niveau.
 *
 * `suggestion.kind`, par priorité :
 * - `deload`  : redescendre d'environ 10 % (cf. `needsDeload`, `loadJump`) ;
 * - `levelUp` : barre pleine → charge + un saut (cf. `loadJump`) ;
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
    const [before, now] = [scored[i - 1], scored[i]]
    if (now.load <= before.load + EPS) continue
    if (before.full || passageXp(now, { bodyweight, refLoad: before.load })?.full) level += 1
  }

  const last = scored.length > 0 ? scored[scored.length - 1] : null
  const step = Math.max(0, Number(incrementKg) || 0)

  let suggestion
  if (!last) suggestion = { kind: 'first', load: null }
  else if (step > 0 && needsDeload(scored)) {
    suggestion = { kind: 'deload', load: roundKg(Math.max(0, last.load - loadJump(last.load, step, JUMP_DOWN))) }
  } else if (last.full) {
    suggestion = step > 0
      ? { kind: 'levelUp', load: roundKg(last.load + loadJump(last.load, step, JUMP_UP)) }
      : { kind: 'full', load: last.load }
  } else suggestion = { kind: 'stay', load: last.load }

  return { last, level, suggestion }
}

/**
 * La charge du niveau pour la séance du jour : celle que le coach demande.
 *
 * Monter ou redescendre → la charge conseillée ; sinon celle de la dernière
 * séance. `undefined` sans historique : la barre se juge alors à la charge du
 * jour, faute de mieux.
 */
export function targetLoad(progress) {
  const s = progress?.suggestion
  if ((s?.kind === 'levelUp' || s?.kind === 'deload') && s.load != null) return s.load
  return progress?.last ? progress.last.load : undefined
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
