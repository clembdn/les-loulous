import { useMemo } from 'react'
import { cn } from '@/shared/lib/utils.js'
import { useToday } from '@/shared/lib/useToday.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useIdeas, useIdeaActions } from '../../hooks/useIdeas.js'
import { MAX_STOPS_PER_DAY } from '../../services/daysService.js'
import { dayChip, plural } from '../../utils/format.js'
import { formatDistance } from '../../utils/geo.js'
import { rankDays } from '../../utils/ideas.js'

/**
 * Dans quel jour placer un lieu à caser : tous les jours du voyage, dans
 * l'ordre, avec leur distance au lieu quand ils sont près ; le jour suggéré
 * (le plus proche, le moins chargé) est marqué. Un tap place le lieu en fin
 * de journée, ou à son heure s'il en a une.
 */
export default function PlaceIdeaSheet({ open, idea, onClose }) {
  const today = useToday()
  const { dayKeys, days, stopsByDate } = useTripData()
  const { pointsByDate } = useIdeas()
  const actions = useIdeaActions()

  const ranked = useMemo(() => {
    if (!idea) return { byDate: {}, best: null }
    const stopCounts = Object.fromEntries(Object.entries(stopsByDate).map(([d, s]) => [d, s.length]))
    const list = rankDays(idea, pointsByDate, { stopCounts })
    return { byDate: Object.fromEntries(list.map((d) => [d.date, d.distanceM])), best: list[0]?.date || null }
  }, [idea, pointsByDate, stopsByDate])

  function pick(date) {
    if (actions.place(idea, date)) onClose()
  }

  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title={idea ? `Placer « ${idea.name} »` : 'Placer'}
      description="Dans quel jour ? Il ira en fin de journée."
    >
      <ol className="-mx-2 space-y-0.5">
        {dayKeys.map((date) => {
          const chip = dayChip(date)
          const count = stopsByDate[date]?.length || 0
          const distance = ranked.byDate[date]
          const best = date === ranked.best
          const full = count >= MAX_STOPS_PER_DAY
          return (
            <li key={date}>
              <button
                type="button"
                onClick={() => pick(date)}
                disabled={full}
                className={cn(
                  'w-full min-h-14 flex items-center gap-3 rounded-xl px-2 py-2 text-left transition disabled:opacity-50',
                  best ? 'bg-accent/10 hover:bg-accent/15' : 'hover:bg-surface-2',
                )}
              >
                <span className="w-10 shrink-0 text-center">
                  <span className={cn('block text-[11px]', best ? 'text-accent' : 'text-muted')}>{chip.dow}</span>
                  <span className={cn('block text-[18px] font-semibold leading-tight tabular', best ? 'text-accent' : 'text-fg')}>{chip.day}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[15px] truncate', days[date]?.title ? 'font-medium text-fg' : 'text-muted')}>
                    {days[date]?.title || `${chip.day} ${chip.month}`}
                    {date === today && <span className="ml-1.5 text-[12px] font-semibold text-accent">Aujourd’hui</span>}
                  </span>
                  <span className="block text-[13px] text-muted">{full ? 'Journée complète' : count ? plural(count, 'étape') : 'Rien de prévu'}</span>
                </span>
                {distance != null && (
                  <span className="shrink-0 text-right">
                    {best && <span className="block text-[11px] font-semibold uppercase tracking-wide text-accent">Suggéré</span>}
                    <span className="block text-[13px] text-muted tabular">à {formatDistance(distance)}</span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </ThemedSheet>
  )
}
