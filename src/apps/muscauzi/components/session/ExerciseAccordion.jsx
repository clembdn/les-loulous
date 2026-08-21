import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, Check, SkipForward, LineChart, RotateCcw, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { weightHint } from '../../config/exercises.js'
import SetRow from './SetRow.jsx'
import ExerciseNote from './ExerciseNote.jsx'

function toField(value) {
  return value === null || value === undefined || value === '' ? '' : String(value)
}

/**
 * Construit les lignes affichées à partir de la prescription figée et de ce
 * qui est déjà enregistré.
 *
 * Les rangs 0…N-1 sont les séries prescrites : elles existent toujours, même
 * vides, et ne se suppriment pas. Tout rang ≥ N est une série ajoutée à la
 * main. Les clés ne sont jamais renumérotées — seule la numérotation affichée
 * reste continue.
 */
function buildRows(prescribed, entry, lastSets) {
  const stored = entry?.sets || {}
  const keys = new Set()
  for (let i = 0; i < prescribed; i++) keys.add(String(i))
  for (const k of Object.keys(stored)) keys.add(k)

  return [...keys]
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => {
      const rank = Number(key)
      const saved = stored[key]
      const extra = rank >= prescribed
      if (saved) {
        return {
          key, extra, dirty: false,
          weightKg: toField(saved.weightKg),
          reps: toField(saved.reps),
          completed: saved.completed === true,
        }
      }
      // Pré-remplissage depuis la même série la dernière fois. Purement
      // visuel : tant que la série n'est pas validée, elle ne compte pas.
      const previous = lastSets?.[rank] || lastSets?.[lastSets.length - 1]
      return {
        key, extra, dirty: false,
        weightKg: previous ? toField(previous.weightKg) : '',
        reps: previous ? toField(previous.reps) : '',
        completed: false,
      }
    })
}

function parseNumber(value) {
  return Number(String(value).replace(',', '.')) || 0
}

// N'est persisté que ce qui a été touché ou validé : une ligne pré-remplie et
// laissée telle quelle reste absente du document.
function toSetsMap(rows) {
  const out = {}
  for (const r of rows) {
    if (!r.completed && !r.dirty && !r.extra) continue
    out[r.key] = {
      weightKg: parseNumber(r.weightKg),
      reps: Math.max(0, Math.round(parseNumber(r.reps))),
      completed: r.completed === true,
    }
  }
  return out
}

export default function ExerciseAccordion({
  line,
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
  const [rows, setRows] = useState(() => buildRows(line.sets, entry, lastSets))

  // Resynchronisation (autre onglet, retour du réseau, changement de séance).
  // On ne dépend pas du contenu de `entry` pour ne pas écraser une saisie en
  // cours à chaque écho du cache Firestore.
  const storedSignature = Object.keys(entry?.sets || {}).sort().join(',')
  useEffect(() => {
    setRows(buildRows(line.sets, entry, lastSets))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.instanceId, line.sets, entry?.skipped, storedSignature, lastPerf?.date])

  const commit = useCallback((next) => {
    onSave({ sets: toSetsMap(next), skipped: false })
  }, [onSave])

  const setField = (key, field, value) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value, dirty: true } : r)))
  }

  const toggleComplete = (key) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.key === key ? { ...r, completed: !r.completed } : r))
      commit(next)
      return next
    })
  }

  const removeRow = (key) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key)
      commit(next)
      return next
    })
  }

  // La série ajoutée recopie la dernière série RÉELLEMENT renseignée — pas la
  // dernière ligne affichée si celle-ci est restée vide.
  const addRow = () => {
    setRows((prev) => {
      const source = [...prev].reverse().find((r) => (r.completed || r.dirty) && parseNumber(r.reps) > 0)
      const nextRank = prev.reduce((max, r) => Math.max(max, Number(r.key)), line.sets - 1) + 1
      const next = [...prev, {
        key: String(nextRank),
        extra: true,
        dirty: false,
        weightKg: source ? source.weightKg : '',
        reps: source ? source.reps : '',
        completed: false,
      }]
      commit(next)
      return next
    })
  }

  const skipped = entry?.skipped === true
  const savedDone = useMemo(
    () => Object.values(entry?.sets || {}).filter((s) => s.completed && s.reps > 0).length,
    [entry],
  )
  const isComplete = !skipped && savedDone >= line.sets
  const isPartial = !skipped && savedDone > 0 && savedDone < line.sets
  const extraCount = Math.max(0, savedDone - line.sets)

  // Le nom vient du snapshot de la séance : renommer l'exercice au catalogue
  // ne doit pas réécrire ce qui a été fait.
  const displayName = line.name || exercise?.name || 'Exercice supprimé'

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
          <span className="block text-[15px] font-semibold text-fg truncate">{displayName}</span>
          <span className="block text-xs text-muted mt-0.5">
            {line.sets} × {line.reps}
            {skipped && ' · non fait'}
            {isPartial && ` · ${savedDone}/${line.sets}`}
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
                onClick={onClear}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition"
              >
                <RotateCcw size={13} /> Reprendre
              </button>
            ) : (
              <button
                onClick={() => onSave({ sets: {}, skipped: true })}
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
                {rows.map((row, i) => (
                  <SetRow
                    key={row.key}
                    row={row}
                    label={row.extra ? 'Série supplémentaire' : `Série ${Number(row.key) + 1}`}
                    previous={lastSets?.[Number(row.key)] || (row.extra ? lastSets?.[lastSets.length - 1] : null)}
                    onChange={(field, value) => setField(row.key, field, value)}
                    onCommit={() => commit(rows)}
                    onToggleComplete={() => toggleComplete(row.key)}
                    onRemove={row.extra ? () => removeRow(row.key) : null}
                  />
                ))}
              </div>

              <Button variant="dashed" className="w-full mt-3 text-xs" onClick={addRow}>
                <Plus size={14} /> série
              </Button>

              {weightHint(exercise) && (
                <p className="text-[11px] text-faint mt-3 leading-relaxed">{weightHint(exercise)}</p>
              )}

              {savedDone > 0 && (
                <Button size="lg" className="w-full mt-3" onClick={onToggle}>
                  <Check size={16} strokeWidth={2.6} /> Replier
                </Button>
              )}
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
