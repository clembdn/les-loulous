import { useState, useMemo, useCallback, useEffect } from 'react'
import { Dumbbell, Scale, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import {
  toLocalDateKey, fromLocalDateKey, shiftDateKey, weekParity, isoDayOfWeek, formatDayFr,
} from '@/shared/lib/dates.js'
import { cn } from '@/shared/lib/utils.js'
import {
  useExercises, useProgram, useSession, useLastPerf, useWeights, useNotes,
} from '../hooks/useMuscData.js'
import { saveEntry, clearEntry, hasWork, isEntryComplete } from '../services/sessionsService.js'
import { withoutOrphans } from '../services/programService.js'
import { saveNote } from '../services/notesService.js'
import SessionPlanControl from '../components/session/SessionPlanControl.jsx'
import ExerciseAccordion from '../components/session/ExerciseAccordion.jsx'

// On peut rattraper une séance oubliée jusqu'à une semaine en arrière. Au-delà,
// le programme a pu changer : ce qui s'est passé se lit dans Progrès.
const BACKFILL_DAYS = 6

// La parité/le jour forcés valent pour UNE date : on rouvre l'appli entre deux
// séries, le choix doit tenir — mais pas déborder sur demain.
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
  const todayKey = useMemo(() => toLocalDateKey(new Date()), [])
  const [dateKey, setDateKey] = useState(todayKey)
  const [openId, setOpenId] = useState(null)

  const isToday = dateKey === todayKey
  const oldestKey = useMemo(() => shiftDateKey(todayKey, -BACKFILL_DAYS), [todayKey])

  // Le jour et la parité découlent de la DATE affichée. Le contrôle de plan ne
  // fait que substituer une autre prescription — il n'écrit rien.
  const natural = useMemo(() => {
    const date = fromLocalDateKey(dateKey)
    return { parity: weekParity(date), dayOfWeek: isoDayOfWeek(date) }
  }, [dateKey])

  /**
   * L'override est lu depuis localStorage EN DIRECT, pas recopié dans un state
   * mis à jour par un effet. Un effet ne tourne qu'APRÈS le rendu qui a changé
   * `dateKey` : entre les deux, l'écran affichait un instant la nouvelle date
   * avec l'override de l'ANCIENNE — visible et déroutant en cliquant vite sur
   * les flèches. `planVersion` ne sert qu'à forcer une relecture après une
   * écriture (`applyPlan` / `resetPlan`), sans jamais désynchroniser de `dateKey`.
   */
  const [planVersion, setPlanVersion] = useState(0)
  const override = useMemo(() => readStoredPlan(dateKey), [dateKey, planVersion])
  useEffect(() => { setOpenId(null) }, [dateKey])

  const plan = override || natural
  const isForced = plan.parity !== natural.parity || plan.dayOfWeek !== natural.dayOfWeek

  const { exerciseById, isLoading: exercisesLoading } = useExercises()
  const { session, isLoading: sessionLoading } = useSession(dateKey)
  const { lastPerf } = useLastPerf()
  const { notes } = useNotes()
  // Les deux parités sont suivies en permanence : forcer la semaine doit
  // basculer la prescription sans attendre une lecture.
  const even = useProgram('even')
  const odd = useProgram('odd')

  const programDays = plan.parity === 'even' ? even.days : odd.days

  // Un mouvement supprimé du catalogue n'a plus rien à faire dans la séance.
  const catalogueReady = !exercisesLoading
  const visible = useCallback(
    (lines) => withoutOrphans(lines, exerciseById, catalogueReady),
    [exerciseById, catalogueReady],
  )

  /**
   * Ce qui s'affiche : la prescription du jour, lue EN DIRECT dans le
   * programme. Rien n'est figé dans la séance : changer de jour ou de parité
   * change simplement la liste, sans jamais rien écrire.
   *
   * « Hors programme » retrouve ce qui a été saisi sous une AUTRE prescription
   * ce jour-là (rattrapage forcé, ou programme changé depuis) — mais
   * UNIQUEMENT sur la vue naturelle. Le document de séance ne change pas
   * quand on force un jour : deux clics différents dans le sélecteur de jour
   * donnaient donc accès au MÊME `session.entries`, et cette section
   * réaffichait alors le même contenu pour chaque jour cliqué — d'où
   * l'impression d'« une seule séance recopiée partout ». En vue forcée, on
   * ne montre plus que la prescription forcée elle-même : ce qu'on y a saisi
   * réapparaît ici, en une fois, dès qu'on revient à la vue naturelle.
   */
  const { lines, extras } = useMemo(() => {
    const prescribed = visible(programDays?.[plan.dayOfWeek] || []).map((l, i) => ({
      instanceId: l.instanceId,
      exerciseId: l.exerciseId,
      name: exerciseById[l.exerciseId]?.name || l.name || '',
      order: i,
      prescribedSets: l.sets,
      prescribedReps: l.reps,
    }))
    if (isForced) return { lines: prescribed, extras: [] }

    const known = new Set(prescribed.map((l) => l.instanceId))
    const off = Object.values(session?.entries || {})
      .filter((e) => !known.has(e.instanceId) && hasWork(e))
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        instanceId: e.instanceId,
        exerciseId: e.exerciseId,
        name: exerciseById[e.exerciseId]?.name || e.name || 'Exercice supprimé',
        order: e.order,
        prescribedSets: e.prescribedSets,
        prescribedReps: e.prescribedReps,
      }))
    return { lines: prescribed, extras: off }
  }, [programDays, plan.dayOfWeek, exerciseById, session, visible, isForced])

  const dayCounts = useMemo(
    () => Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, visible(programDays?.[d] || []).length])),
    [programDays, visible],
  )

  const applyPlan = useCallback((next) => {
    try { localStorage.setItem(planStorageKey(dateKey), JSON.stringify(next)) } catch { /* mode privé */ }
    setPlanVersion((v) => v + 1)
    setOpenId(null)
  }, [dateKey])

  const resetPlan = useCallback(() => {
    try { localStorage.removeItem(planStorageKey(dateKey)) } catch { /* mode privé */ }
    setPlanVersion((v) => v + 1)
    setOpenId(null)
  }, [dateKey])

  const save = useCallback((line, { sets, skipped }) => {
    saveEntry(
      currentUid, dateKey,
      { ...line, sets, skipped },
      plan, currentUid, lastPerf,
    )
  }, [currentUid, dateKey, plan, lastPerf])

  const isLoading = exercisesLoading || sessionLoading || even.isLoading || odd.isLoading
  const total = lines.length
  const doneCount = lines.filter((l) => isEntryComplete(session?.entries?.[l.instanceId])).length

  const renderLine = (line, extra) => (
    <ExerciseAccordion
      key={line.instanceId}
      line={line}
      extra={extra}
      exercise={exerciseById[line.exerciseId] || null}
      entry={session?.entries?.[line.instanceId] || null}
      lastPerf={lastPerf.byInstance[line.instanceId] || null}
      note={notes[line.exerciseId] || ''}
      expanded={openId === line.instanceId}
      onToggle={() => setOpenId((id) => (id === line.instanceId ? null : line.instanceId))}
      onSave={(entry) => save(line, entry)}
      onClear={() => clearEntry(currentUid, dateKey, line.instanceId, currentUid)}
      onOpenDetail={onOpenExercise}
      onSaveNote={(exerciseId, text) => saveNote(currentUid, exerciseId, text, currentUid)}
    />
  )

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <DateNav
            label="Jour précédent"
            onClick={() => setDateKey((k) => shiftDateKey(k, -1))}
            disabled={dateKey <= oldestKey}
          >
            <ChevronLeft size={18} />
          </DateNav>

          <div className="flex-1 min-w-0 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-faint">
              {isToday ? 'Séance du jour' : 'Rattrapage'}
            </p>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-0.5 first-letter:uppercase truncate">
              {formatDayFr(fromLocalDateKey(dateKey))}
            </h1>
          </div>

          <DateNav
            label="Jour suivant"
            onClick={() => setDateKey((k) => shiftDateKey(k, 1))}
            disabled={isToday}
          >
            <ChevronRight size={18} />
          </DateNav>
        </div>

        <div className="flex items-center justify-center gap-3 mt-1">
          {total > 0 && (
            <span className="text-sm text-muted tabular">
              {doneCount}/{total} exercice{total > 1 ? 's' : ''} terminé{doneCount > 1 ? 's' : ''}
            </span>
          )}
          {!isToday && (
            <button
              onClick={() => setDateKey(todayKey)}
              className="text-sm text-accent hover:opacity-80 transition"
            >
              Aujourd'hui
            </button>
          )}
        </div>
      </header>

      <SessionPlanControl
        parity={plan.parity}
        dayOfWeek={plan.dayOfWeek}
        naturalDayOfWeek={natural.dayOfWeek}
        dayCounts={dayCounts}
        isForced={isForced}
        onChange={applyPlan}
        onReset={resetPlan}
      />

      {isToday && plan.dayOfWeek === 1 && <WeighInNudge dateKey={dateKey} onGo={onOpenWeight} />}

      {isLoading && total === 0 ? (
        <SkeletonList />
      ) : total === 0 && extras.length === 0 ? (
        <EmptyDay />
      ) : (
        <div className="space-y-2.5">
          {lines.map((line) => renderLine(line, false))}
        </div>
      )}

      {extras.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs uppercase tracking-[0.18em] text-faint mb-2">Hors programme</h2>
          <p className="text-[11px] text-faint mb-2.5 leading-relaxed">
            Saisi ce jour-là sous une autre prescription — à corriger ou à retirer.
          </p>
          <div className="space-y-2.5">
            {extras.map((line) => renderLine(line, true))}
          </div>
        </section>
      )}
    </div>
  )
}

function DateNav({ onClick, disabled, label, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'h-11 w-11 shrink-0 rounded-xl border border-border flex items-center justify-center',
        'text-muted transition active:scale-95',
        'hover:text-fg hover:border-border-strong',
        'disabled:opacity-25 disabled:pointer-events-none',
      )}
    >
      {children}
    </button>
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
      <p className="text-base font-medium text-fg mt-3">Rien de prévu ce jour-là</p>
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
