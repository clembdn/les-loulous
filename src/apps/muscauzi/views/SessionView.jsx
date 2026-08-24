import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Dumbbell, Scale, ArrowRight, ChevronLeft, ChevronRight, X, MoveHorizontal,
} from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import {
  toLocalDateKey, fromLocalDateKey, shiftDateKey, weekParity, isoDayOfWeek, formatDayFr,
} from '@/shared/lib/dates.js'
import { cn } from '@/shared/lib/utils.js'
import { ProgressRing } from '@/shared/ui/Progress.jsx'
import { SkeletonList } from '@/shared/ui/Skeleton.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import {
  useExercises, useProgram, useSession, useLastPerf, useWeights, useNotes,
} from '../hooks/useMuscData.js'
import { saveEntry, clearEntry, hasWork, isEntryComplete } from '../services/sessionsService.js'
import { withoutOrphans } from '../services/programService.js'
import { saveNote } from '../services/notesService.js'
import ExerciseAccordion from '../components/session/ExerciseAccordion.jsx'
import RestTimer from '../components/session/RestTimer.jsx'
import SessionSummary from '../components/session/SessionSummary.jsx'

// On peut rattraper une séance oubliée jusqu'à une semaine en arrière. Au-delà,
// le programme a pu changer : ce qui s'est passé se lit dans Progrès.
const BACKFILL_DAYS = 6

// Repos par défaut, puis la dernière durée choisie. Réglé une fois pour toutes
// à la première séance : personne ne veut rouvrir un écran de réglages entre
// deux séries.
const REST_KEY = 'muscauzi.restSeconds'
const REST_DEFAULT = 90
const REST_MIN = 15
const REST_MAX = 600

const HINT_KEY = 'muscauzi.swipeHintSeen'

// localStorage est indisponible en navigation privée sur certains navigateurs,
// et lève à la lecture comme à l'écriture. Un réglage de confort ne doit pas
// pouvoir empêcher une séance de s'afficher.
function readStored(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? fallback : raw
  } catch { return fallback }
}
function writeStored(key, value) {
  try { window.localStorage.setItem(key, String(value)) } catch { /* tant pis */ }
}

export default function SessionView({ onOpenExercise, onOpenWeight }) {
  const { currentUid } = useAuth()
  const todayKey = useMemo(() => toLocalDateKey(new Date()), [])
  const [dateKey, setDateKey] = useState(todayKey)
  const [openId, setOpenId] = useState(null)

  const isToday = dateKey === todayKey
  const oldestKey = useMemo(() => shiftDateKey(todayKey, -BACKFILL_DAYS), [todayKey])

  // La date affichée détermine SEULE le jour et la parité — aucun forçage
  // séparé : le programme se change dans Réglages, pas ici.
  const { parity, dayOfWeek } = useMemo(() => {
    const date = fromLocalDateKey(dateKey)
    return { parity: weekParity(date), dayOfWeek: isoDayOfWeek(date) }
  }, [dateKey])

  useEffect(() => { setOpenId(null) }, [dateKey])

  const { exerciseById, isLoading: exercisesLoading } = useExercises()
  const { session, isLoading: sessionLoading } = useSession(dateKey)
  const { lastPerf } = useLastPerf()
  const { notes } = useNotes()
  const even = useProgram('even')
  const odd = useProgram('odd')

  const programDays = parity === 'even' ? even.days : odd.days

  // Un mouvement supprimé du catalogue n'a plus rien à faire dans la séance.
  const catalogueReady = !exercisesLoading
  const visible = useCallback(
    (lines) => withoutOrphans(lines, exerciseById, catalogueReady),
    [exerciseById, catalogueReady],
  )

  /**
   * Ce qui s'affiche : la prescription du jour, lue EN DIRECT dans le
   * programme. Rien n'est figé dans la séance : changer de programme dans
   * Réglages change simplement la liste, sans jamais rien écrire ici.
   *
   * « Hors programme » retrouve ce qui a été saisi sous une prescription qui
   * ne correspond plus à celle d'aujourd'hui (programme changé en cours de
   * séance) — pour ne jamais perdre de vue un travail déjà fait.
   */
  const { lines, extras } = useMemo(() => {
    const prescribed = visible(programDays?.[dayOfWeek] || []).map((l, i) => ({
      instanceId: l.instanceId,
      exerciseId: l.exerciseId,
      name: exerciseById[l.exerciseId]?.name || l.name || '',
      order: i,
      prescribedSets: l.sets,
      prescribedReps: l.reps,
    }))
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
  }, [programDays, dayOfWeek, exerciseById, session, visible])

  const save = useCallback((line, { sets, skipped }) => {
    saveEntry(
      currentUid, dateKey,
      { ...line, sets, skipped },
      { parity, dayOfWeek }, currentUid, lastPerf,
    )
  }, [currentUid, dateKey, parity, dayOfWeek, lastPerf])

  // ── Minuteur de repos ──────────────────────────────────────────────────────
  const [restSeconds, setRestSeconds] = useState(
    () => clampRest(Number(readStored(REST_KEY, REST_DEFAULT))),
  )
  const [rest, setRest] = useState(null)
  const restCount = useRef(0)

  const startRest = useCallback((label) => {
    // On ne chronomètre pas un rattrapage : la séance d'hier est déjà finie.
    if (dateKey !== todayKey) return
    restCount.current += 1
    setRest({ id: restCount.current, startedAt: Date.now(), duration: restSeconds, label })
  }, [dateKey, todayKey, restSeconds])

  // Rallonger le repos en cours vaut aussi pour les suivants : c'est le seul
  // endroit où l'on découvre que 90 s ne suffisent pas sur cet exercice-là.
  const adjustRest = useCallback((delta) => {
    setRest((r) => {
      if (!r) return r
      const duration = clampRest(r.duration + delta)
      setRestSeconds(duration)
      writeStored(REST_KEY, duration)
      return { ...r, duration }
    })
  }, [])

  const dismissRest = useCallback(() => setRest(null), [])

  // Changer de jour ferme le minuteur : il appartenait à la séance qu'on quitte.
  useEffect(() => { setRest(null) }, [dateKey])

  const isLoading = exercisesLoading || sessionLoading || even.isLoading || odd.isLoading
  const total = lines.length
  const doneCount = lines.filter(
    (l) => isEntryComplete(session?.entries?.[l.instanceId], l.prescribedSets),
  ).length
  const isSessionDone = total > 0 && doneCount === total

  const renderLine = (line, extra) => (
    <ExerciseAccordion
      // La date fait partie de l'identité : sans elle, passer d'aujourd'hui à
      // hier réutilisait le composant avec ses champs de saisie encore chargés.
      key={`${dateKey}:${line.instanceId}`}
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
      onRest={startRest}
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

        {/* L'avancement se lit en une image plutôt qu'en une fraction : on sait
            où on en est sans lire, téléphone à bout de bras. */}
        {total > 0 && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <ProgressRing size={40} stroke={3.5} value={doneCount} max={total}>
              <span className="text-[11px] font-semibold text-fg tabular">{doneCount}</span>
            </ProgressRing>
            <span className="text-sm text-muted">
              sur {total} exercice{total > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {!isToday && (
          <div className="text-center mt-2">
            <button
              onClick={() => setDateKey(todayKey)}
              className="text-sm text-accent hover:opacity-80 transition"
            >
              Aujourd'hui
            </button>
          </div>
        )}
      </header>

      {isToday && dayOfWeek === 1 && <WeighInNudge dateKey={dateKey} onGo={onOpenWeight} />}

      {isSessionDone && (
        <SessionSummary
          session={session}
          dateKey={dateKey}
          exerciseById={exerciseById}
          onSeeProgress={() => onOpenExercise(null)}
        />
      )}

      {isLoading && total === 0 ? (
        <SkeletonList count={4} className="space-y-2.5" itemClassName="h-[68px] rounded-2xl" />
      ) : total === 0 && extras.length === 0 ? (
        <EmptyDay />
      ) : (
        <>
          {total > 0 && <SwipeHint />}
          <div className="space-y-2.5">
            {lines.map((line) => renderLine(line, false))}
          </div>
        </>
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

      <RestTimer rest={rest} onAdjust={adjustRest} onDismiss={dismissRest} />
    </div>
  )
}

function clampRest(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n)) return REST_DEFAULT
  return Math.min(REST_MAX, Math.max(REST_MIN, Math.round(n)))
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

/**
 * Le geste ne se devine pas : rien à l'écran ne dit qu'une ligne glisse.
 *
 * Un repère montré UNE fois, puis plus jamais — la place d'un mode d'emploi
 * n'est pas au-dessus de la séance qu'on vient ouvrir entre deux séries.
 */
function SwipeHint() {
  const [seen, setSeen] = useState(() => readStored(HINT_KEY, '') === '1')
  if (seen) return null

  const dismiss = () => { writeStored(HINT_KEY, '1'); setSeen(true) }

  return (
    <div className="mb-3 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-dashed border-border-strong">
      <MoveHorizontal size={15} className="shrink-0 text-accent" />
      <p className="flex-1 text-[11px] leading-relaxed text-muted">
        Glisse une série <span className="text-fg">d'un côté ou de l'autre</span> pour la marquer
        faite — ou touche la pastille.
      </p>
      <button
        onClick={dismiss}
        aria-label="J'ai compris"
        className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-faint hover:text-fg transition"
      >
        <X size={14} />
      </button>
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
      <p className="text-base font-medium text-fg mt-3">Rien de prévu ce jour-là</p>
      <p className="text-sm text-muted mt-1">
        Repos — ou ajoute des exercices à ce jour dans les réglages.
      </p>
    </div>
  )
}
