import { useState, useMemo } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, X, Search, CalendarRange } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { cn } from '@/shared/lib/utils.js'
import { DAY_SHORT, DAY_LABELS, weekParity, isoDayOfWeek } from '@/shared/lib/dates.js'
import { useExercises, useProgram } from '../hooks/useMuscData.js'
import { saveProgramDay, DOWS } from '../services/programService.js'

const PARITY_LABEL = { odd: 'Semaine impaire', even: 'Semaine paire' }

// Éditeur de programme : parité × jour de la semaine, indépendant par profil.
// Toute modification ici est sans effet sur les séances déjà enregistrées —
// chacune porte sa propre copie de la prescription.
export default function ProgramView() {
  const { currentUid } = useAuth()
  const [parity, setParity] = useState(() => weekParity(new Date()))
  const [dayOfWeek, setDayOfWeek] = useState(() => isoDayOfWeek(new Date()))
  const [picking, setPicking] = useState(false)

  const { exercises, exerciseById, isLoading: exercisesLoading } = useExercises()
  const { days, isLoading } = useProgram(parity)
  const lines = days[dayOfWeek] || []

  // Firestore renvoie l'écriture depuis son cache local : pas d'état de
  // brouillon à maintenir, on repart toujours de `lines`.
  const commit = (next) => {
    saveProgramDay(currentUid, parity, dayOfWeek, next, currentUid)
      .catch(() => toast.error('Enregistrement impossible'))
  }

  const addLine = (exerciseId) => {
    if (lines.some((l) => l.exerciseId === exerciseId)) {
      toast.error('Déjà dans la séance')
      return
    }
    // Valeurs de départ : 4 × 8, le plus courant — ça s'ajuste juste après.
    commit([...lines, { exerciseId, sets: 4, reps: 8, order: lines.length }])
    setPicking(false)
  }

  const updateLine = (index, patch) => {
    commit(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const removeLine = (index) => {
    commit(lines.filter((_, i) => i !== index))
  }

  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= lines.length) return
    const next = [...lines]
    ;[next[index], next[target]] = [next[target], next[index]]
    commit(next)
  }

  const available = useMemo(
    () => exercises.filter((e) => !lines.some((l) => l.exerciseId === e.id)),
    [exercises, lines],
  )

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-faint">Réglages</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1">Programme</h1>
        <p className="text-sm text-muted mt-1">
          Ton programme à toi. Les séances déjà enregistrées ne bougent pas.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {['odd', 'even'].map((p) => (
          <button
            key={p}
            onClick={() => setParity(p)}
            className={cn(
              'h-11 rounded-xl text-sm font-medium border transition',
              p === parity
                ? 'bg-accent text-accent-fg border-accent'
                : 'bg-surface-2 text-muted border-border hover:text-fg',
            )}
          >
            {PARITY_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-5">
        {DOWS.map((d) => {
          const count = (days[d] || []).length
          const isActive = d === dayOfWeek
          return (
            <button
              key={d}
              onClick={() => setDayOfWeek(d)}
              aria-label={DAY_LABELS[d % 7]}
              className={cn(
                'h-14 rounded-xl text-xs font-semibold border transition flex flex-col items-center justify-center gap-1',
                isActive
                  ? 'bg-accent text-accent-fg border-accent'
                  : 'bg-surface-2 text-muted border-border hover:text-fg',
              )}
            >
              {DAY_SHORT[d % 7]}
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                count === 0 ? 'opacity-0' : isActive ? 'bg-accent-fg' : 'bg-accent',
              )} />
            </button>
          )
        })}
      </div>

      {isLoading && lines.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] rounded-xl border border-border bg-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {lines.map((line, i) => {
            const exercise = exerciseById[line.exerciseId]
            return (
              <div key={line.exerciseId} className="px-4 py-3 rounded-xl border border-border bg-surface">
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-[15px] font-medium text-fg truncate">
                    {exercise?.name || <span className="text-faint italic">Exercice supprimé</span>}
                  </span>
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Monter"
                    className="p-1.5 rounded-lg text-faint hover:text-fg hover:bg-surface-2 disabled:opacity-25 disabled:pointer-events-none transition"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === lines.length - 1}
                    aria-label="Descendre"
                    className="p-1.5 rounded-lg text-faint hover:text-fg hover:bg-surface-2 disabled:opacity-25 disabled:pointer-events-none transition"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    onClick={() => removeLine(i)}
                    aria-label="Retirer"
                    className="p-1.5 rounded-lg text-faint hover:text-danger hover:bg-surface-2 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2.5">
                  <Stepper label="séries" value={line.sets} min={1} max={12} onChange={(v) => updateLine(i, { sets: v })} />
                  <span className="text-faint text-sm">×</span>
                  <Stepper label="reps" value={line.reps} min={1} max={50} onChange={(v) => updateLine(i, { reps: v })} />
                </div>
              </div>
            )
          })}

          {lines.length === 0 && !picking && (
            <div className="text-center py-10 px-6 rounded-2xl border border-dashed border-border">
              <CalendarRange size={26} className="mx-auto text-faint" />
              <p className="text-sm text-muted mt-2">
                Jour de repos — ajoute un exercice pour en faire une séance.
              </p>
            </div>
          )}

          {picking ? (
            <ExercisePicker
              exercises={available}
              isLoading={exercisesLoading}
              onPick={addLine}
              onCancel={() => setPicking(false)}
            />
          ) : (
            <button
              onClick={() => setPicking(true)}
              className="w-full h-12 rounded-xl border border-dashed border-border-strong text-sm font-medium text-muted hover:text-fg hover:border-accent transition inline-flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Ajouter un exercice
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={`Moins de ${label}`}
        className="h-9 w-9 rounded-lg bg-surface-2 border border-border text-muted hover:text-fg transition text-lg leading-none"
      >
        −
      </button>
      <span className="w-12 text-center text-sm font-semibold text-fg tabular">
        {value}
        <span className="block text-[10px] font-normal text-faint leading-none">{label}</span>
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label={`Plus de ${label}`}
        className="h-9 w-9 rounded-lg bg-surface-2 border border-border text-muted hover:text-fg transition text-lg leading-none"
      >
        +
      </button>
    </div>
  )
}

function ExercisePicker({ exercises, isLoading, onPick, onCancel }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return exercises
    return exercises.filter((e) => e.name.toLowerCase().includes(needle))
  }, [exercises, q])

  return (
    <div className="p-3 rounded-2xl border border-accent/30 bg-surface slide-up">
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un exercice"
            className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-2 border border-border text-sm text-fg placeholder:text-faint
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition"
          />
        </div>
        <button
          onClick={onCancel}
          aria-label="Fermer"
          className="h-11 w-11 shrink-0 rounded-xl border border-border text-muted hover:text-fg transition inline-flex items-center justify-center"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {exercises.length === 0
              ? 'Tous les exercices du catalogue sont déjà dans cette séance.'
              : 'Aucun exercice ne correspond.'}
          </p>
        ) : (
          filtered.map((ex) => (
            <button
              key={ex.id}
              onClick={() => onPick(ex.id)}
              className="w-full px-3 py-3 rounded-xl text-left text-sm text-fg hover:bg-surface-2 transition"
            >
              {ex.name}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
