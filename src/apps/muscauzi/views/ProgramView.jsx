import { useState, useMemo } from 'react'
import { Plus, Minus, Trash2, ChevronUp, ChevronDown, X, Search, CalendarRange, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { weekParity, isoDayOfWeek } from '@/shared/lib/dates.js'
import { useExercises, useProgram } from '../hooks/useMuscData.js'
import { saveProgramDay, resolveLineName, withoutOrphans, DOWS } from '../services/programService.js'
import { SETTINGS_SUBS } from '../config/navigation.js'
import DayPicker from '../components/session/DayPicker.jsx'
import { newInstanceId } from '../utils/ids.js'

const PARITY_LABEL = { odd: 'Semaine impaire', even: 'Semaine paire' }

// Éditeur de programme : parité × jour de la semaine, indépendant par profil.
// Toute modification ici est sans effet sur les séances déjà enregistrées —
// chacune porte sa propre copie de la prescription.
export default function ProgramView({ onNavigate }) {
  const { currentUid } = useAuth()
  const [parity, setParity] = useState(() => weekParity(new Date()))
  const [dayOfWeek, setDayOfWeek] = useState(() => isoDayOfWeek(new Date()))
  const [picking, setPicking] = useState(false)

  const { exercises, exerciseById, isLoading: exercisesLoading } = useExercises()
  const { days, isLoading } = useProgram(parity)

  // Le catalogue fait foi : une ligne qui ne pointe sur aucun exercice n'est
  // pas affichée, et la première modification du jour la fait disparaître du
  // document.
  const ready = !exercisesLoading
  const lines = useMemo(
    () => withoutOrphans(days[dayOfWeek] || [], exerciseById, ready),
    [days, dayOfWeek, exerciseById, ready],
  )
  const dayCounts = useMemo(
    () => Object.fromEntries(
      DOWS.map((d) => [d, withoutOrphans(days[d] || [], exerciseById, ready).length]),
    ),
    [days, exerciseById, ready],
  )

  // Firestore renvoie l'écriture depuis son cache local : pas d'état de
  // brouillon à maintenir, on repart toujours de `lines`.
  const commit = (next) => {
    saveProgramDay(currentUid, parity, dayOfWeek, next, currentUid)
      .catch(() => toast.error('Enregistrement impossible'))
  }

  // Un ajout crée TOUJOURS une occurrence neuve — y compris pour un mouvement
  // déjà présent. Sans ça, supprimer puis rajouter un exercice ferait hériter
  // la nouvelle occurrence du pré-remplissage de l'ancienne.
  const addLine = (exerciseId) => {
    // Valeurs de départ : 4 × 8, le plus courant — ça s'ajuste juste après.
    commit([...lines, {
      instanceId: newInstanceId(),
      exerciseId,
      name: exerciseById[exerciseId]?.name || '',
      sets: 4, reps: 8, order: lines.length,
    }])
    setPicking(false)
  }

  // Dupliquer = une nouvelle occurrence, insérée juste après l'originale.
  const duplicateLine = (index) => {
    const next = [...lines]
    next.splice(index + 1, 0, { ...lines[index], instanceId: newInstanceId() })
    commit(next)
  }

  // Modifier séries/reps ou déplacer une occurrence CONSERVE son instanceId :
  // l'historique et le pré-remplissage doivent suivre d'une semaine à l'autre.
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

  // Le catalogue reste entièrement proposé : un même mouvement peut légitimement
  // figurer deux fois dans la même séance.
  const available = exercises

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-faint">Réglages</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1">Programme</h1>
        <p className="text-sm text-muted mt-1">
          Ton programme à toi. Les séances déjà enregistrées ne bougent pas.
        </p>
      </header>

      <SegmentedTabs items={SETTINGS_SUBS} active="programme" onChange={onNavigate} className="mb-5" />

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

      <DayPicker
        value={dayOfWeek}
        onChange={setDayOfWeek}
        counts={dayCounts}
        className="mb-5"
      />

      {isLoading && lines.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] rounded-xl border border-border bg-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {lines.map((line, i) => {
            return (
              <div key={line.instanceId} className="px-4 py-3 rounded-xl border border-border bg-surface">
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-[15px] font-medium text-fg truncate">
                    {resolveLineName(line, exerciseById)}
                  </span>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Monter"
                  >
                    <ChevronUp size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => move(i, 1)}
                    disabled={i === lines.length - 1}
                    aria-label="Descendre"
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
            <Button variant="dashed" size="lg" className="w-full text-sm" onClick={() => setPicking(true)}>
              <Plus size={16} /> Ajouter un exercice
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="secondary" size="icon" aria-label={`Moins de ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={15} />
      </Button>
      <span className="w-12 text-center text-sm font-semibold text-fg tabular">
        {value}
        <span className="block text-[10px] font-normal text-faint leading-none">{label}</span>
      </span>
      <Button variant="secondary" size="icon" aria-label={`Plus de ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={15} />
      </Button>
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
