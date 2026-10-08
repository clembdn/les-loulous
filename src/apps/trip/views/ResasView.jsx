import { useMemo } from 'react'
import { ChevronLeft, Plus, Ticket } from 'lucide-react'
import { useMediaQuery } from '@/shared/lib/useMediaQuery.js'
import { useToday } from '@/shared/lib/useToday.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { useTripData } from '../context/TripDataContext.jsx'
import { useTripUI } from '../context/TripUIContext.jsx'
import ResaList from '../components/resas/ResaList.jsx'
import ResaDetail from '../components/resas/ResaDetail.jsx'
import OfflineBadge from '../components/OfflineBadge.jsx'
import { reservationEntries } from '../utils/reservations.js'
import { formatPrice, totalsByCurrency } from '../utils/format.js'
import { defaultDay } from '../utils/tripDates.js'

/**
 * Réservations : hébergements et trajets réservés, dans l'ordre du voyage,
 * et leur fiche. Téléphone : la liste, puis la fiche en page entière (son
 * adresse est dans l'URL, « retour » ramène à la liste). Ordinateur : les deux
 * côte à côte.
 */
export default function ResasView({ selectedKey }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const ui = useTripUI()
  const today = useToday()
  const { trip, stays, transports, attachmentsByParent, colorIndexByStay, isLoading } = useTripData()
  const entries = useMemo(() => reservationEntries(stays, transports), [stays, transports])
  const totals = useMemo(() => totalsByCurrency([...stays, ...transports]), [stays, transports])

  const selected = entries.find((e) => e.key === selectedKey) || null
  const shown = selected || (isDesktop ? entries[0] : null)

  const detail = shown && (
    <ResaDetail
      kind={shown.kind}
      item={shown.item}
      attachments={attachmentsByParent[shown.item.id] || []}
      colorIndex={colorIndexByStay[shown.item.id]}
      onEdit={ui.readOnly ? null : () => (shown.kind === 'stay' ? ui.editStay(shown.item) : ui.editTransport(shown.item))}
      onViewAttachment={ui.viewAttachments}
      onReverse={ui.readOnly ? null : () => ui.editTransport(null, { reverseOf: shown.item })}
    />
  )

  // Téléphone, fiche ouverte : elle prend tout l'écran.
  if (!isDesktop && selected) {
    return (
      <div className="max-w-xl mx-auto px-3 pt-2 pb-28">
        <button type="button" onClick={ui.closeResa} className="mb-2 h-11 -ml-1 inline-flex items-center gap-0.5 text-[15px] text-accent">
          <ChevronLeft size={22} strokeWidth={2.2} /> Réservations
        </button>
        {detail}
      </div>
    )
  }

  // La journée à laquelle rattacher une nouvelle réservation : aujourd'hui
  // pendant le voyage, sinon le premier jour.
  const addDate = defaultDay(trip, today)
  const add = ui.newItem && (
    <Button size="sm" onClick={() => ui.newItem(addDate)} className="hidden lg:inline-flex">
      <Plus size={15} /> Ajouter
    </Button>
  )

  return (
    <div className="max-w-xl lg:max-w-6xl mx-auto px-3 lg:px-8 pt-4 lg:pt-7 pb-28 lg:pb-12">
      <header className="mb-1 px-1 lg:px-0 lg:flex lg:items-end lg:justify-between gap-4">
        <div>
          <p className="hidden lg:block text-[13px] font-semibold text-muted truncate">{trip.title}</p>
          <h1 className="text-[30px] leading-9 lg:text-[28px] font-bold lg:font-semibold tracking-[-0.02em] text-fg lg:mt-0.5">Réservations</h1>
          {totals.length > 0 && (
            <p className="text-[15px] text-muted mt-0.5 tabular">
              Total {totals.map((t) => formatPrice(t.total, t.currency)).join(' · ')}
            </p>
          )}
          {/* Les captures sont ce qu'on montre à l'accueil sans réseau. */}
          <OfflineBadge tripId={trip.id} className="mt-1" />
        </div>
        {add}
      </header>

      {isLoading && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>}

      {!isLoading && entries.length === 0 && (
        <div className="rounded-3xl bg-surface shadow-sm px-6 py-12 text-center">
          <span className="mx-auto h-12 w-12 rounded-2xl bg-accent text-accent-fg flex items-center justify-center">
            <Ticket size={22} />
          </span>
          <p className="mt-4 text-base font-semibold text-fg">Aucune réservation</p>
          {ui.newItem && (
            <>
              <p className="mt-1 text-[15px] text-muted max-w-sm mx-auto">
                Hôtels, Airbnb, trains, vols, location de voiture : avec la capture du mail, tout reste lisible sans réseau.
              </p>
              <Button className="mt-5" onClick={() => ui.newItem(addDate)}>
                <Plus size={16} /> Ajouter une réservation
              </Button>
            </>
          )}
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-6 lg:items-start">
          <div>
            <ResaList
              entries={entries}
              selectedKey={isDesktop ? shown?.key : null}
              attachmentsByParent={attachmentsByParent}
              colorIndexByStay={colorIndexByStay}
              onSelect={(kind, id) => ui.openResa(kind, id, { replace: isDesktop && !!selectedKey })}
            />
          </div>
          {isDesktop && <div className="sticky top-6 pt-4">{detail}</div>}
        </div>
      )}
    </div>
  )
}
