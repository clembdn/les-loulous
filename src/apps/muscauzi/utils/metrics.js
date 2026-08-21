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

// « 60 kg × 8 · 60 × 8 · 55 × 8 » — le rappel compact de la dernière fois.
export function formatSets(sets, { unit = 'kg' } = {}) {
  if (!sets || sets.length === 0) return null
  return sets
    .map((s, i) => (i === 0 ? `${s.weightKg} ${unit} × ${s.reps}` : `${s.weightKg} × ${s.reps}`))
    .join(' · ')
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
