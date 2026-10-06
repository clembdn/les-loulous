import { useMemo } from 'react'
import { ArrowLeft, Plus, Ticket } from 'lucide-react'
import { useMediaQuery } from '@/shared/lib/useMediaQuery.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { useTripData } from '../context/TripDataContext.jsx'
import { useTripUI } from '../context/TripUIContext.jsx'
import ResaList from '../components/resas/ResaList.jsx'
import ResaDetail from '../components/resas/ResaDetail.jsx'
import OfflineBadge from '../components/OfflineBadge.jsx'
import { reservationEntries } from '../utils/reservations.js'
import { formatPrice, totalsByCurrency } from '../utils/format.js'

/**
 * Réservations : hébergements et trajets réservés, dans l'ordre du voyage,
 * et leur fiche. Téléphone : la liste, puis la fiche en page entière (son
 * adresse est dans l'URL, « retour » ramène à la liste). Ordinateur : les deux
 * côte à côte.
 */
export default function ResasView({ selectedKey }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const ui = useTripUI()
  const { trip, stays, transports, attachmentsByParent, colorIndexByStay, isLoading } = useTripData()
  const entries = useMemo(() => reservationEntries(stays, transports), [stays, transports])
  const totals = useMemo(() => totalsByCurrency([...stays, ...transports]), [stays, transports])

  const selected = entries.find((e) => e.key === selectedKey) || null
  const shown = selected || (isDesktop ? entries[0] : null)
  const defaults = { date: trip.startDate }

  const detail = shown && (
    <ResaDetail
      kind={shown.kind}
      item={shown.item}
      attachments={attachmentsByParent[shown.item.id] || []}
      colorIndex={colorIndexByStay[shown.item.id]}
      onEdit={() => (shown.kind === 'stay' ? ui.editStay(shown.item) : ui.editTransport(shown.item))}
      onViewAttachment={ui.viewAttachments}
    />
  )

  // Téléphone, fiche ouverte : elle prend tout l'écran.
  if (!isDesktop && selected) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-4 pb-28">
        <button type="button" onClick={ui.closeResa} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft size={16} /> Réservations
        </button>
        {detail}
      </div>
    )
  }

  const actions = (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={() => ui.editStay(null, defaults)}>
        <Plus size={15} /> Hébergement
      </Button>
      <Button variant="secondary" size="sm" onClick={() => ui.editTransport(null, defaults)}>
        <Plus size={15} /> Trajet
      </Button>
    </div>
  )

  return (
    <div className="max-w-xl lg:max-w-6xl mx-auto px-4 lg:px-8 pt-5 lg:pt-7 pb-28 lg:pb-12">
      <header className="mb-5 lg:flex lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-faint truncate">{trip.title}</p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1">Réservations</h1>
          {totals.length > 0 && (
            <p className="text-sm text-muted mt-0.5 tabular">
              Total {totals.map((t) => formatPrice(t.total, t.currency)).join(' · ')}
            </p>
          )}
          {/* Les captures sont ce qu'on montre à l'accueil sans réseau. */}
          <OfflineBadge tripId={trip.id} className="mt-1" />
        </div>
        <div className="mt-3 lg:mt-0">{actions}</div>
      </header>

      {isLoading && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>}

      {!isLoading && entries.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
          <span className="mx-auto h-12 w-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
            <Ticket size={22} />
          </span>
          <p className="mt-4 text-base font-semibold text-fg">Aucune réservation</p>
          <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
            Hôtels, Airbnb, trains, vols, location de voiture : avec la capture du mail, tout reste lisible sans réseau.
          </p>
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-6 lg:items-start">
          <div className="rounded-2xl border border-border bg-surface p-1.5">
            <ResaList
              entries={entries}
              selectedKey={isDesktop ? shown?.key : null}
              attachmentsByParent={attachmentsByParent}
              colorIndexByStay={colorIndexByStay}
              onSelect={(kind, id) => ui.openResa(kind, id, { replace: isDesktop && !!selectedKey })}
            />
          </div>
          {isDesktop && <div className="sticky top-6">{detail}</div>}
        </div>
      )}
    </div>
  )
}
