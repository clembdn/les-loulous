import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Check, SkipForward, LineChart, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { weightHint } from '../../config/exercises.js'
import { doneSets, isEntryComplete } from '../../services/sessionsService.js'
import SetRow from './SetRow.jsx'
import ExerciseNote from './ExerciseNote.jsx'

function toField(value) {
  return value > 0 ? String(value) : ''
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
      weightKg: saved ? toField(saved.weightKg) : '',
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

  // `flush` change à chaque rendu (les callbacks du parent aussi) : on le lit
  // par référence pour que l'enregistrement différé ne se rejoue pas en boucle.
  const dirty = useRef(false)
  const flush = useCallback(() => {
    if (!dirty.current) return
    dirty.current = false
    onSave({ sets: toSets(rows), skipped: false })
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
    dirty.current = true
    setRows((prev) => prev.map((r) => (r.rank === rank ? { ...r, [field]: value } : r)))
  }

  // Ce qui avait été fait sur CE rang la dernière fois — placeholder du champ.
  const previousFor = (rank, extra) => {
    if (!lastSets || lastSets.length === 0) return null
    return lastSets[rank] || (extra ? lastSets[lastSets.length - 1] : null)
  }

  const commitNow = (next) => {
    dirty.current = false
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

  const skip = () => {
    dirty.current = false
    onSave({ sets: [], skipped: true })
  }

  // Retirer l'entrée vide aussi les champs : sans ça l'écran continuerait
  // d'afficher des chiffres que le document ne contient plus.
  const clear = () => {
    dirty.current = false
    setRows(buildRows(line.prescribedSets, null))
    onClear()
  }

  const skipped = entry?.skipped === true
  const savedDone = doneSets(entry).length
  const isComplete = isEntryComplete(entry)
  const isPartial = !skipped && savedDone > 0 && savedDone < line.prescribedSets
  const extraCount = Math.max(0, savedDone - line.prescribedSets)
  const hint = weightHint(exercise)

  return (
    <div
      className={cn(
        'rounded-2xl border bg-surface overflow-hidden transition',
        skipped ? 'border-border opacity-60' : isComplete ? 'border-accent/40' : 'border-border',
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-surface-2 transition"
      >
        <StatusDot skipped={skipped} complete={isComplete} partial={isPartial} />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-fg truncate">{line.name}</span>
          <span className="block text-xs text-muted mt-0.5">
            {line.prescribedSets} × {line.prescribedReps}
            {skipped && ' · non fait'}
            {isPartial && ` · ${savedDone}/${line.prescribedSets}`}
            {extraCount > 0 && ` · +${extraCount}`}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={cn('shrink-0 text-faint transition-transform', expanded && 'rotate-180')}
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
                      label={row.extra ? `Série ${row.rank + 1} (en plus)` : `Série ${row.rank + 1}`}
                      previous={previousFor(row.rank, row.extra)}
                      onChange={(field, value) => setField(row.rank, field, value)}
                      onCommit={() => flushRef.current()}
                      onRemove={row.extra ? () => removeRow(row.rank) : null}
                    />
                  ))}
                </div>

                <Button variant="dashed" className="w-full mt-3 text-xs" onClick={addRow}>
                  <Plus size={14} /> série
                </Button>

                {hint && <p className="text-[11px] text-faint mt-3 leading-relaxed">{hint}</p>}

                <Button size="lg" className="w-full mt-3" onClick={onToggle}>
                  <Check size={16} strokeWidth={2.6} /> Replier
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
