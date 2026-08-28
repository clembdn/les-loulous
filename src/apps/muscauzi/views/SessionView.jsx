import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Plus, Scale, X } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import {
  formatDayFr, fromLocalDateKey, isoDayOfWeek, shiftDateKey, toLocalDateKey, weekParity,
} from '@/shared/lib/dates.js'
import { cn } from '@/shared/lib/utils.js'
import { useMediaQuery } from '@/shared/lib/useMediaQuery.js'
import { Button } from '@/shared/ui/Button.jsx'
import { ProgressRing } from '@/shared/ui/Progress.jsx'
import { SkeletonList } from '@/shared/ui/Skeleton.jsx'
import { useMuscData } from '../context/MuscDataContext.jsx'
import { clearEntry, hasWork, saveEntry } from '../services/sessionsService.js'
import { withoutOrphans } from '../services/programService.js'
import { saveNote } from '../services/notesService.js'
import { doneSets } from '../utils/sets.js'
import { buildPreviousIndex } from '../utils/previous.js'
import { buildRecordIndex } from '../utils/records.js'
import { setScore } from '../utils/metrics.js'
import { newInstanceId } from '../utils/ids.js'
import SessionOverview, { EmptyDay } from '../components/session/SessionOverview.jsx'
import SessionRail from '../components/session/SessionRail.jsx'
import ExerciseFocus from '../components/session/ExerciseFocus.jsx'
import SessionDone from '../components/session/SessionDone.jsx'
import AddExerciseSheet from '../components/session/AddExerciseSheet.jsx'
import ExerciseHistorySheet from '../components/session/ExerciseHistorySheet.jsx'

// On peut rattraper une séance oubliée jusqu'à une semaine en arrière. Au-delà,
// le programme a pu changer : ce qui s'est passé se lit dans Progrès.
const BACKFILL_DAYS = 6

const WIDE = '(min-width: 1024px)'

/**
 * La séance du jour.
 *
 * ── Deux temps, pas un seul ─────────────────────────────────────────────────
 *
 * L'aperçu dit ce qu'il y a à faire ; l'écran d'un exercice sert à le faire. La
 * séparation n'est pas cosmétique : c'est elle qui supprime l'accordéon, donc
 * l'état de saisie caché derrière un repli, donc la moitié des bugs de cet
 * écran. Un seul exercice est monté à la fois, avec une seule date.
 *
 * Sur grand écran les deux tiennent côte à côte — la liste à gauche reste
 * visible, on saute d'un mouvement à l'autre sans repasser par l'aperçu.
 *
 * ── Rien n'est figé dans la séance ──────────────────────────────────────────
 *
 * Ce qui s'affiche est la prescription du jour, lue EN DIRECT dans le
 * programme. Changer de programme dans Réglages change la liste, sans jamais
 * rien réécrire ici. « Hors programme » rattrape ce qui a été saisi sous une
 * prescription qui ne correspond plus — pour ne pas perdre de vue du travail
 * déjà fait.
 */
export default function SessionView({ onOpenExercise, onOpenWeight }) {
  const { currentUid } = useAuth()
  const {
    today, exercises, exerciseById, programs, notes, weights,
    sessions, recentSessions, catalogueReady, isLoading,
  } = useMuscData()

  const [dateKey, setDateKey] = useState(today)
  // null = aperçu · 0..n-1 = un exercice · lines.length = le bilan
  const [cursor, setCursor] = useState(null)
  const [adding, setAdding] = useState(false)
  const [historyFor, setHistoryFor] = useState(null)
  const isWide = useMediaQuery(WIDE)

  /**
   * Les mouvements ajoutés à la volée, tant qu'ils sont VIDES.
   *
   * Une entrée de séance n'existe dans Firestore qu'une fois qu'on y a saisi
   * quelque chose. Écrire un document vide à l'ajout aurait laissé traîner des
   * exercices fantômes chaque fois qu'on en ouvre un pour rien. On les tient
   * donc ici jusqu'à la première série ; ensuite, ils reviennent d'eux-mêmes
   * par « hors programme » et cette liste ne fait plus que les dédoublonner.
   */
  const [added, setAdded] = useState([])
  useEffect(() => { setAdded([]) }, [dateKey])

  // La date du jour change à minuit : si on était resté sur « aujourd'hui »,
  // on suit. Si on était en rattrapage, on y reste — c'était un choix.
  const [pinned, setPinned] = useState(false)
  useEffect(() => { if (!pinned) setDateKey(today) }, [today, pinned])

  const isToday = dateKey === today
  const oldestKey = useMemo(() => shiftDateKey(today, -BACKFILL_DAYS), [today])

  const goToDate = useCallback((next) => {
    setDateKey(next)
    setPinned(next !== toLocalDateKey(new Date()))
    setCursor(null)
  }, [])

  // La date affichée détermine SEULE le jour et la parité — aucun forçage
  // séparé : le programme se change dans Réglages, pas ici.
  const { parity, dayOfWeek } = useMemo(() => {
    const date = fromLocalDateKey(dateKey)
    return { parity: weekParity(date), dayOfWeek: isoDayOfWeek(date) }
  }, [dateKey])

  // La séance du jour se lit dans la fenêtre déjà ouverte par le contexte :
  // pas d'écoute supplémentaire pour un document qu'on a déjà.
  const session = useMemo(
    () => recentSessions.find((s) => s.date === dateKey) || null,
    [recentSessions, dateKey],
  )

  const program = programs[parity]
  const programDays = program.days
  // Le nom du jour au programme : c'est lui qu'on recopie dans la séance et
  // qu'on affiche en tête.
  const sessionName = program.names?.[dayOfWeek] || ''

  const { lines, extras } = useMemo(() => {
    const prescribed = withoutOrphans(programDays?.[dayOfWeek] || [], exerciseById, catalogueReady)
      .map((l, i) => ({
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
    // Un ajout qui a reçu sa première série est déjà revenu par `off` : on ne
    // garde de la liste locale que ce qui n'est pas encore enregistré.
    const saved = new Set(off.map((l) => l.instanceId))
    return { lines: prescribed, extras: [...off, ...added.filter((l) => !saved.has(l.instanceId))] }
  }, [programDays, dayOfWeek, exerciseById, session, catalogueReady, added])

  // L'ordre de parcours : la prescription du jour, puis le hors-programme.
  const walk = useMemo(() => [...lines, ...extras], [lines, extras])

  const previousIndex = useMemo(
    () => buildPreviousIndex(recentSessions, dateKey),
    [recentSessions, dateKey],
  )

  /**
   * Les records personnels, sur TOUT l'historique et sans la séance du jour.
   *
   * Sans cette exclusion, la première série d'aujourd'hui deviendrait le record
   * et aucune des suivantes ne pourrait plus l'annoncer — exactement le piège
   * qui vidait le rappel « dernière fois ».
   */
  const recordIndex = useMemo(
    () => buildRecordIndex(sessions, dateKey, (set, exerciseId) => setScore(set, exerciseById[exerciseId])),
    [sessions, dateKey, exerciseById],
  )

  /**
   * Ajouter un mouvement à la séance du jour.
   *
   * La prescription se déduit de la dernière fois — même nombre de séries, même
   * nombre de répétitions. C'est la meilleure hypothèse disponible, et elle
   * évite d'ouvrir un exercice sur « 3 × 10 » arbitraires quand on en faisait
   * quatre séries de six la semaine dernière.
   */
  const addExerciseToDay = useCallback((exercise) => {
    const previous = previousIndex[exercise.id]
    const line = {
      instanceId: newInstanceId(),
      exerciseId: exercise.id,
      name: exercise.name,
      order: 1000 + added.length,
      prescribedSets: previous?.sets?.length || 3,
      prescribedReps: previous?.sets?.[0]?.reps || 10,
    }
    setAdded((prev) => [...prev, line])
    // On ouvre directement le mouvement qu'on vient de choisir : personne
    // n'ajoute un exercice pour aller le chercher ensuite dans la liste.
    setCursor(lines.length + extras.length)
  }, [previousIndex, added.length, lines.length, extras.length])

  /**
   * Retirer une occurrence hors programme.
   *
   * Il faut la retirer des DEUX endroits où elle peut vivre : le document de
   * séance si elle a déjà reçu une série, et la liste locale si elle n'en a pas
   * encore. N'effacer que Firestore la faisait réapparaître aussitôt, vide,
   * puisque l'ajout local, lui, était toujours là.
   */
  const removeExtra = useCallback((instanceId) => {
    clearEntry(currentUid, dateKey, instanceId, currentUid)
    setAdded((prev) => prev.filter((l) => l.instanceId !== instanceId))
    // L'exercice qu'on regardait n'existe plus : on revient à la liste plutôt
    // que de laisser le curseur sur un rang qui a glissé.
    setCursor(null)
  }, [currentUid, dateKey])

  const save = useCallback((line, { sets, skipped }) => {
    saveEntry(
      currentUid, dateKey,
      { ...line, sets, skipped },
      { parity, dayOfWeek, name: sessionName }, currentUid,
    )
  }, [currentUid, dateKey, parity, dayOfWeek, sessionName])

  const total = walk.length
  const doneCount = walk.filter((l) => {
    const entry = session?.entries?.[l.instanceId]
    return entry?.skipped || doneSets(entry).length >= l.prescribedSets
  }).length

  // « Commencer » ouvre le premier exercice qui reste à faire, pas le premier
  // de la liste : reprendre une séance interrompue ne doit pas se payer de
  // quatre appuis sur « Suivant ».
  const firstUnfinished = useMemo(() => {
    const i = walk.findIndex((l) => {
      const entry = session?.entries?.[l.instanceId]
      return !(entry?.skipped || doneSets(entry).length >= l.prescribedSets)
    })
    return i === -1 ? 0 : i
  }, [walk, session])

  // Sur grand écran il n'y a pas d'aperçu séparé : le rail tient la liste, donc
  // il faut toujours quelque chose à droite.
  const active = isWide && cursor === null ? firstUnfinished : cursor
  const showFocus = active !== null && total > 0

  const focusLine = showFocus && active < total ? walk[active] : null
  const showDone = showFocus && active >= total

  const skeleton = isLoading && total === 0

  const header = (
    <header className="mb-5">
      <div className="flex items-center gap-2">
        <DateNav
          label="Jour précédent"
          onClick={() => goToDate(shiftDateKey(dateKey, -1))}
          disabled={dateKey <= oldestKey}
        >
          <ChevronLeft size={18} />
        </DateNav>

        <div className="flex-1 min-w-0 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-faint truncate">
            {/* Le nom passe DEVANT la date : c'est lui qui dit ce qu'on vient
                faire aujourd'hui, et il rattache la séance à toutes les autres
                du même nom. */}
            {sessionName || (isToday ? 'Séance du jour' : 'Rattrapage')}
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-0.5 first-letter:uppercase truncate">
            {formatDayFr(fromLocalDateKey(dateKey))}
          </h1>
        </div>

        <DateNav
          label="Jour suivant"
          onClick={() => goToDate(shiftDateKey(dateKey, 1))}
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
            onClick={() => goToDate(today)}
            className="text-sm text-accent hover:opacity-80 transition"
          >
            Aujourd'hui
          </button>
        </div>
      )}
    </header>
  )

  const focus = focusLine && (
    <ExerciseFocus
      // La date fait partie de l'identité : sans elle, passer d'aujourd'hui à
      // hier réutiliserait le composant avec ses champs encore chargés.
      key={`${dateKey}:${focusLine.instanceId}`}
      line={focusLine}
      extra={active >= lines.length}
      exercise={exerciseById[focusLine.exerciseId] || null}
      entry={session?.entries?.[focusLine.instanceId] || null}
      previous={previousIndex[focusLine.exerciseId] || null}
      record={recordIndex[focusLine.exerciseId] || null}
      note={notes[focusLine.exerciseId] || ''}
      index={active}
      total={total}
      // Sur grand écran il n'y a pas d'aperçu où revenir : au premier exercice,
      // le bouton n'a plus de destination, il s'éteint plutôt que de mentir.
      prevLabel={active > 0 ? 'Précédent' : (isWide ? null : 'Aperçu')}
      onPrev={() => setCursor(active === 0 ? null : active - 1)}
      onNext={() => setCursor(active + 1)}
      onSave={(entry) => save(focusLine, entry)}
      onClear={() => clearEntry(currentUid, dateKey, focusLine.instanceId, currentUid)}
      onRemove={() => removeExtra(focusLine.instanceId)}
      onOpenDetail={(exerciseId) => setHistoryFor(exerciseId)}
      onSaveNote={(exerciseId, text) => saveNote(currentUid, exerciseId, text, currentUid)}
    />
  )

  const done = showDone && (
    <SessionDone
      session={session}
      dateKey={dateKey}
      name={sessionName}
      parity={parity}
      dayOfWeek={dayOfWeek}
      exerciseById={exerciseById}
      recentSessions={recentSessions}
      records={recordIndex}
      onBack={() => setCursor(isWide ? total - 1 : null)}
      onSeeProgress={() => onOpenExercise(null)}
    />
  )

  // ── Grand écran : la liste et l'exercice côte à côte ───────────────────────
  if (isWide) {
    return (
      <div className="max-w-xl lg:max-w-5xl mx-auto px-4 pt-5 pb-10 lg:pt-8 lg:px-6">
        {header}
        {skeleton ? (
          <SkeletonList count={4} className="space-y-2.5" itemClassName="h-[68px] rounded-2xl" />
        ) : total === 0 ? (
          <>
            <EmptyDay />
            <Button variant="dashed" size="lg" className="w-full mt-4" onClick={() => setAdding(true)}>
              <Plus size={16} /> Ajouter un exercice
            </Button>
          </>
        ) : (
          <div className="grid grid-cols-[minmax(0,17rem)_1fr] gap-8 items-start">
            <SessionRail
              lines={walk}
              session={session}
              activeIndex={active}
              onSelect={setCursor}
              onFinish={() => setCursor(total)}
              onAdd={() => setAdding(true)}
            />
            <div className="min-w-0">{done || focus}</div>
          </div>
        )}
        <WeighInNudge show={isToday && dayOfWeek === 1} weights={weights} dateKey={dateKey} onGo={onOpenWeight} />
      <AddExerciseSheet
        open={adding}
        onOpenChange={setAdding}
        exercises={exercises}
        previousIndex={previousIndex}
        onPick={addExerciseToDay}
      />

      <ExerciseHistorySheet
        open={!!historyFor}
        onOpenChange={(next) => { if (!next) setHistoryFor(null) }}
        exercise={exerciseById[historyFor] || null}
        sessions={sessions}
        notes={notes}
        onSaveNote={(exerciseId, text) => saveNote(currentUid, exerciseId, text, currentUid)}
      />
      </div>
    )
  }

  // ── Téléphone : l'exercice REMPLACE l'aperçu ──────────────────────────────
  if (showFocus) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-4 pb-24">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setCursor(null)}
            aria-label="Revenir à la séance"
            className="h-9 w-9 shrink-0 rounded-lg border border-border flex items-center justify-center
                       text-muted hover:text-fg transition active:scale-95"
          >
            <X size={16} />
          </button>
          <p className="flex-1 min-w-0 text-sm font-medium text-fg truncate first-letter:uppercase">
            {sessionName || formatDayFr(fromLocalDateKey(dateKey))}
          </p>
          <span className="shrink-0 text-xs text-faint tabular">{doneCount}/{total}</span>
        </div>
        {done || focus}
      <AddExerciseSheet
        open={adding}
        onOpenChange={setAdding}
        exercises={exercises}
        previousIndex={previousIndex}
        onPick={addExerciseToDay}
      />

      <ExerciseHistorySheet
        open={!!historyFor}
        onOpenChange={(next) => { if (!next) setHistoryFor(null) }}
        exercise={exerciseById[historyFor] || null}
        sessions={sessions}
        notes={notes}
        onSaveNote={(exerciseId, text) => saveNote(currentUid, exerciseId, text, currentUid)}
      />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-24">
      {header}

      {skeleton ? (
        <SkeletonList count={4} className="space-y-2.5" itemClassName="h-[68px] rounded-2xl" />
      ) : total === 0 ? (
        <EmptyDay />
      ) : (
        <SessionOverview
          lines={lines}
          extras={extras}
          session={session}
          exerciseById={exerciseById}
          onOpen={setCursor}
          onStart={() => setCursor(doneCount === total ? total : firstUnfinished)}
          startLabel={doneCount === 0 ? 'Commencer' : doneCount === total ? 'Voir le bilan' : 'Reprendre'}
          onAdd={() => setAdding(true)}
        />
      )}

      {/* Un jour de repos aussi peut recevoir une séance improvisée : le bouton
          d'ajout ne dépend pas du programme. */}
      {!skeleton && total === 0 && (
        <Button variant="dashed" size="lg" className="w-full mt-4" onClick={() => setAdding(true)}>
          <Plus size={16} /> Ajouter un exercice
        </Button>
      )}

      <WeighInNudge show={isToday && dayOfWeek === 1} weights={weights} dateKey={dateKey} onGo={onOpenWeight} />
      <AddExerciseSheet
        open={adding}
        onOpenChange={setAdding}
        exercises={exercises}
        previousIndex={previousIndex}
        onPick={addExerciseToDay}
      />

      <ExerciseHistorySheet
        open={!!historyFor}
        onOpenChange={(next) => { if (!next) setHistoryFor(null) }}
        exercise={exerciseById[historyFor] || null}
        sessions={sessions}
        notes={notes}
        onSaveNote={(exerciseId, text) => saveNote(currentUid, exerciseId, text, currentUid)}
      />
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

/**
 * Le lundi, la pesée se fait en début de séance.
 *
 * En PIED d'écran, plus en tête : posé au-dessus de la liste, il décalait
 * chaque lundi tout ce qu'on venait ouvrir. C'est un rappel, pas une étape.
 */
function WeighInNudge({ show, weights, dateKey, onGo }) {
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => { setDismissed(false) }, [dateKey])

  if (!show || dismissed) return null
  if (weights.some((w) => w.date === dateKey)) return null

  return (
    <button
      onClick={() => { setDismissed(true); onGo?.() }}
      className="w-full mt-6 flex items-center gap-3 px-4 py-3 rounded-2xl border border-accent/30 bg-accent/5 text-left"
    >
      <Scale size={18} className="shrink-0 text-accent" />
      <span className="flex-1 text-sm text-fg">Pesée du lundi — c'est le moment</span>
      <ArrowRight size={16} className="shrink-0 text-accent" />
    </button>
  )
}
