import { useMemo, useState } from 'react'
import {
  CalendarRange, ChevronDown, ChevronUp, Copy, Feather, Minus, Plus, Search, Tag, Trash2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.jsx'
import { SkeletonList } from '@/shared/ui/Skeleton.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import {
  dayLabel, formatDayFr, fromLocalDateKey, isoDayOfWeek, weekParity,
} from '@/shared/lib/dates.js'
import { cn } from '@/shared/lib/utils.js'
import { useMuscData } from '../context/MuscDataContext.jsx'
import {
  DOWS, MAX_DAY_NAME, copyLines, resolveLineName, saveAlternateWeeks, saveProgramDay, saveProgramDayName,
  saveProgramWeek, withoutOrphans,
} from '../services/programService.js'
import { saveLightWeekStart } from '../services/settingsService.js'
import { isInLightWeek, lightWeekEnd } from '../utils/lightWeek.js'
import { SETTINGS_SUBS } from '../config/navigation.js'
import PageHeader from '../components/layout/PageHeader.jsx'
import DayPicker from '../components/program/DayPicker.jsx'
import CopyDayMenu from '../components/program/CopyDayMenu.jsx'
import { newInstanceId } from '../utils/ids.js'

// Le choix de parité est un contrôle segmenté comme les autres : deux boutons
// pleins côte à côte laissaient croire à deux actions, pas à un choix entre
// deux états d'un même écran.
const PARITY_TABS = [
  { id: 'odd',  label: 'Semaine impaire', short: 'Impaire' },
  { id: 'even', label: 'Semaine paire',   short: 'Paire' },
]

const PARITY_LABEL = { even: 'paire', odd: 'impaire' }

/**
 * L'éditeur de programme : parité × jour de la semaine, propre à chaque profil.
 *
 * L'alternance paire/impaire est un RÉGLAGE du profil. Coupée, il n'y a plus
 * qu'un programme — le pair — et l'onglet impair disparaît ; le programme
 * impair n'est pas effacé pour autant, il revient tel quel si on réactive.
 *
 * Toute modification ici est sans effet sur les séances déjà enregistrées —
 * chacune porte sa propre copie de la prescription et de son libellé.
 *
 * Le glissement latéral a disparu des lignes. Il dupliquait d'un côté et
 * supprimait de l'autre, deux gestes à retenir pour des actions qu'on déclenche
 * quelques fois par mois, et il fallait s'en souvenir dans le bon sens sous
 * peine d'effacer une ligne en voulant la copier. Les boutons faisaient déjà
 * exactement la même chose, en le disant.
 */
export default function ProgramView({ onNavigate }) {
  const { currentUid } = useAuth()
  const {
    exercises, exerciseById, programs, catalogueReady, isLoading, alternateWeeks, settingsReady,
    today, lightWeekStart, prefsReady,
  } = useMuscData()

  const [chosenParity, setParity] = useState(() => weekParity(new Date()))
  const parity = alternateWeeks ? chosenParity : 'even'
  const [dayOfWeek, setDayOfWeek] = useState(() => isoDayOfWeek(new Date()))
  const [picking, setPicking] = useState(false)
  const [copying, setCopying] = useState(false)
  const [pendingCopy, setPendingCopy] = useState(null)

  const program = programs[parity]
  const other = parity === 'even' ? 'odd' : 'even'

  // Le catalogue fait foi : une ligne qui ne pointe sur aucun exercice n'est
  // pas affichée, et la première modification du jour la fait disparaître du
  // document.
  const lines = useMemo(
    () => withoutOrphans(program.days[dayOfWeek] || [], exerciseById, catalogueReady),
    [program, dayOfWeek, exerciseById, catalogueReady],
  )

  const countsFor = (p) => Object.fromEntries(
    DOWS.map((d) => [d, withoutOrphans(programs[p].days[d] || [], exerciseById, catalogueReady).length]),
  )
  const dayCounts = useMemo(() => countsFor(parity), [programs, parity, exerciseById, catalogueReady])
  const otherCounts = useMemo(() => countsFor(other), [programs, other, exerciseById, catalogueReady])
  const weekCount = useMemo(
    () => DOWS.reduce((n, d) => n + dayCounts[d], 0),
    [dayCounts],
  )

  // Firestore renvoie l'écriture depuis son cache local : pas d'état de
  // brouillon à maintenir, on repart toujours de `lines`.
  const commit = (next) => {
    saveProgramDay(currentUid, parity, dayOfWeek, next, currentUid)
      .catch(() => toast.error('Enregistrement impossible'))
  }

  // Un ajout crée TOUJOURS une occurrence neuve — y compris pour un mouvement
  // déjà présent : un même exercice peut légitimement figurer deux fois.
  const addLine = (exerciseId) => {
    // Valeurs de départ : 4 × 8, le plus courant — ça s'ajuste juste après.
    commit([...lines, {
      instanceId: newInstanceId(),
      exerciseId,
      name: exerciseById[exerciseId]?.name || '',
      sets: 4, reps: 8, repsMin: 8, repsMax: 8, order: lines.length,
    }])
    setPicking(false)
  }

  const duplicateLine = (index) => {
    const next = [...lines]
    next.splice(index + 1, 0, { ...lines[index], instanceId: newInstanceId() })
    commit(next)
  }

  // Modifier séries/reps ou déplacer une occurrence CONSERVE son instanceId :
  // la case du programme reste la même, seul son contenu change.
  const updateLine = (index, patch) => {
    commit(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const removeLine = (index) => commit(lines.filter((_, i) => i !== index))

  const move = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= lines.length) return
    const next = [...lines]
    ;[next[index], next[target]] = [next[target], next[index]]
    commit(next)
  }

  const toggleAlternate = (next) => {
    saveAlternateWeeks(currentUid, next, currentUid)
      .catch(() => toast.error('Enregistrement impossible'))
    // Couper l'alternance n'efface rien : on le dit, c'est la première chose
    // qu'on se demande en appuyant.
    toast(next
      ? 'Alternance réactivée — ta semaine impaire est de retour.'
      : 'Un seul programme pour toutes les semaines. Ta semaine impaire est gardée de côté.')
  }

  const renameDay = (name) => {
    saveProgramDayName(currentUid, parity, dayOfWeek, name, currentUid)
      .catch(() => toast.error('Enregistrement impossible'))
  }

  // ── Copies ────────────────────────────────────────────────────────────────

  const askCopy = (payload) => {
    // On ne confirme que si la copie EFFACE quelque chose. Écraser du vide
    // n'est pas une décision, et une boîte de dialogue qui s'ouvre pour rien
    // finit par se cliquer sans être lue.
    const wipes = payload.kind === 'week'
      ? DOWS.reduce((n, d) => n + otherCounts[d], 0)
      : (payload.target.parity === parity ? dayCounts : otherCounts)[payload.target.dayOfWeek]
    if (wipes > 0) setPendingCopy({ ...payload, wipes })
    else runCopy(payload)
  }

  const runCopy = (payload) => {
    setPendingCopy(null)
    if (payload.kind === 'week') {
      const days = Object.fromEntries(DOWS.map((d) => [
        d,
        copyLines(withoutOrphans(program.days[d] || [], exerciseById, catalogueReady), newInstanceId),
      ]))
      saveProgramWeek(currentUid, payload.target.parity, days, currentUid)
        .then(() => toast.success(`Semaine copiée vers la semaine ${PARITY_LABEL[payload.target.parity]}`))
        .catch(() => toast.error('Copie impossible'))
      return
    }
    const { parity: toParity, dayOfWeek: toDay } = payload.target
    saveProgramDay(currentUid, toParity, toDay, copyLines(lines, newInstanceId), currentUid)
      .then(() => toast.success(
        toParity === parity
          ? `Copié vers ${dayLabel(toDay).toLowerCase()}`
          : `Copié vers la semaine ${PARITY_LABEL[toParity]}`,
      ))
      .catch(() => toast.error('Copie impossible'))
  }

  const dayName = program.names[dayOfWeek] || ''

  return (
    <div className="max-w-xl lg:max-w-5xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <PageHeader
        eyebrow="Réglages"
        title="Programme"
        subtitle="Ton programme à toi. Les séances déjà enregistrées ne bougent pas."
      />

      <SegmentedTabs items={SETTINGS_SUBS} active="programme" onChange={onNavigate} className="mb-5" />

      <div className="lg:grid lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-8 lg:items-start">
        <div className="lg:sticky lg:top-8">
          {settingsReady && (
            <AlternateToggle checked={alternateWeeks} onChange={toggleAlternate} />
          )}

          {prefsReady && (
            <LightWeekCard
              start={lightWeekStart}
              today={today}
              onStart={() => saveLightWeekStart(currentUid, today, currentUid)
                .then(() => toast.success('Semaine allégée lancée pour 7 jours'))
                .catch(() => toast.error('Enregistrement impossible'))}
              onStop={() => saveLightWeekStart(currentUid, null, currentUid)
                .catch(() => toast.error('Enregistrement impossible'))}
            />
          )}

          {alternateWeeks && (
            <SegmentedTabs
              items={PARITY_TABS}
              active={parity}
              onChange={setParity}
              desktopHidden={false}
              className="mb-3"
            />
          )}

          <DayPicker
            value={dayOfWeek}
            onChange={setDayOfWeek}
            counts={dayCounts}
            names={program.names}
            className="mb-3"
          />

          <DayNameField
            key={`${parity}-${dayOfWeek}`}
            value={dayName}
            onSave={renameDay}
          />

          <Button
            variant="secondary"
            className="w-full text-sm mb-5"
            onClick={() => setCopying(true)}
            disabled={alternateWeeks ? lines.length === 0 && weekCount === 0 : lines.length === 0}
          >
            <Copy size={15} /> {alternateWeeks ? 'Copier ce jour ou la semaine' : 'Copier ce jour'}
          </Button>
        </div>

        <div className="min-w-0">
          {isLoading && lines.length === 0 ? (
            <SkeletonList count={3} itemClassName="h-[76px]" />
          ) : (
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={line.instanceId} className="rounded-xl border border-border bg-surface px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-[15px] font-medium text-fg truncate">
                      {resolveLineName(line, exerciseById)}
                    </span>
                    <Button
                      variant="ghost" size="iconSm" aria-label="Monter"
                      onClick={() => move(i, -1)} disabled={i === 0}
                    >
                      <ChevronUp size={16} />
                    </Button>
                    <Button
                      variant="ghost" size="iconSm" aria-label="Descendre"
                      onClick={() => move(i, 1)} disabled={i === lines.length - 1}
                    >
                      <ChevronDown size={16} />
                    </Button>
                    <Button variant="ghost" size="iconSm" aria-label="Dupliquer" onClick={() => duplicateLine(i)}>
                      <Copy size={15} />
                    </Button>
                    <Button variant="danger" size="iconSm" aria-label="Retirer" onClick={() => removeLine(i)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  {/* Séries, puis la fourchette de reps. Sur téléphone la fourchette
                      passe à la ligne : trois steppers ne tiennent pas sur 390 px. */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2.5">
                    <Stepper label="séries" value={line.sets} min={1} max={12} onChange={(v) => updateLine(i, { sets: v })} />
                    <RangeSteppers
                      min={line.repsMin}
                      max={line.repsMax}
                      onChange={({ min, max }) => updateLine(i, { repsMin: min, repsMax: max, reps: max })}
                    />
                  </div>
                </div>
              ))}

              {lines.length > 0 && (
                <p className="text-[11px] text-faint px-1 pt-1">
                  Reps : une fourchette min – max (8–8 pour un nombre fixe). La barre d'XP se remplit vers le max.
                </p>
              )}

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
                  exercises={exercises}
                  isLoading={!catalogueReady}
                  onPick={addLine}
                  onCancel={() => setPicking(false)}
                />
              ) : (
                <Button variant="dashed" size="lg" className="w-full text-sm" onClick={() => setPicking(true)}>
                  <Plus size={16} /> Ajouter un exercice
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <CopyDayMenu
        open={copying}
        onOpenChange={setCopying}
        parity={parity}
        dayOfWeek={dayOfWeek}
        dayCounts={dayCounts}
        otherCounts={otherCounts}
        weekCount={weekCount}
        alternate={alternateWeeks}
        onCopy={askCopy}
      />

      <ConfirmDialog
        open={!!pendingCopy}
        title={pendingCopy?.kind === 'week' ? 'Remplacer toute la semaine ?' : 'Remplacer ce jour ?'}
        message={copyMessage(pendingCopy, parity)}
        confirmLabel="Remplacer"
        onConfirm={() => runCopy(pendingCopy)}
        onClose={() => setPendingCopy(null)}
      />
    </div>
  )
}

function copyMessage(pending, parity) {
  if (!pending) return null
  const n = pending.wipes
  const what = `${n} exercice${n > 1 ? 's' : ''}`
  if (pending.kind === 'week') {
    return `La semaine ${PARITY_LABEL[pending.target.parity]} contient ${what} en tout. Ils seront remplacés par ceux de la semaine ${PARITY_LABEL[parity]}.`
  }
  // Le « y » ne renvoyait à rien : la destination était calculée puis jamais
  // écrite. On confirmait donc un écrasement sans savoir de quel jour — et
  // c'est la seule information qui compte avant de dire oui.
  const where = pending.target.parity === parity
    ? dayLabel(pending.target.dayOfWeek).toLowerCase()
    : `${dayLabel(pending.target.dayOfWeek).toLowerCase()} de la semaine ${PARITY_LABEL[pending.target.parity]}`
  return `${what} ${n > 1 ? 'sont' : 'est'} déjà prévu${n > 1 ? 's' : ''} ${where}. La copie les remplace.`
}

/**
 * Le nom du jour — « Push », « Jambes », « Haut du corps ».
 *
 * Enregistré à la sortie du champ et non à chaque frappe : un nom se tape d'une
 * traite, et écrire à chaque lettre produirait une dizaine d'écritures pour un
 * seul mot. Le brouillon repart de zéro à chaque jour affiché (d'où la clé chez
 * l'appelant) : sans ça, changer de jour laissait le nom précédent dans le
 * champ, prêt à être enregistré sur le mauvais jour.
 */
function DayNameField({ value, onSave }) {
  const [draft, setDraft] = useState(value)

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed === value) return
    onSave(trimmed)
  }

  return (
    <div className="relative mb-3">
      <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
      <Input
        value={draft}
        maxLength={MAX_DAY_NAME}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        placeholder="Nom de la séance — Push, Jambes…"
        aria-label="Nom de la séance de ce jour"
        className="pl-9"
      />
    </div>
  )
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="secondary" size="icon" className="h-11 w-11" aria-label={`Moins de ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={15} />
      </Button>
      <span className="w-12 text-center text-sm font-semibold text-fg tabular">
        {value}
        <span className="block text-[10px] font-normal text-faint leading-none">{label}</span>
      </span>
      <Button variant="secondary" size="icon" className="h-11 w-11" aria-label={`Plus de ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={15} />
      </Button>
    </div>
  )
}

/**
 * La fourchette de reps : deux steppers, sans clavier.
 *
 * Le bas ne dépasse jamais le haut : pousser l'un au-delà de l'autre emmène
 * l'autre avec lui, plutôt que de refuser le geste. Une fourchette fermée
 * (8–8) est un nombre fixe, comme avant les fourchettes.
 */
const MAX_REPS = 50

function RangeSteppers({ min, max, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <Stepper
        label="reps min"
        value={min}
        min={1}
        max={MAX_REPS}
        onChange={(v) => onChange({ min: v, max: Math.max(v, max) })}
      />
      <span className="text-faint text-sm">–</span>
      <Stepper
        label="reps max"
        value={max}
        min={1}
        max={MAX_REPS}
        onChange={(v) => onChange({ min: Math.min(min, v), max: v })}
      />
    </div>
  )
}

/**
 * La semaine allégée : souffler 7 jours sans toucher au programme.
 *
 * Une série de moins par exercice (minimum 2), les mêmes charges, et ces
 * séances ne comptent pas dans la barre d'XP (cf. utils/lightWeek.js). Elle
 * se lance d'ici et s'arrête d'ici ou depuis la séance du jour.
 */
function LightWeekCard({ start, today, onStart, onStop }) {
  const active = isInLightWeek(today, start)
  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-3 rounded-xl border border-border bg-surface">
      <Feather size={16} className="shrink-0 text-accent" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-fg">Semaine allégée</span>
        <span className="block text-xs text-muted mt-0.5">
          {active
            ? `En cours jusqu'au ${formatDayFr(fromLocalDateKey(lightWeekEnd(start)))}.`
            : 'Sept jours à une série de moins, mêmes charges, hors barre d’XP.'}
        </span>
      </span>
      <Button variant={active ? 'outline' : 'secondary'} size="sm" className="shrink-0" onClick={active ? onStop : onStart}>
        {active ? 'Arrêter' : 'Lancer'}
      </Button>
    </div>
  )
}

/**
 * Alterner semaines paires/impaires — propre à CE profil : l'autre compte
 * garde son propre réglage.
 */
function AlternateToggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 px-4 py-3 mb-3 rounded-xl border border-border bg-surface text-left
                 transition active:scale-[0.99] hover:border-border-strong"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-fg">Alterner semaines paires/impaires</span>
        <span className="block text-xs text-muted mt-0.5">
          {checked ? 'Deux programmes, une semaine sur deux.' : 'Le même programme toutes les semaines.'}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-surface-2 border border-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full shadow transition-all duration-200 ease-ios',
            checked ? 'left-6 bg-accent-fg' : 'left-1 bg-muted',
          )}
        />
      </span>
    </button>
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
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un exercice"
            className="pl-9 pr-3"
          />
        </div>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Fermer" onClick={onCancel}>
          <X size={16} />
        </Button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {exercises.length === 0
              ? 'Catalogue vide — ajoute des exercices dans Réglages › Exercices.'
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
