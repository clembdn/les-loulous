// Temps de préparation indicatif : minutes → "20 min", "1 h", "1 h 30".
export function formatPrepTime(min) {
  if (min == null || min <= 0) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m}` : `${h} h`
}
