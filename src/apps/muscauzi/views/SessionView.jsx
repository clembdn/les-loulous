import { useState, useMemo, useCallback, useEffect } from 'react'
import { Dumbbell, Scale, ArrowRight } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { toLocalDateKey, weekParity, isoDayOfWeek, formatDayFr } from '@/shared/lib/dates.js'
import {
  useExercises, useProgram, useSession, useLastPerf, useWeights, useNotes,
} from '../hooks/useMuscData.js'
import {
  upsertEntry, clearEntry, updateSessionPlan, mergeSnapshot, completedSets, entryHasData,
} from '../services/sessionsService.js'
import { toast } from 'sonner'
import { saveNote } from '../services/notesService.js'
import SessionPlanControl from '../components/session/SessionPlanControl.jsx'
import ExerciseAccordion from '../components/session/ExerciseAccordion.jsx'

// La parité/le jour forcés valent pour la journée en cours seulement : on
// rouvre l'appli entre deux séries, le choix doit tenir — mais pas déborder
// sur demain.
function planStorageKey(dateKey) {
  return `muscauzi:plan:${dateKey}`
}

function readStoredPlan(dateKey) {
  try {
    const raw = localStorage.getItem(planStorageKey(dateKey))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.parity !== 'even' && parsed?.parity !== 'odd') return null
    if (!(parsed.dayOfWeek >= 1 && parsed.dayOfWeek <= 7)) return null
    return { parity: parsed.parity, dayOfWeek: parsed.dayOfWeek }
  } catch {
    return null
  }
}

export default function SessionView({ onOpenExercise, onOpenWeight }) {
  const { currentUid } = useAuth()
  const today = useMemo(() => new Date(), [])
  const dateKey = toLocalDateKey(today)
  const natural = useMemo(
    () => ({ parity: weekParity(today), dayOfWeek: isoDayOfWeek(today) }),
    [today],
  )

  const [override, setOverride] = useState(() => readStoredPlan(dateKey))
  const [openId, setOpenId] = useState(null)

  const { exerciseById, isLoading: exercisesLoading } = useExercises()
  const { session, isLoading: sessionLoading } = useSession(dateKey)
  const { lastPerf } = useLastPerf()
  const { notes } = useNotes()
  // Les deux parités sont suivies en permanence : deux documents, et forcer la
  // semaine doit pouvoir re-photographier la séance sans attendre une lecture.
  const even = useProgram('even')
  const odd = useProgram('odd')

  // Une séance déjà commencée porte son propre plan : il fait foi.
  const plan = session?.parity
    ? { parity: session.parity, dayOfWeek: session.dayOfWeek }
    : (override || natural)

  // Le nom de l'exercice est recopié dans le snapshot : le renommer ensuite au
  // catalogue ne doit pas réécrire les libellés des séances passées.
  const snapshotFrom = useCallback((lines) => lines.map((l) => ({
    instanceId: l.instanceId,
    exerciseId: l.exerciseId,
    name: exerciseById[l.exerciseId]?.name || '',
    order: l.order,
    sets: l.sets,
    reps: l.reps,
  })), [exerciseById])

  const liveSnapshot = useMemo(() => {
    const days = plan.parity === 'even' ? even.days : odd.days
    return snapshotFrom(days?.[plan.dayOfWeek] || [])
  }, [plan.parity, plan.dayOfWeek, even.days, odd.days, snapshotFrom])

  // Une fois la séance créée, on affiche la copie figée : modifier le
  // programme dans les réglages ne change pas la séance en cours.
  const prescription = session ? session.programSnapshot : liveSnapshot

  const isForced = plan.parity !== natural.parity || plan.dayOfWeek !== natural.dayOfWeek

  // Charge de chaque jour pour la parité affichée : le sélecteur montre où sont
  // les séances au lieu de sept cases identiques.
  const dayCounts = useMemo(() => {
    const days = plan.parity === 'even' ? even.days : odd.days
    return Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, (days?.[d] || []).length]))
  }, [plan.parity, even.days, odd.days])

  // Changer de jour ou de parité ne coûte JAMAIS le travail déjà fait : les
  // séries saisies restent, et les exercices sur lesquels on a déjà travaillé
  // restent visibles à la suite du nouveau programme.
  const applyPlan = useCallback((next) => {
    setOverride(next)
    try { localStorage.setItem(planStorageKey(dateKey), JSON.stringify(next)) } catch { /* mode privé */ }
    if (session) {
      const days = next.parity === 'even' ? even.days : odd.days
      const nextLines = snapshotFrom(days?.[next.dayOfWeek] || [])
      const kept = Object.values(session.entries || {}).filter(entryHasData).length
      updateSessionPlan(currentUid, dateKey, {
        parity: next.parity,
        dayOfWeek: next.dayOfWeek,
        programSnapshot: mergeSnapshot(session, nextLines),
      }, currentUid)
      if (kept > 0) toast.success('Séance changée — tes séries du jour sont conservées')
    }
    setOpenId(null)
  }, [dateKey, session, even.days, odd.days, currentUid, snapshotFrom])

  const resetPlan = useCallback(() => {
    applyPlan(natural)
    try { localStorage.removeItem(planStorageKey(dateKey)) } catch { /* mode privé */ }
  }, [applyPlan, natural, dateKey])

  const saveEntry = useCallback((line, entry) => {
    // `meta` n'est transmis qu'à la création : le snapshot est figé ensuite.
    const meta = session ? null : {
      parity: plan.parity,
      dayOfWeek: plan.dayOfWeek,
      programSnapshot: liveSnapshot,
    }
    upsertEntry(
      currentUid, dateKey,
      { instanceId: line.instanceId, exerciseId: line.exerciseId },
      entry, currentUid, meta,
    )
  }, [currentUid, dateKey, session, plan.parity, plan.dayOfWeek, liveSnapshot])

  const isLoading = exercisesLoading || sessionLoading || even.isLoading || odd.isLoading
  const doneCount = prescription.filter((l) => {
    const e = session?.entries?.[l.instanceId]
    if (!e) return false
    return e.skipped || completedSets(e).length >= l.sets
  }).length

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-faint">Séance du jour</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1 first-letter:uppercase">
          {formatDayFr(today)}
        </h1>
        {prescription.length > 0 && (
          <p className="text-sm text-muted mt-1 tabular">
            {doneCount}/{prescription.length} exercice{prescription.length > 1 ? 's' : ''} terminé{doneCount > 1 ? 's' : ''}
          </p>
        )}
      </header>

      <SessionPlanControl
        parity={plan.parity}
        dayOfWeek={plan.dayOfWeek}
        dayCounts={dayCounts}
        isForced={isForced}
        onChange={applyPlan}
        onReset={resetPlan}
      />

      {plan.dayOfWeek === 1 && <WeighInNudge dateKey={dateKey} onGo={onOpenWeight} />}

      {isLoading && prescription.length === 0 ? (
        <SkeletonList />
      ) : prescription.length === 0 ? (
        <EmptyDay />
      ) : (
        <div className="space-y-2.5">
          {prescription.map((line) => (
            <ExerciseAccordion
              key={line.instanceId}
              line={line}
              exercise={exerciseById[line.exerciseId] || null}
              entry={session?.entries?.[line.instanceId] || null}
              lastPerf={lastPerf.byInstance[line.instanceId] || null}
              note={notes[line.exerciseId] || ''}
              expanded={openId === line.instanceId}
              onToggle={() => setOpenId((id) => (id === line.instanceId ? null : line.instanceId))}
              onSave={(entry) => saveEntry(line, entry)}
              onClear={() => clearEntry(currentUid, dateKey, line.instanceId, currentUid)}
              onOpenDetail={onOpenExercise}
              onSaveNote={(exerciseId, text) => saveNote(currentUid, exerciseId, text, currentUid)}
            />
          ))}
        </div>
      )}

    </div>
  )
}

// Le lundi, la pesée se fait en début de séance. Simple rappel, pas un blocage.
function WeighInNudge({ dateKey, onGo }) {
  const { weights } = useWeights()
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => { setDismissed(false) }, [dateKey])

  if (dismissed) return null
  if (weights.some((w) => w.date === dateKey)) return null

  return (
    <button
      onClick={() => { setDismissed(true); onGo?.() }}
      className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl border border-accent/30 bg-accent/5 text-left"
    >
      <Scale size={18} className="shrink-0 text-accent" />
      <span className="flex-1 text-sm text-fg">Pesée du lundi — c'est le moment</span>
      <ArrowRight size={16} className="shrink-0 text-accent" />
    </button>
  )
}

function EmptyDay() {
  return (
    <div className="text-center py-14 px-6 rounded-2xl border border-dashed border-border">
      <Dumbbell size={28} className="mx-auto text-faint" />
      <p className="text-base font-medium text-fg mt-3">Rien de prévu aujourd'hui</p>
      <p className="text-sm text-muted mt-1">
        Repos — ou ajoute des exercices à ce jour dans les réglages.
      </p>
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[68px] rounded-2xl border border-border bg-surface animate-pulse" />
      ))}
    </div>
  )
}
