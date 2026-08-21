// Métriques de progression calculées à partir des séries d'une séance.

export function volume(sets) {
  return (sets || []).reduce((acc, s) => acc + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0)
}

export function totalReps(sets) {
  return (sets || []).reduce((acc, s) => acc + (Number(s.reps) || 0), 0)
}

// 1RM estimé (Epley) sur la MEILLEURE série de la séance.
export function epley(sets) {
  let best = 0
  for (const s of sets || []) {
    const w = Number(s.weight) || 0
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
  return exercise?.bodyweight ? [METRICS.reps] : [METRICS.volume, METRICS.epley]
}

export function defaultMetricId(exercise) {
  return exercise?.bodyweight ? 'reps' : 'volume'
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
    .map((s, i) => (i === 0 ? `${s.weight} ${unit} × ${s.reps}` : `${s.weight} × ${s.reps}`))
    .join(' · ')
}
