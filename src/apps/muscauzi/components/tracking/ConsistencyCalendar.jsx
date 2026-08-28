import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  toLocalDateKey, fromLocalDateKey, shiftDateKey, isoDayOfWeek, formatDayFr, MONTHS,
} from '@/shared/lib/dates.js'
import { cn } from '@/shared/lib/utils.js'
import { useMuscData } from '../../context/MuscDataContext.jsx'
import { useSessionRange } from '../../hooks/useMuscData.js'
import { hasCompletedWork, doneSets, sessionLineup } from '../../services/sessionsService.js'

const WINDOW_DAYS = 90
const MONTHS_SHOWN = 3
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Régularité sur les trois derniers mois, un mois à la fois.
//
// Un vrai calendrier plutôt qu'une grille de pastilles : on lit « j'ai sauté
// les deux derniers lundis » d'un coup d'œil, les cases sont assez grandes
// pour le doigt, et la forme est celle que tout le monde connaît déjà.
//
// Un jour n'est marqué QUE si la séance contient au moins une série faite :
// une séance ouverte par curiosité ne compte pas dans la régularité.
function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = isoDayOfWeek(first) - 1 // cases vides avant le 1er
  const cells = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toLocalDateKey(new Date(year, month, d)))
  return cells
}

export default function ConsistencyCalendar() {
  // La date du jour vient du contexte : recalculée à minuit et au retour de
  // l'onglet, elle ne peut plus rester figée sur la veille dans une PWA laissée
  // ouverte — le calendrier surlignerait alors le mauvais jour.
  const { today: todayKey } = useMuscData()
  const startKey = useMemo(() => shiftDateKey(todayKey, -(WINDOW_DAYS - 1)), [todayKey])

  // Une seule requête, bornée par id de document — possible grâce à la
  // convention stricte de clé de date locale.
  const { sessions, isLoading } = useSessionRange(startKey, todayKey)
  const [monthOffset, setMonthOffset] = useState(0) // 0 = mois courant
  const [selected, setSelected] = useState(null)

  const byDate = useMemo(() => Object.fromEntries(sessions.map((s) => [s.date, s])), [sessions])
  const activeCount = useMemo(
    () => Object.values(byDate).filter(hasCompletedWork).length,
    [byDate],
  )

  const cursor = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  }, [monthOffset])
  const cells = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor])

  const selectedSession = selected ? byDate[selected] : null

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-fg">Régularité</h2>
        <span className="text-xs text-muted tabular">
          {isLoading ? '—' : `${activeCount} séance${activeCount > 1 ? 's' : ''} sur 3 mois`}
        </span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <NavButton
          onClick={() => setMonthOffset((o) => o - 1)}
          disabled={monthOffset <= -(MONTHS_SHOWN - 1)}
          label="Mois précédent"
        >
          <ChevronLeft size={16} />
        </NavButton>
        <span className="text-sm font-medium text-fg tabular">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </span>
        <NavButton
          onClick={() => setMonthOffset((o) => o + 1)}
          disabled={monthOffset >= 0}
          label="Mois suivant"
        >
          <ChevronRight size={16} />
        </NavButton>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-center text-[10px] font-medium text-faint">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((key, i) => {
          if (!key) return <span key={`p${i}`} />
          const inWindow = key >= startKey && key <= todayKey
          const done = hasCompletedWork(byDate[key])
          const isToday = key === todayKey
          return (
            <button
              key={key}
              onClick={() => inWindow && setSelected(selected === key ? null : key)}
              disabled={!inWindow}
              aria-label={formatDayFr(fromLocalDateKey(key))}
              aria-pressed={selected === key}
              className={cn(
                'aspect-square rounded-full flex items-center justify-center text-[13px] tabular',
                'transition-all duration-200 ease-ios',
                done
                  ? 'bg-accent text-accent-fg font-semibold'
                  : inWindow
                    ? 'text-muted hover:bg-surface-2'
                    : 'text-faint/40',
                isToday && !done && 'ring-1 ring-inset ring-accent/50 text-fg',
                selected === key && 'ring-2 ring-inset ring-fg/40',
                inWindow && 'active:scale-90',
              )}
            >
              {fromLocalDateKey(key).getDate()}
            </button>
          )
        })}
      </div>

      {/* Hauteur animée : la fiche du jour s'ouvre sans faire sauter la carte. */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-ios',
          selected ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0',
        )}
      >
        <div className="overflow-hidden" {...(selected ? {} : { inert: '' })}>
          <div className="pt-3 border-t border-border">
            <p className="text-sm text-fg first-letter:uppercase">
              {selected && formatDayFr(fromLocalDateKey(selected), { withYear: true })}
            </p>
            {/* Le libellé vient des entrées, qui ont figé leur nom : renommer
                un exercice plus tard ne réécrit pas le calendrier passé. */}
            <p className="text-xs text-muted mt-0.5">{describeSession(selectedSession)}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function NavButton({ onClick, disabled, label, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted transition-colors
                 hover:text-fg hover:bg-surface-2 disabled:opacity-25 disabled:pointer-events-none"
    >
      {children}
    </button>
  )
}

function describeSession(session) {
  if (!session) return 'Pas de séance'
  if (!hasCompletedWork(session)) return 'Séance ouverte, aucune série enregistrée'
  const names = sessionLineup(session)
    .filter((e) => doneSets(e).length > 0)
    .map((e) => e.name)
    .filter(Boolean)
  return names.length > 0 ? names.join(' · ') : 'Séance enregistrée'
}
