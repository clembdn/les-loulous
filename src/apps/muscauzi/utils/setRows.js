import { formatWeight } from './metrics.js'

/**
 * Le brouillon de saisie d'un exercice — les lignes de séries à l'écran.
 *
 * Sorti du composant parce que les échauffements l'ont rendu non trivial : une
 * ligne peut passer d'échauffement à série de travail et retour, et l'écran
 * doit toujours garder AU MOINS les N séries de travail prescrites. Pur, donc
 * testé.
 *
 *   row = { warmup, weightKg: '62,5', reps: '8' }
 *
 * Les champs sont des CHAÎNES : c'est ce que l'utilisateur tape, virgule
 * comprise. Rien n'y est jamais pré-rempli : la charge conseillée par la barre
 * d'XP s'affiche en placeholder, et ne s'écrit que sur un geste (la pastille,
 * « Répéter »). Une série non faite ne peut pas s'enregistrer toute seule.
 *
 * Le RANG d'une série enregistrée est sa position dans les lignes. Les trous
 * (série 1 et 3 saisies, pas la 2) sont conservés d'un rechargement à l'autre.
 */

// Relire une charge doit rendre exactement ce qu'on a tapé : « 62,5 », pas
// « 62.5 ». Le champ accepte les deux, mais n'en affiche qu'une.
export function toField(value, decimal = false) {
  if (!(value > 0)) return ''
  return decimal ? formatWeight(value) : String(value)
}

export function parseNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function blank(warmup = false) {
  return { warmup, weightKg: '', reps: '' }
}

/** Rien de saisi sur la ligne. */
export function isBlank(row) {
  return row.reps === '' && row.weightKg === ''
}

function workingCount(rows) {
  return rows.filter((r) => !r.warmup).length
}

/**
 * Garde exactement assez de séries de travail : au moins N, et pas de ligne de
 * travail VIDE en trop au bout (celle qu'on avait ajoutée pour compenser un
 * échauffement qu'on vient de dé-marquer).
 */
function settle(rows, prescribedSets) {
  const next = [...rows]
  let working = workingCount(next)
  while (working < prescribedSets) {
    next.push(blank())
    working += 1
  }
  while (working > prescribedSets) {
    const last = next[next.length - 1]
    if (!last || last.warmup || !isBlank(last)) break
    next.pop()
    working -= 1
  }
  return next
}

/**
 * Les lignes affichées à l'ouverture : les séries enregistrées à leur rang, puis
 * de quoi atteindre N séries de travail.
 */
export function buildRows({ prescribedSets, entry }) {
  const stored = new Map((entry?.sets || []).map((s) => [s.rank, s]))
  const lastRank = stored.size > 0 ? Math.max(...stored.keys()) : -1

  let rows = Array.from({ length: lastRank + 1 }, (_, rank) => {
    const saved = stored.get(rank)
    if (!saved) return blank()
    return {
      warmup: saved.warmup === true,
      weightKg: toField(saved.weightKg, true),
      reps: toField(saved.reps),
    }
  })

  // Un trou vide en trop vient d'une ligne jamais remplie — typiquement un
  // échauffement ajouté en tête puis laissé vide, qui a décalé les rangs. Il
  // reviendrait comme une série de travail fantôme : on le retire.
  while (workingCount(rows) > prescribedSets) {
    const i = rows.findIndex((r) => !r.warmup && isBlank(r))
    if (i === -1) break
    rows = rows.filter((_, j) => j !== i)
  }

  return settle(rows, prescribedSets)
}

/** Ce qui s'enregistre : tout ce qui porte une saisie. */
export function toSets(rows) {
  const out = []
  rows.forEach((row, rank) => {
    const weightKg = parseNumber(row.weightKg)
    const reps = Math.round(parseNumber(row.reps))
    if (reps <= 0 && weightKg <= 0) return
    const set = { rank, weightKg, reps }
    if (row.warmup) set.warmup = true
    out.push(set)
  })
  return out
}

/**
 * Le numéro de chaque ligne. Les échauffements n'en ont pas (« É ») et ne
 * décalent pas les séries de travail : la première série de travail reste la
 * « 1 », quel que soit le nombre d'échauffements devant.
 */
export function rowLabels(rows, prescribedSets) {
  let work = 0
  return rows.map((row) => {
    if (row.warmup) return { warmup: true, number: null, workIndex: null, extra: false }
    work += 1
    return { warmup: false, number: work, workIndex: work - 1, extra: work > prescribedSets }
  })
}

export function setField(rows, index, field, value) {
  return rows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
}

/** Valide une ligne avec les valeurs données (tapées ou proposées). */
export function fillRow(rows, index, { weightKg, reps }) {
  return rows.map((r, i) => (i === index
    ? { ...r, weightKg: toField(weightKg, true), reps: toField(reps) }
    : r))
}

/** Annule une série : la ligne redevient vide. */
export function clearRow(rows, index) {
  return rows.map((r, i) => (i === index ? blank(r.warmup) : r))
}

export function toggleWarmup(rows, index, { prescribedSets }) {
  const next = rows.map((r, i) => (i === index ? { ...r, warmup: !r.warmup } : r))
  return settle(next, prescribedSets)
}

/** Un échauffement s'ajoute EN TÊTE : c'est là qu'il se fait. */
export function addWarmup(rows) {
  return [blank(true), ...rows]
}

export function addSet(rows) {
  return [...rows, blank()]
}

export function removeRow(rows, index) {
  return rows.filter((_, i) => i !== index)
}
