import { useMemo } from 'react'
import { Plane, Plus } from 'lucide-react'
import { useToday } from '@/shared/lib/useToday.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { useTrips } from '../context/TripsContext.jsx'
import TripCard from '../components/trips/TripCard.jsx'
import { groupTrips } from '../utils/tripDates.js'

// « Mes voyages » : en cours, à venir, passés. Un voyage passé s'archive
// tout seul — son statut se déduit des dates, rien n'est jamais écrit pour ça.
export default function TripsView({ onCreate, onEdit }) {
  const { trips, isLoading } = useTrips()
  const today = useToday()
  const groups = useMemo(() => groupTrips(trips, today), [trips, today])

  return (
    <div className="max-w-xl lg:max-w-5xl mx-auto px-4 pt-5 pb-12 lg:pt-8 lg:px-6">
      <header className="mb-6 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">Mes voyages</h1>
          <p className="text-sm text-muted mt-1">Préparés sur ordinateur, suivis sur téléphone, même sans réseau.</p>
        </div>
        {/* Sur desktop, l'action vit dans la sidebar. */}
        <Button size="sm" className="lg:hidden shrink-0 mt-1" onClick={onCreate}>
          <Plus size={15} strokeWidth={2.6} /> Nouveau
        </Button>
      </header>

      {isLoading && (
        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[108px]" />)}
        </div>
      )}

      {!isLoading && trips.length === 0 && <EmptyState onCreate={onCreate} />}

      {!isLoading && trips.length > 0 && (
        <div className="space-y-8">
          <Group label="En cours" trips={groups.ongoing} today={today} onEdit={onEdit} />
          <Group label="À venir" trips={groups.upcoming} today={today} onEdit={onEdit} />
          <Group label="Passés" trips={groups.past} today={today} onEdit={onEdit} />
        </div>
      )}
    </div>
  )
}

function Group({ label, trips, today, onEdit }) {
  if (!trips.length) return null
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.18em] font-medium text-faint mb-3">{label}</h2>
      <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3">
        {trips.map((trip) => <TripCard key={trip.id} trip={trip} today={today} onEdit={onEdit} />)}
      </div>
    </section>
  )
}

function EmptyState({ onCreate }) {
  return (
    <div className="rounded-3xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      <span className="mx-auto h-12 w-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
        <Plane size={22} />
      </span>
      <p className="mt-4 text-base font-semibold text-fg">Aucun voyage pour l’instant</p>
      <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
        Créez-en un, puis ajoutez hébergements, trajets et étapes, jour par jour.
      </p>
      <Button className="mt-5" onClick={onCreate}>
        <Plus size={16} strokeWidth={2.6} /> Nouveau voyage
      </Button>
    </div>
  )
}
