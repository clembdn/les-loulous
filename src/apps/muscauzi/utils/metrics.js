import { doneSets } from '../services/sessionsService.js'
import { isBodyweight } from '../config/exercises.js'

// Métriques de progression. Une série sans répétitions n'entre dans AUCUNE
// métrique — le filtrage est fait en amont par `doneSets`.

export function volume(sets) {
  return (sets || []).reduce((acc, s) => acc + (Number(s.weightKg) || 0) * (Number(s.reps) || 0), 0)
}

export function totalReps(sets) {
  return (sets || []).reduce((acc, s) => acc + (Number(s.reps) || 0), 0)
}

// 1RM estimé (Epley) sur la MEILLEURE série — jamais une somme ni une moyenne.
export function epley(sets) {
  let best = 0
  for (const s of sets || []) {
    const w = Number(s.weightKg) || 0
    const r = Number(s.reps) || 0
    if (w <= 0 || r <= 0) continue
    best = Math.max(best, w * (1 + r / 30))
  }
  return best
}

// Un exercice au poids du corps a un volume et un Epley nuls (charge = 0) :
// pour lui, la seule métrique qui progresse est le nombre total de reps.
export const METRICS = {
  volume: { id: 'volume', label: 'Volume', unit: 'kg', compute: volume },
  epley:  { id: 'epley',  label: '1RM est.', unit: 'kg', compute: epley },
  reps:   { id: 'reps',   label: 'Reps',   unit: '',   compute: totalReps },
}

export function metricsFor(exercise) {
  return isBodyweight(exercise) ? [METRICS.reps] : [METRICS.volume, METRICS.epley]
}

export function defaultMetricId(exercise) {
  return isBodyweight(exercise) ? 'reps' : 'volume'
}

export function formatMetric(value, metricId) {
  const m = METRICS[metricId] || METRICS.volume
  const rounded = m.id === 'epley' ? Math.round(value * 10) / 10 : Math.round(value)
  return m.unit ? `${rounded} ${m.unit}` : String(rounded)
}

/**
 * « 60 kg × 8 · 60 × 8 · 55 × 8 » — le rappel compact de la dernière fois.
 *
 * L'unité n'est écrite que sur la première série : répétée quatre fois, elle
 * noie les chiffres qu'on est venu lire.
 *
 * Le POIDS DU CORPS a sa propre écriture. Sa charge vaut 0, et le format
 * commun affichait donc « 0 kg × 12 » — un zéro qui se lit comme une erreur de
 * saisie. Non lesté, seules les répétitions sont dites ; lesté, le lest est
 * signé (« +10 kg ») pour qu'on ne le confonde pas avec une charge totale.
 */
/**
 * Une charge, écrite en français : 62,5 — jamais 62.5.
 *
 * Le champ de saisie accepte déjà la virgule, mais ce qui revenait de Firestore
 * était un nombre relu par `String()`, donc pointé. Taper « 62,5 » puis
 * recharger l'écran changeait le séparateur sous les yeux : deux écritures pour
 * une même charge, dont aucune n'était fausse — juste incohérentes.
 */
export function formatWeight(value) {
  return String(Number(value) || 0).replace('.', ',')
}

function formatOneSet(set, exercise, isFirst) {
  const weight = Number(set?.weightKg) || 0
  if (isBodyweight(exercise) && weight <= 0) {
    return isFirst ? `${set.reps} reps` : String(set.reps)
  }
  const shown = isBodyweight(exercise) ? `+${formatWeight(weight)}` : formatWeight(weight)
  return isFirst ? `${shown} kg × ${set.reps}` : `${shown} × ${set.reps}`
}

export function formatSets(sets, exercise) {
  if (!sets || sets.length === 0) return null
  return sets.map((s, i) => formatOneSet(s, exercise, i === 0)).join(' · ')
}

/**
 * Valeur d'UNE série, pour la comparer à une autre.
 *
 * Charge et répétitions ne se comparent pas terme à terme — 70 × 5 vaut-il
 * mieux que 60 × 8 ? Epley tranche en ramenant les deux à un maximum estimé.
 *
 * Au poids du corps, la charge est nulle et Epley rendrait 0 pour tout le
 * monde : seules les répétitions comptent. Le lest n'entre donc pas dans la
 * comparaison — passer de 12 reps à 12 reps + 10 kg n'est pas signalé.
 */
export function setScore(set, exercise) {
  const reps = Number(set?.reps) || 0
  if (reps <= 0) return 0
  if (isBodyweight(exercise)) return reps
  const weight = Number(set?.weightKg) || 0
  if (weight <= 0) return 0
  return weight * (1 + reps / 30)
}

export function bestScore(sets, exercise) {
  return (sets || []).reduce((best, s) => Math.max(best, setScore(s, exercise)), 0)
}

/**
 * A-t-on fait mieux que la dernière fois ?
 *
 * On compare la MEILLEURE série de chaque séance, pas leur somme : ajouter une
 * cinquième série n'est pas un progrès de force, et un jour où l'on s'arrête à
 * trois séries ne doit pas effacer un record établi sur la première.
 *
 * Sans référence, on ne dit rien : une première fois n'est pas un progrès.
 */
export function beatsPrevious(sets, previousSets, exercise) {
  const previous = bestScore(previousSets, exercise)
  if (previous <= 0) return false
  return bestScore(sets, exercise) > previous
}

/**
 * Ce qu'une séance pèse, en trois chiffres.
 *
 * Ce sont les seuls totaux comparables d'une séance à l'autre : ils ne
 * dépendent d'aucun exercice en particulier, donc changer un mouvement dans le
 * programme ne fait pas décrocher la comparaison.
 *
 * Le volume est nul pour une séance entièrement au poids du corps — c'est
 * exact, pas une panne : il n'y a pas de charge à additionner. L'affichage doit
 * donc savoir se taire plutôt qu'annoncer « 0 kg ».
 */
export function sessionTotals(session) {
  let volume = 0
  let sets = 0
  let reps = 0
  for (const entry of Object.values(session?.entries || {})) {
    for (const s of doneSets(entry)) {
      sets += 1
      reps += s.reps
      volume += s.weightKg * s.reps
    }
  }
  return { volume, sets, reps }
}

/**
 * Le travail d'une séance regroupé PAR MOUVEMENT.
 *
 * Un exercice présent deux fois dans la même séance ne doit pas produire deux
 * lignes : ses séries sont mises bout à bout, comme le fait déjà l'écran
 * Progrès. On garde le rang de sa PREMIÈRE occurrence pour retrouver l'ordre
 * dans lequel la séance a été faite.
 */
export function workByExercise(session) {
  const out = {}
  for (const entry of Object.values(session?.entries || {})) {
    const done = doneSets(entry)
    if (!entry.exerciseId || done.length === 0) continue
    const current = out[entry.exerciseId]
    if (current) {
      current.sets.push(...done)
      current.order = Math.min(current.order, entry.order)
    } else {
      out[entry.exerciseId] = {
        exerciseId: entry.exerciseId,
        name: entry.name,
        order: entry.order,
        sets: [...done],
      }
    }
  }
  return out
}

/** La série qui vaut le plus — celle qu'on montre pour résumer un mouvement. */
export function bestSet(sets, exercise) {
  let best = null
  let bestValue = 0
  for (const s of sets || []) {
    const value = setScore(s, exercise)
    if (value > bestValue) { bestValue = value; best = s }
  }
  return best
}

/**
 * Historique d'un MOUVEMENT : un point par date, jamais deux.
 *
 * Si le mouvement figure plusieurs fois dans la même séance, les séries de
 * toutes ses occurrences sont concaténées en une seule liste. Les trois
 * métriques se comportent alors correctement d'elles-mêmes : volume et reps
 * somment, Epley prend le maximum.
 */
/**
 * Dernière séance avec du travail réel, PAR EXERCICE — dérivé de l'historique
 * complet des séances, jamais du cache `lastPerf`.
 *
 * `lastPerf` est un simple raccourci d'écriture (pré-remplir la saisie du
 * jour sans relire tout l'historique) : il peut se désynchroniser — un
 * exercice supprimé puis recréé en base sans repasser par l'appli, par
 * exemple — et l'écran Progrès ne doit jamais dépendre de sa fraîcheur pour
 * décider ce qui a été fait.
 */
export function latestByExercise(sessions) {
  const out = {}
  // `sessions` est trié par date croissante : écraser au fil de l'itération
  // laisse la plus récente occurrence de chaque exercice.
  for (const session of sessions) {
    for (const entry of Object.values(session.entries)) {
      if (!entry.exerciseId) continue
      const done = doneSets(entry)
      if (done.length === 0) continue
      out[entry.exerciseId] = { date: session.date, sets: done }
    }
  }
  return out
}

export function historyForExercise(sessions, exerciseId) {
  const out = []
  for (const session of sessions) {
    const sets = []
    let occurrences = 0
    for (const entry of Object.values(session.entries)) {
      if (entry.exerciseId !== exerciseId) continue
      const done = doneSets(entry)
      if (done.length === 0) continue
      sets.push(...done)
      occurrences += 1
    }
    if (sets.length === 0) continue
    out.push({ date: session.date, sets, occurrences })
  }
  return out
}
