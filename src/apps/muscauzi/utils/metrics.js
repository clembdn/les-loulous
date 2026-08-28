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
 * À QUELLE séance passée comparer celle qu'on vient de finir ?
 *
 * Par son NOM d'abord. C'est la seule identité stable d'une séance : « Push »
 * reste « Push » qu'on le fasse le dimanche ou le mardi, qu'on en change
 * l'ordre ou qu'on y ajoute un exercice.
 *
 * À défaut de nom, par la même CASE du programme — même parité, même jour. En
 * alternance paire/impaire, c'est la séance d'il y a deux semaines, qui est
 * bien la même. Comparer simplement à la séance précédente, quelle qu'elle
 * soit, ne mesurait que l'alternance du programme : un jour de jambes pèse
 * trois fois le volume d'un jour de bras, et l'écart affiché n'apprenait rien.
 *
 * Rien de comparable ? On ne compare pas. Un écart inventé vaut moins que pas
 * d'écart du tout.
 *
 * `sessions` est attendu trié par date croissante et déjà filtré sur les
 * séances qui portent du travail.
 */
export function pickReferenceSession(sessions, { name, parity, dayOfWeek }) {
  const lastOf = (list) => (list.length > 0 ? list[list.length - 1] : null)

  if (name) {
    const sameName = lastOf(sessions.filter((s) => s.name === name))
    if (sameName) return { session: sameName, by: 'name' }
  }
  const sameSlot = lastOf(
    sessions.filter((s) => s.parity === parity && s.dayOfWeek === dayOfWeek),
  )
  if (sameSlot) return { session: sameSlot, by: 'slot' }
  return null
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
 * Index de l'historique PAR MOUVEMENT : combien de fois, et les dernières fois.
 *
 * Dérivé de l'historique des séances lui-même. Un cache dénormalisé a existé
 * pour éviter cette relecture ; il était réécrit au fil de la saisie et
 * contenait donc déjà les chiffres du jour au moment où on l'interrogeait. Ce
 * qui a été fait ne se lit que dans les séances.
 *
 * Les occurrences d'un même mouvement DANS UNE MÊME SÉANCE sont mises bout à
 * bout, comme le font déjà `historyForExercise` et `workByExercise` : un jour
 * où l'on passe deux fois sur le développé reste un jour, pas deux.
 *
 * `keep` borne le nombre de passages conservés, du plus récent au plus ancien.
 * Deux suffisent pour dire « mieux que la dernière fois » ; l'index ne garde
 * pas tout l'historique en mémoire pour autant.
 */
export function exerciseHistoryIndex(sessions, keep = 2) {
  const out = {}
  // `sessions` est trié par date croissante : on empile en tête, donc le plus
  // récent finit en première position.
  for (const session of sessions) {
    const ofDay = {}
    for (const entry of Object.values(session.entries)) {
      if (!entry.exerciseId) continue
      const done = doneSets(entry)
      if (done.length === 0) continue
      if (!ofDay[entry.exerciseId]) ofDay[entry.exerciseId] = []
      ofDay[entry.exerciseId].push(...done)
    }
    for (const [exerciseId, sets] of Object.entries(ofDay)) {
      if (!out[exerciseId]) out[exerciseId] = { count: 0, recent: [] }
      const item = out[exerciseId]
      item.count += 1
      item.recent.unshift({ date: session.date, sets })
      if (item.recent.length > keep) item.recent.length = keep
    }
  }
  return out
}

/**
 * Dernière séance avec du travail réel, par exercice.
 *
 * Dérivé de l'index ci-dessus pour qu'il n'existe qu'UNE définition de « la
 * dernière fois ». Elle agrège désormais les passages multiples d'un même jour,
 * ce que cette fonction ne faisait pas : le bilan de fin de séance comparait
 * alors un total agrégé (aujourd'hui) à un total qui ne l'était pas (avant),
 * et annonçait un progrès dès qu'on avait fait l'exercice deux fois la fois
 * précédente.
 */
export function latestByExercise(sessions) {
  const index = exerciseHistoryIndex(sessions, 1)
  const out = {}
  for (const [exerciseId, item] of Object.entries(index)) out[exerciseId] = item.recent[0]
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
