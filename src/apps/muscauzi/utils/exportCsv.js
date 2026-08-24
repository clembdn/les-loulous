import { downloadText } from '@/shared/lib/download.js'
import { toLocalDateKey, fromLocalDateKey, dayLabel, isoDayOfWeek } from '@/shared/lib/dates.js'
import { doneSets, sessionLineup } from '../services/sessionsService.js'
import { getExerciseType, isBodyweight } from '../config/exercises.js'
import { setScore } from './metrics.js'

/**
 * Export CSV des performances.
 *
 * ── Pourquoi PAS la convention de FinAuzi ───────────────────────────────────
 *
 * L'export de trésorerie sépare au point-virgule, écrit les décimales à la
 * virgule et pose une marque d'ordre des octets : c'est ce qu'Excel en français
 * attend, et c'est le bon choix pour un fichier qu'on ouvre à la main.
 *
 * Celui-ci est fait pour être LU PAR UNE MACHINE. Virgule séparatrice, point
 * décimal, pas de marque d'ordre des octets : la forme que `read_csv` et
 * n'importe quel modèle attendent par défaut, sans avoir à deviner le dialecte.
 * Ouvert dans un Excel français, il tiendra en une seule colonne — c'est le
 * compromis assumé.
 *
 * ── Une ligne par SÉRIE ─────────────────────────────────────────────────────
 *
 * Le grain le plus fin, jamais des totaux : d'une série on redéduit une séance,
 * un exercice, un mois. L'inverse est impossible. Chaque ligne se suffit à
 * elle-même — elle porte sa date, sa séance et son exercice — pour qu'aucune
 * lecture n'ait besoin de recroiser deux fichiers.
 */
const SEP = ','

const SET_HEADERS = [
  'date', 'seance', 'jour_semaine', 'semaine',
  'exercice_id', 'exercice', 'type',
  'occurrence', 'serie', 'charge_kg', 'repetitions', 'volume_kg', 'rm_estime_kg',
]

const PARITY_LABEL = { even: 'paire', odd: 'impaire' }

// RFC 4180 : on ne cite que si nécessaire, et un guillemet interne se double.
function cell(value) {
  if (value == null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function row(values) {
  return values.map(cell).join(SEP)
}

// Point décimal, et pas de zéros inutiles : « 62.5 », « 60 ».
function num(value, decimals = 2) {
  if (!Number.isFinite(value)) return ''
  return String(Number(value.toFixed(decimals)))
}

/**
 * `exerciseById` sert à retrouver le nom VIVANT du mouvement.
 *
 * Chaque entrée a figé le sien le jour de la saisie — ce qu'il faut pour relire
 * l'historique tel qu'il était. Mais pour une analyse, renommer un exercice
 * couperait sa progression en deux séries de lignes sans lien apparent. On
 * exporte donc le nom actuel, et `exercice_id` reste la clé de regroupement
 * qui, elle, ne change jamais.
 */
export function buildSetsCsv(sessions, exerciseById) {
  const lines = [row(SET_HEADERS)]

  for (const session of sessions) {
    const date = fromLocalDateKey(session.date)
    const dow = session.dayOfWeek || isoDayOfWeek(date)
    // Combien de fois ce mouvement est déjà apparu dans CETTE séance : c'est
    // ce qui distingue deux passages du même exercice le même jour.
    const seen = {}

    for (const entry of sessionLineup(session)) {
      const sets = doneSets(entry)
      if (sets.length === 0) continue

      const exercise = exerciseById?.[entry.exerciseId] || null
      seen[entry.exerciseId] = (seen[entry.exerciseId] || 0) + 1
      const bodyweight = isBodyweight(exercise)

      for (const set of sets) {
        lines.push(row([
          session.date,
          session.name || '',
          dayLabel(dow).toLowerCase(),
          PARITY_LABEL[session.parity] || '',
          entry.exerciseId || '',
          exercise?.name || entry.name || '',
          exercise ? getExerciseType(exercise.type).label : '',
          seen[entry.exerciseId],
          set.rank + 1,
          num(set.weightKg, 2),
          set.reps,
          num(set.weightKg * set.reps, 2),
          // Une estimation de charge maximale n'a pas de sens sans charge :
          // au poids du corps, la colonne reste vide plutôt que de porter un
          // zéro qu'on lirait comme une mesure.
          bodyweight ? '' : num(setScore(set, exercise), 1),
        ]))
      }
    }
  }

  return lines.join('\n')
}

export function buildWeightsCsv(weights) {
  const lines = [row(['date', 'poids_kg'])]
  for (const weight of weights) lines.push(row([weight.date, num(weight.value, 1)]))
  return lines.join('\n')
}

function save(name, content) {
  // Pas de marque d'ordre des octets : cf. l'en-tête de ce fichier.
  downloadText(`muscauzi-${name}-${toLocalDateKey(new Date())}.csv`, content, {
    type: 'text/csv;charset=utf-8;',
  })
}

export function downloadSetsCsv(sessions, exerciseById) {
  save('series', buildSetsCsv(sessions, exerciseById))
}

export function downloadWeightsCsv(weights) {
  save('pesees', buildWeightsCsv(weights))
}
