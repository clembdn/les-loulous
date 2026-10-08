import { Bike, Bus, Car, ChevronRight, Footprints, Plane, Route, Ship, TrainFront } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { useMediaQuery } from '@/shared/lib/useMediaQuery.js'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { countryName } from '../../hooks/useWorldVisits.js'
import { dayChip, plural } from '../../utils/format.js'
import { flagOf, formatKm, RECAP_MODES } from '../../utils/recap.js'
import TripMap from '../map/TripMap.jsx'
import { CARD, SectionTitle } from './parts.jsx'

const MODES = {
  walk: { label: 'À pied', icon: Footprints },
  bike: { label: 'À vélo', icon: Bike },
  car: { label: 'En voiture', icon: Car },
  train: { label: 'En train', icon: TrainFront },
  bus: { label: 'En bus', icon: Bus },
  ferry: { label: 'En ferry', icon: Ship },
  flight: { label: 'En avion', icon: Plane },
  other: { label: 'Autres trajets', icon: Route },
}

const MAP_PADDING = { top: 40, bottom: 40, left: 40, right: 40 }
const MAX_CITIES = 6

/**
 * Tout le voyage sur une carte : hébergements, trajets, étapes en points. On
 * peut y zoomer partout (à deux doigts sur téléphone : la page défile au doigt).
 */
export function RecapMap({ route }) {
  const ui = useTripUI()
  const wide = useMediaQuery('(min-width: 1024px)')
  const { colorIndexByStay } = useTripData()
  return (
    <section>
      <SectionTitle>Tout le trajet</SectionTitle>
      <div className={cn(CARD, 'overflow-hidden')}>
        <TripMap
          items={route.items}
          legs={route.legs}
          colorIndexByStay={colorIndexByStay}
          dots
          interactive
          cooperative={!wide}
          controls={wide}
          attribution="bottom-left"
          fallbackCenter={ui.near}
          padding={MAP_PADDING}
          className="h-72 lg:h-[30rem]"
        />
      </div>
    </section>
  )
}

/** Les kilomètres, par façon de se déplacer. */
export function RecapDistances({ distance }) {
  const rows = RECAP_MODES.filter((m) => distance.byMode[m] >= 1)
  return (
    <section className={cn(CARD, 'p-4')}>
      <h3 className="text-[15px] font-semibold text-fg">Parcouru</h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-[14px] text-muted">Aucun trajet entre des lieux localisés.</p>
      ) : (
        <>
          <ul className="mt-2 space-y-2">
            {rows.map((m) => {
              const { label, icon: Icon } = MODES[m]
              return (
                <li key={m} className="flex items-center gap-3">
                  <span className="h-8 w-8 shrink-0 rounded-full bg-accent/10 text-accent flex items-center justify-center"><Icon size={16} /></span>
                  <span className="flex-1 text-[15px] text-fg">{label}</span>
                  <span className="text-[15px] font-semibold text-fg tabular">{formatKm(distance.byMode[m])}</span>
                </li>
              )
            })}
          </ul>
          {distance.estimatedM >= 1 && (
            <p className="mt-3 text-[13px] text-muted">
              Dont {formatKm(distance.estimatedM)} à vol d’oiseau : les trajets réservés (on ne trace pas la route
              d’un train ou d’un avion) et ceux qui n’ont pas été calculés.
            </p>
          )}
        </>
      )}
    </section>
  )
}

/** Les pays traversés, avec leurs villes. */
export function RecapCountries({ countries }) {
  return (
    <section className={cn(CARD, 'p-4')}>
      <h3 className="text-[15px] font-semibold text-fg">
        {countries?.length > 1 ? `${countries.length} pays` : 'Pays'}
      </h3>
      {!countries ? (
        <div className="mt-2 space-y-2"><Skeleton className="h-10" /></div>
      ) : countries.length === 0 ? (
        <p className="mt-1 text-[14px] text-muted">Aucun lieu localisé.</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {countries.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <span className="text-[22px] leading-7" aria-hidden="true">{flagOf(c.id)}</span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium text-fg">{countryName(c.id)}</span>
                {c.cities.length > 0 && (
                  <span className="block text-[13px] text-muted">
                    {c.cities.slice(0, MAX_CITIES).join(', ')}
                    {c.cities.length > MAX_CITIES ? ` et ${c.cities.length - MAX_CITIES} autres` : ''}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Les journées, avec leurs étapes et leurs kilomètres ; un tap rouvre la journée. */
export function RecapDays({ perDay }) {
  const ui = useTripUI()
  return (
    <section>
      <SectionTitle>Jour par jour</SectionTitle>
      <ol className={cn(CARD, 'p-1.5')}>
        {perDay.map((d, i) => {
          const chip = dayChip(d.date)
          const details = [d.stops ? plural(d.stops, 'étape') : 'Rien de prévu', d.distanceM >= 50 && formatKm(d.distanceM)].filter(Boolean).join(' · ')
          return (
            <li key={d.date}>
              <button type="button" onClick={() => ui.openDay(d.date)} className="w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-surface-2 transition">
                <span className="w-9 shrink-0 text-center">
                  <span className="block text-[11px] text-muted">{chip.dow}</span>
                  <span className="block text-[17px] font-semibold leading-tight text-fg tabular">{chip.day}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[15px] truncate', d.title ? 'font-medium text-fg' : 'text-muted')}>{d.title || `Jour ${i + 1}`}</span>
                  <span className="block text-[13px] text-muted tabular">{details}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted" />
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
