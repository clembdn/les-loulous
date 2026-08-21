import { useState, useMemo, useCallback, useEffect } from 'react'
import { Dumbbell, Scale, ArrowRight } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { toDateId, weekParity, isoDayOfWeek, formatDayFr } from '@/shared/lib/dates.js'
import { useExercises, useProgram, useSession, useLastPerf, useWeights } from '../hooks/useMuscData.js'
import { upsertEntry, clearEntry, updateSessionPlan } from '../services/sessionsService.js'
import SessionPlanControl from '../components/session/SessionPlanControl.jsx'
import ExerciseAccordion from '../components/session/ExerciseAccordion.jsx'

// La parité/le jour forcés valent pour la journée en cours seulement : on
// rouvre l'appli entre deux séries, le choix doit tenir, mais pas déborder
// sur demain.
function planStorageKey(dateId) {
  return `muscauzi:plan:${dateId}`
}

function readStoredPlan(dateId) {
  try {
    const raw = localStorage.getItem(planStorageKey(dateId))
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
  const dateId = toDateId(today)
  const natural = useMemo(
    () => ({ parity: weekParity(today), dayOfWeek: isoDayOfWeek(today) }),
    [today],
  )

  const [override, setOverride] = useState(() => readStoredPlan(dateId))
  const [openId, setOpenId] = useState(null)

  const { exerciseById, isLoading: exercisesLoading } = useExercises()
  const { session, isLoading: sessionLoading } = useSession(dateId)
  const { lastPerf } = useLastPerf()
  // Les deux parités sont suivies en permanence : deux documents, et forcer la
  // semaine doit pouvoir re-photographier la séance sans attendre une lecture.
  const even = useProgram('even')
  const odd = useProgram('odd')

  // Une séance déjà commencée porte son propre plan : il fait foi.
  const plan = session?.parity
    ? { parity: session.parity, dayOfWeek: session.dayOfWeek }
    : (override || natural)

  const livePrescription = useMemo(() => {
    const days = plan.parity === 'even' ? even.days : odd.days
    return days?.[plan.dayOfWeek] || []
  }, [plan.parity, plan.dayOfWeek, even.days, odd.days])

  // Une fois la séance créée, on affiche la copie figée : modifier le
  // programme dans les réglages ne doit pas changer la séance en cours.
  const prescription = session ? session.programSnapshot : livePrescription

  const isForced = !session
    ? !!override && (override.parity !== natural.parity || override.dayOfWeek !== natural.dayOfWeek)
    : plan.parity !== natural.parity || plan.dayOfWeek !== natural.dayOfWeek

  const applyPlan = useCallback((next) => {
    setOverride(next)
    try { localStorage.setItem(planStorageKey(dateId), JSON.stringify(next)) } catch { /* mode privé */ }
    // La séance du jour existe déjà : on la re-photographie, c'est une
    // correction du jour en cours et non une réécriture d'historique.
    if (session) {
      const days = next.parity === 'even' ? even.days : odd.days
      updateSessionPlan(currentUid, dateId, {
        parity: next.parity,
        dayOfWeek: next.dayOfWeek,
        programSnapshot: days?.[next.dayOfWeek] || [],
      }, currentUid)
    }
  }, [dateId, session, even.days, odd.days, currentUid])

  const resetPlan = useCallback(() => {
    applyPlan(natural)
    try { localStorage.removeItem(planStorageKey(dateId)) } catch { /* mode privé */ }
    setOverride(null)
  }, [applyPlan, natural, dateId])

  const saveEntry = useCallback((exerciseId, entry) => {
    // `meta` n'est transmis qu'à la création : le snapshot est figé ensuite.
    const meta = session ? null : {
      parity: plan.parity,
      dayOfWeek: plan.dayOfWeek,
      programSnapshot: livePrescription,
    }
    upsertEntry(currentUid, dateId, exerciseId, entry, currentUid, meta)
  }, [currentUid, dateId, session, plan.parity, plan.dayOfWeek, livePrescription])

  const isLoading = exercisesLoading || sessionLoading || even.isLoading || odd.isLoading
  const doneCount = prescription.filter((l) => {
    const e = session?.entries?.[l.exerciseId]
    return e && (e.skipped || (e.sets?.filter((s) => s.reps > 0).length || 0) >= l.sets)
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
        isForced={isForced}
        onChange={applyPlan}
        onReset={resetPlan}
      />

      {plan.dayOfWeek === 1 && <WeighInNudge dateId={dateId} onGo={onOpenWeight} />}

      {isLoading && prescription.length === 0 ? (
        <SkeletonList />
      ) : prescription.length === 0 ? (
        <EmptyDay />
      ) : (
        <div className="space-y-2.5">
          {prescription.map((line) => {
            const exercise = exerciseById[line.exerciseId]
            if (!exercise) return null
            return (
              <ExerciseAccordion
                key={line.exerciseId}
                exercise={exercise}
                line={line}
                entry={session?.entries?.[line.exerciseId] || null}
                lastPerf={lastPerf[line.exerciseId] || null}
                expanded={openId === line.exerciseId}
                onToggle={() => setOpenId((id) => (id === line.exerciseId ? null : line.exerciseId))}
                onSave={(entry) => saveEntry(line.exerciseId, entry)}
                onClear={() => clearEntry(currentUid, dateId, line.exerciseId, currentUid)}
                onOpenDetail={onOpenExercise}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// Le lundi, la pesée se fait en début de séance. Simple rappel, pas un blocage.
function WeighInNudge({ dateId, onGo }) {
  const { weights } = useWeights()
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => { setDismissed(false) }, [dateId])

  if (dismissed) return null
  if (weights.some((w) => w.date === dateId)) return null

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
