import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Check, SkipForward, LineChart, RotateCcw } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { weightHint } from '../../config/exercises.js'

// Une série vide se saisit au clavier numérique : pas de boutons ±2.5 kg,
// on tape la valeur et c'est tout.
function toField(value) {
  return value === null || value === undefined || value === '' ? '' : String(value)
}

// Pré-remplissage : la même série la dernière fois. Si l'exercice a gagné des
// séries depuis, les nouvelles reprennent la dernière série connue.
function prefillRows(setCount, entry, lastSets) {
  return Array.from({ length: setCount }, (_, i) => {
    const saved = entry?.sets?.[i]
    if (saved) return { weight: toField(saved.weight), reps: toField(saved.reps) }
    const previous = lastSets?.[i] || lastSets?.[lastSets.length - 1]
    if (previous) return { weight: toField(previous.weight), reps: toField(previous.reps) }
    return { weight: '', reps: '' }
  })
}

function parseRows(rows) {
  return rows.map((r) => ({
    weight: Number(String(r.weight).replace(',', '.')) || 0,
    reps: Math.max(0, Math.round(Number(r.reps) || 0)),
  }))
}

export default function ExerciseAccordion({
  exercise,
  line,
  entry,
  lastPerf,
  expanded,
  onToggle,
  onSave,
  onClear,
  onOpenDetail,
}) {
  const lastSets = lastPerf?.sets || null
  const [rows, setRows] = useState(() => prefillRows(line.sets, entry, lastSets))

  // La séance se resynchronise (autre onglet, retour du réseau) ou la
  // prescription change : on repart de l'état serveur, sauf pendant la saisie
  // — d'où la dépendance sur l'identité de l'entrée plutôt que sur `rows`.
  useEffect(() => {
    setRows(prefillRows(line.sets, entry, lastSets))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, line.sets, entry?.skipped, lastPerf?.date])

  const commit = useCallback((next) => {
    onSave({ sets: parseRows(next), skipped: false })
  }, [onSave])

  const setField = (index, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  const skipped = entry?.skipped === true
  const doneCount = rows.filter((r) => Number(r.reps) > 0).length
  const savedCount = entry?.sets?.filter((s) => s.reps > 0).length || 0
  const isComplete = !skipped && savedCount >= line.sets
  const isPartial = !skipped && savedCount > 0 && savedCount < line.sets

  return (
    <div
      className={cn(
        'rounded-2xl border bg-surface overflow-hidden transition',
        skipped ? 'border-border opacity-60' : isComplete ? 'border-accent/40' : 'border-border',
      )}
    >
      <div className="flex items-stretch">
        {/* Zone de repli : large, on la vise d'une main entre deux séries. */}
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center gap-3 px-4 py-4 text-left active:bg-surface-2 transition"
        >
          <StatusDot skipped={skipped} complete={isComplete} partial={isPartial} />
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-fg truncate">{exercise.name}</span>
            <span className="block text-xs text-muted mt-0.5">
              {line.sets} × {line.reps}
              {skipped && ' · non fait'}
              {isPartial && ` · ${savedCount}/${line.sets} enregistrées`}
            </span>
          </span>
          <ChevronDown
            size={18}
            className={cn('shrink-0 text-faint transition-transform', expanded && 'rotate-180')}
          />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 slide-up">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => onOpenDetail(exercise.id)}
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
                onClick={() => onSave({ sets: [], skipped: true })}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition"
              >
                <SkipForward size={13} /> Non fait
              </button>
            )}
          </div>

          {!skipped && (
            <>
              <div className="space-y-2.5">
                {rows.map((row, i) => (
                  <SetRow
                    key={i}
                    index={i}
                    row={row}
                    previous={lastSets?.[i]}
                    onChange={(field, value) => setField(i, field, value)}
                    onCommit={() => commit(rows)}
                  />
                ))}
              </div>
              <p className="text-[11px] text-faint mt-3 leading-relaxed">{weightHint(exercise)}</p>
              {doneCount > 0 && (
                <button
                  onClick={() => { commit(rows); onToggle() }}
                  className="w-full mt-3 h-12 rounded-xl bg-accent text-accent-fg text-sm font-semibold active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
                >
                  <Check size={16} strokeWidth={2.6} /> Terminé
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StatusDot({ skipped, complete, partial }) {
  if (skipped) {
    return <span className="h-6 w-6 shrink-0 rounded-full border border-border flex items-center justify-center text-faint"><SkipForward size={12} /></span>
  }
  if (complete) {
    return <span className="h-6 w-6 shrink-0 rounded-full bg-accent text-accent-fg flex items-center justify-center"><Check size={14} strokeWidth={3} /></span>
  }
  return (
    <span className={cn(
      'h-6 w-6 shrink-0 rounded-full border-2',
      partial ? 'border-accent border-dashed' : 'border-border-strong',
    )} />
  )
}

function SetRow({ index, row, previous, onChange, onCommit }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-xs font-semibold text-faint tabular">{index + 1}</span>
        <NumField
          value={row.weight}
          onChange={(v) => onChange('weight', v)}
          onCommit={onCommit}
          suffix="kg"
          ariaLabel={`Charge série ${index + 1}`}
        />
        <span className="text-faint text-sm">×</span>
        <NumField
          value={row.reps}
          onChange={(v) => onChange('reps', v)}
          onCommit={onCommit}
          suffix="reps"
          integer
          ariaLabel={`Répétitions série ${index + 1}`}
        />
      </div>
      {previous && (
        <p className="pl-8 mt-1 text-[11px] text-faint tabular">
          Dernière fois : {previous.weight} kg × {previous.reps}
        </p>
      )}
    </div>
  )
}

function NumField({ value, onChange, onCommit, suffix, integer = false, ariaLabel }) {
  return (
    <label className="flex-1 min-w-0 relative">
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        pattern={integer ? '[0-9]*' : '[0-9.,]*'}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onFocus={(e) => e.target.select()}
        className="w-full h-14 pl-3 pr-11 rounded-xl bg-surface-2 border border-border text-lg font-semibold text-fg tabular
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint pointer-events-none">{suffix}</span>
    </label>
  )
}
