import { useState } from 'react'
import { CalendarClock, ChevronDown } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { DAY_LABELS } from '@/shared/lib/dates.js'
import DayPicker from './DayPicker.jsx'

const PARITY_LABEL = { even: 'Semaine paire', odd: 'Semaine impaire' }
const PARITY_TABS = [
  { id: 'odd', label: 'Semaine impaire', short: 'Impaire' },
  { id: 'even', label: 'Semaine paire', short: 'Paire' },
]

// Contrôle discret : forcer la parité de semaine ET le jour de séance affiché.
// Un seul contrôle pour les deux cas (vacances qui décalent le cycle, séance du
// mardi faite le mercredi).
//
// Il ne change QUE la prescription affichée : rien n'est écrit dans la séance,
// donc rien ne s'y accumule et aucune saisie n'est perdue.
export default function SessionPlanControl({ parity, dayOfWeek, naturalDayOfWeek, dayCounts, isForced, onChange, onReset }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-full text-xs font-medium border',
          'transition-colors duration-200',
          isForced
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-border bg-surface text-muted hover:text-fg hover:border-border-strong',
        )}
      >
        <CalendarClock size={14} />
        {PARITY_LABEL[parity]} · {DAY_LABELS[dayOfWeek % 7]}
        <ChevronDown
          size={14}
          className={cn('transition-transform duration-300 ease-ios', open && 'rotate-180')}
        />
      </button>

      {/* Hauteur animée via grid-template-rows : la seule façon d'ouvrir un
          panneau de hauteur inconnue sans à-coup ni mesure en JavaScript. */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-ios',
          open ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0',
        )}
      >
        <div className="overflow-hidden" {...(open ? {} : { inert: '' })}>
          <div className="p-3 rounded-2xl border border-border bg-surface">
            <SegmentedTabs
              items={PARITY_TABS}
              active={parity}
              onChange={(p) => onChange({ parity: p, dayOfWeek })}
              desktopHidden={false}
              className="mb-3"
            />

            <DayPicker
              value={dayOfWeek}
              onChange={(d) => onChange({ parity, dayOfWeek: d })}
              counts={dayCounts}
              today={naturalDayOfWeek}
            />

            {isForced && (
              <button
                onClick={onReset}
                className="mt-3 text-xs text-muted hover:text-fg transition-colors"
              >
                Revenir au jour réel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
