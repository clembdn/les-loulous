import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronDown, ChevronUp, Check, SkipForward, LineChart, RotateCcw, Plus, Trash2, TrendingUp, CopyCheck,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Progress } from '@/shared/ui/Progress.jsx'
import { weightHint } from '../../config/exercises.js'
import { doneSets, isEntryComplete } from '../../services/sessionsService.js'
import { beatsPrevious, formatWeight } from '../../utils/metrics.js'
import SetRow from './SetRow.jsx'
import ExerciseNote from './ExerciseNote.jsx'

// Relire une charge doit rendre exactement ce qu'on a tapé : « 62,5 », pas
// « 62.5 ». Le champ accepte les deux, mais n'en affiche qu'une.
function toField(value, decimal = false) {
  if (!(value > 0)) return ''
  return decimal ? formatWeight(value) : String(value)
}

function parseNumber(value) {
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Les lignes affichées : une par série prescrite, plus les séries ajoutées à la
 * main. Une série enregistrée à 0 revient comme un champ vide — un 0 stocké
 * veut dire « rien saisi », jamais « zéro kilo validé ».
 */
function buildRows(prescribedSets, entry) {
  const stored = new Map((entry?.sets || []).map((s) => [s.rank, s]))
  const lastRank = stored.size > 0 ? Math.max(...stored.keys()) : -1
  const count = Math.max(prescribedSets, lastRank + 1)

  return Array.from({ length: count }, (_, rank) => {
    const saved = stored.get(rank)
    return {
      rank,
      extra: rank >= prescribedSets,
      weightKg: saved ? toField(saved.weightKg, true) : '',
      reps: saved ? toField(saved.reps) : '',
    }
  })
}

function toSets(rows) {
  return rows
    .map((r) => ({ rank: r.rank, weightKg: parseNumber(r.weightKg), reps: Math.round(parseNumber(r.reps)) }))
    .filter((s) => s.weightKg > 0 || s.reps > 0)
}

// Délai avant enregistrement automatique : on tape trois chiffres d'affilée,
// on n'écrit qu'une fois. Le départ du champ et le repli écrivent tout de suite.
const AUTOSAVE_MS = 700

export default function ExerciseAccordion({
  line,
  // Entrée saisie hors de la prescription du jour : elle se retire d'un geste
  // au lieu de se marquer « non fait », qui la laisserait traîner.
  extra = false,
  exercise,
  entry,
  lastPerf,
  note,
  expanded,
  onToggle,
  onSave,
  onClear,
  onOpenDetail,
  onSaveNote,
  onRest,
}) {
  const lastSets = lastPerf?.sets || null

  /**
   * L'état de saisie est LOCAL et fait foi tant que l'accordéon est ouvert.
   *
   * Il se reconstruisait à chaque écho du cache Firestore : enregistrer la
   * série 1 réécrivait les champs des séries 2 à 4 en pleine frappe, et un 0
   * apparaissait tout seul dans les répétitions. Il ne se reconstruit plus
   * qu'à l'ouverture — le seul moment où l'écran peut être en retard.
   */
  const [rows, setRows] = useState(() => buildRows(line.prescribedSets, entry))
  const wasExpanded = useRef(expanded)

  useEffect(() => {
    if (expanded && !wasExpanded.current) setRows(buildRows(line.prescribedSets, entry))
    wasExpanded.current = expanded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  /**
   * L'enregistrement différé écrit vers la DATE OÙ L'ON A TAPÉ.
   *
   * `onSave` est refabriqué à chaque changement de jour affiché. Le flush part
   * 700 ms après la dernière frappe : taper une série puis appuyer aussitôt sur
   * « jour précédent » écrivait la série d'aujourd'hui dans la séance d'hier,
   * sans la moindre erreur visible. On fige donc l'écrivain au moment où la
   * ligne devient sale, et c'est lui qui reçoit le flush, quoi qu'il se passe
   * à l'écran entre-temps.
   */
  const dirty = useRef(false)
  const pendingSave = useRef(null)

  const markDirty = () => {
    dirty.current = true
    if (!pendingSave.current) pendingSave.current = onSave
  }

  // `flush` change à chaque rendu (les callbacks du parent aussi) : on le lit
  // par référence pour que l'enregistrement différé ne se rejoue pas en boucle.
  const flush = useCallback(() => {
    if (!dirty.current) return
    dirty.current = false
    const save = pendingSave.current || onSave
    pendingSave.current = null
    save({ sets: toSets(rows), skipped: false })
  }, [rows, onSave])
  const flushRef = useRef(flush)
  flushRef.current = flush

  useEffect(() => {
    if (!dirty.current) return undefined
    const timer = setTimeout(() => flushRef.current(), AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [rows])

  // Quitter l'écran ou replier ne doit rien coûter : on écrit au démontage.
  useEffect(() => () => flushRef.current(), [])

  const setField = (rank, field, value) => {
    markDirty()
    setRows((prev) => prev.map((r) => (r.rank === rank ? { ...r, [field]: value } : r)))
  }

  // Ce qui avait été fait sur CE rang la dernière fois — placeholder du champ.
  const previousFor = (rank, isExtra) => {
    if (!lastSets || lastSets.length === 0) return null
    return lastSets[rank] || (isExtra ? lastSets[lastSets.length - 1] : null)
  }

  const commitNow = (next) => {
    dirty.current = false
    pendingSave.current = null
    setRows(next)
    onSave({ sets: toSets(next), skipped: false })
  }

  const addRow = () => {
    commitNow([...rows, { rank: rows.length, extra: true, weightKg: '', reps: '' }])
  }

  // Les rangs sont renumérotés : retirer la 5e série ne doit pas laisser un
  // trou que la reconstruction rouvrirait à la ligne suivante.
  const removeRow = (rank) => {
    commitNow(rows
      .filter((r) => r.rank !== rank)
      .map((r, i) => ({ ...r, rank: i, extra: i >= line.prescribedSets })))
  }

  const patchRow = (rank, patch) => {
    commitNow(rows.map((r) => (r.rank === rank ? { ...r, ...patch } : r)))
  }

  // Une série validée lance le repos : c'est le moment exact où le minuteur a
  // du sens, et personne ne pense à le démarrer à la main.
  const validateRow = (rank, { weightKg, reps }) => {
    patchRow(rank, { weightKg: toField(weightKg, true), reps: String(reps) })
    onRest?.(line.name)
  }

  const resetRow = (rank) => patchRow(rank, { weightKg: '', reps: '' })

  /**
   * « Comme la dernière fois » — remplit d'un geste les séries encore vides.
   *
   * Ne touche JAMAIS une série déjà saisie : le raccourci sert à éviter de
   * retaper l'identique, pas à écraser le travail du jour.
   *
   * Replié, l'état local peut dater d'avant le dernier écho de Firestore : on
   * repart alors de l'entrée enregistrée plutôt que de ce qu'on a en mémoire.
   */
  const repeatLast = () => {
    const base = expanded ? rows : buildRows(line.prescribedSets, entry)
    const next = base.map((r) => {
      if (parseNumber(r.reps) > 0) return r
      const previous = previousFor(r.rank, r.extra)
      if (!previous || !(previous.reps > 0)) return r
      return {
        ...r,
        weightKg: toField(previous.weightKg, true),
        reps: String(previous.reps),
      }
    })
    commitNow(next)
    onRest?.(line.name)
  }

  const skip = () => {
    dirty.current = false
    pendingSave.current = null
    onSave({ sets: [], skipped: true })
  }

  // Retirer l'entrée vide aussi les champs : sans ça l'écran continuerait
  // d'afficher des chiffres que le document ne contient plus.
  const clear = () => {
    dirty.current = false
    pendingSave.current = null
    setRows(buildRows(line.prescribedSets, null))
    onClear()
  }

  const skipped = entry?.skipped === true
  const done = doneSets(entry)
  const savedDone = done.length
  const isComplete = isEntryComplete(entry, line.prescribedSets)
  const isPartial = !skipped && savedDone > 0 && savedDone < line.prescribedSets
  const extraCount = Math.max(0, savedDone - line.prescribedSets)
  const hint = weightHint(exercise)
  const improved = !skipped && beatsPrevious(done, lastSets, exercise)

  // Le raccourci n'apparaît que s'il a de quoi remplir quelque chose.
  const canRepeat = !skipped && !isComplete && !!lastSets?.length

  /**
   * La CARTE ne glisse plus.
   *
   * Elle a porté « non fait » d'un côté et « répéter » de l'autre. Deux gestes
   * de plus à retenir, pour des actions qu'on déclenche quelques fois par mois
   * — et qui rendaient le seul geste utile, valider une série, ambigu : selon
   * l'endroit exact où le doigt se posait, on déplaçait la ligne ou la carte.
   * Un seul glissement dans toute la séance, et il veut dire « c'est fait ».
   * Les boutons de l'accordéon font le reste.
   */
  return (
    <div
      className={cn(
        'rounded-2xl border bg-surface overflow-hidden transition-colors',
        skipped ? 'border-border opacity-60' : isComplete ? 'border-accent/40' : 'border-border',
      )}
    >
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-surface-2 transition"
      >
        <StatusDot skipped={skipped} complete={isComplete} partial={isPartial} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 min-w-0">
            <span className="block text-[15px] font-semibold text-fg truncate">{line.name}</span>
            {improved && (
              <span
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                           bg-accent/12 text-accent text-[10px] font-semibold"
                title="Meilleure série que la dernière fois"
              >
                <TrendingUp size={10} strokeWidth={3} /> Mieux
              </span>
            )}
          </span>
          <span className="block text-xs text-muted mt-0.5">
            {line.prescribedSets} × {line.prescribedReps}
            {skipped && ' · non fait'}
            {isPartial && ` · ${savedDone}/${line.prescribedSets}`}
            {extraCount > 0 && ` · +${extraCount}`}
          </span>
          {/* Le compte de séries se lit AUSSI d'un trait : replié, on balaie la
              liste sans lire quatre fractions à la suite. */}
          {!skipped && savedDone > 0 && !isComplete && (
            <Progress
              className="mt-2 h-1"
              value={savedDone}
              max={line.prescribedSets}
              label={`${savedDone} séries sur ${line.prescribedSets}`}
            />
          )}
        </span>
        <ChevronDown
          size={18}
          className={cn('shrink-0 text-faint transition-transform duration-300 ease-ios', expanded && 'rotate-180')}
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-ios',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden" {...(expanded ? {} : { inert: '' })}>
          <div className="px-4 pb-4 border-t border-border pt-3">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => onOpenDetail(line.exerciseId)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80 transition"
              >
                <LineChart size={13} /> Voir la progression
              </button>
              {skipped ? (
                <button
                  onClick={clear}
                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition"
                >
                  <RotateCcw size={13} /> Reprendre
                </button>
              ) : extra ? (
                <button
                  onClick={clear}
                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-danger transition"
                >
                  <Trash2 size={13} /> Retirer
                </button>
              ) : (
                <button
                  onClick={skip}
                  className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition"
                >
                  <SkipForward size={13} /> Non fait
                </button>
              )}
            </div>

            {!skipped && (
              <>
                <ExerciseNote note={note} onSave={(text) => onSaveNote(line.exerciseId, text)} />

                <div className="space-y-3">
                  {rows.map((row) => (
                    <SetRow
                      key={row.rank}
                      row={row}
                      exercise={exercise}
                      label={row.extra ? `Série ${row.rank + 1} (en plus)` : `Série ${row.rank + 1}`}
                      previous={previousFor(row.rank, row.extra)}
                      prescribedReps={line.prescribedReps}
                      onChange={(field, value) => setField(row.rank, field, value)}
                      onCommit={() => flushRef.current()}
                      onValidate={(values) => validateRow(row.rank, values)}
                      onReset={() => resetRow(row.rank)}
                      onRemove={row.extra ? () => removeRow(row.rank) : null}
                    />
                  ))}
                </div>

                <div className="flex gap-2 mt-3">
                  <Button variant="dashed" className="flex-1 text-xs" onClick={addRow}>
                    <Plus size={14} /> série
                  </Button>
                  {canRepeat && (
                    <Button variant="secondary" className="flex-1 text-xs" onClick={repeatLast}>
                      <CopyCheck size={14} /> Répéter
                    </Button>
                  )}
                </div>

                {hint && <p className="text-[11px] text-faint mt-3 leading-relaxed">{hint}</p>}

                {/* Replier n'est pas valider : la coche ici laissait croire
                    qu'il fallait encore confirmer des séries déjà comptées. */}
                <Button
                  variant={isComplete ? 'accent' : 'secondary'}
                  size="lg"
                  className="w-full mt-3"
                  onClick={onToggle}
                >
                  {isComplete
                    ? <><Check size={16} strokeWidth={2.6} /> Exercice terminé</>
                    : <><ChevronUp size={16} /> Replier</>}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusDot({ skipped, complete, partial }) {
  if (skipped) {
    return (
      <span className="h-6 w-6 shrink-0 rounded-full border border-border flex items-center justify-center text-faint">
        <SkipForward size={12} />
      </span>
    )
  }
  if (complete) {
    return (
      <span className="h-6 w-6 shrink-0 rounded-full bg-accent text-accent-fg flex items-center justify-center">
        <Check size={14} strokeWidth={3} />
      </span>
    )
  }
  return (
    <span className={cn(
      'h-6 w-6 shrink-0 rounded-full border-2',
      partial ? 'border-accent border-dashed' : 'border-border-strong',
    )} />
  )
}
