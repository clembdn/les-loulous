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

// Contrôle discret : forcer la parité de semaine ET le jour de séance affiché,
// pour la date en cours de consultation SEULEMENT — jamais pour naviguer entre
// des dates, c'est le rôle des flèches en haut de l'écran. Un seul contrôle
// pour les deux cas de force (vacances qui décalent le cycle, séance du mardi
// faite le mercredi).
//
// Il ne change QUE la prescription affichée : rien n'est écrit dans la séance,
// donc rien ne s'y accumule et aucune saisie n'est perdue.
//
// Le libellé replié ne nomme JAMAIS un jour tant que rien n'est forcé — un
// « Samedi » à côté du titre qui dit déjà « samedi 22 août » se lisait comme
// une seconde date, en désaccord avec la première dès qu'on cliquait vite.
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
        {isForced ? `Forcé : ${PARITY_LABEL[parity]} · ${DAY_LABELS[dayOfWeek % 7]}` : 'Forcer un autre programme'}
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
            <p className="text-[11px] text-faint mb-3 leading-relaxed">
              Pour cette date : suivre un autre programme que celui du jour réel.
              Pour saisir un autre jour, utilise les flèches en haut de l'écran.
            </p>
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
