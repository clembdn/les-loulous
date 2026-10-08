import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Globe2, Mountain, MapPin, Plus, X } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useToday } from '@/shared/lib/useToday.js'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { useWorldVisits } from '../hooks/useWorldVisits.js'
import { removeVisited } from '../services/worldService.js'
import WorldGlobe from '../components/world/WorldGlobe.jsx'
import AddVisitedSheet from '../components/world/AddVisitedSheet.jsx'
import { tripPath } from '../config/navigation.js'
import { tripStatus } from '../utils/tripDates.js'
import { formatTripRange, plural } from '../utils/format.js'

const KIND = {
  country: { icon: Globe2, label: 'Tout le pays' },
  island: { icon: Mountain, label: 'Île' },
  place: { icon: MapPin, label: 'Ville ou lieu' },
}

/**
 * /trip/monde — la carte du monde : le globe à gauche (en haut sur
 * téléphone), et le panneau des pays. Toucher un pays (sur le globe ou dans
 * la liste) y vole et montre ses villes, ses voyages, ce qui a été ajouté à
 * la main. « Ajouter un pays ou un lieu » : ce qu'on a visité sans l'app.
 */
export default function WorldView() {
  const data = useWorldVisits()
  const [selected, setSelected] = useState(null)
  const [adding, setAdding] = useState(false)
  const country = data.countries.find((c) => c.id === selected) || null

  return (
    <div className="lg:flex lg:h-screen">
      <WorldGlobe
        world={data.world}
        visits={data.visits}
        selected={selected}
        onSelect={setSelected}
        className="h-[48vh] min-h-[300px] lg:h-full lg:min-h-0 lg:flex-1"
      />
      <aside className="relative z-[2] -mt-5 lg:mt-0 rounded-t-[22px] lg:rounded-none bg-bg lg:bg-surface lg:w-[25rem] lg:shrink-0 lg:h-full lg:overflow-y-auto lg:border-l lg:border-border">
        <div className="max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-8 lg:px-6 lg:pt-7">
          {data.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : country ? (
            <CountryDetail
              country={country}
              rawEntries={data.rawEntries}
              meta={data.meta}
              onBack={() => setSelected(null)}
            />
          ) : (
            <Overview countries={data.countries} onPick={setSelected} onAdd={() => setAdding(true)} />
          )}
        </div>
      </aside>
      <AddVisitedSheet
        open={adding}
        onClose={() => setAdding(false)}
        meta={data.meta}
        onAdded={(area) => setSelected(area.country)}
      />
    </div>
  )
}

function Overview({ countries, onPick, onAdd }) {
  const visited = countries.filter((c) => c.visited)
  const planned = countries.filter((c) => !c.visited)
  const cities = new Set(visited.flatMap((c) => c.cities)).size

  return (
    <>
      <h1 className="hidden lg:block text-[28px] leading-[34px] font-semibold tracking-[-0.02em] text-fg">Carte du monde</h1>
      <dl className="lg:mt-4 grid grid-cols-3 gap-2">
        <Stat value={visited.length} label={visited.length > 1 ? 'pays visités' : 'pays visité'} strong />
        <Stat value={cities} label={cities > 1 ? 'villes' : 'ville'} />
        <Stat value={planned.length} label="à venir" />
      </dl>
      <Button variant="secondary" className="mt-3 w-full" onClick={onAdd}>
        <Plus size={16} /> Ajouter un pays ou un lieu
      </Button>

      {countries.length === 0 && (
        <p className="mt-6 text-[15px] text-muted">
          Les pays de vos voyages s’allument dès leurs premières étapes. Ceux d’avant l’app, ajoutez-les à la main.
        </p>
      )}
      <CountryList title="Visités" countries={visited} onPick={onPick} />
      <CountryList title="À venir" countries={planned} onPick={onPick} />
    </>
  )
}

function Stat({ value, label, strong = false }) {
  return (
    <div className={cn('rounded-2xl px-3 py-2.5', strong ? 'bg-accent text-accent-fg' : 'bg-surface lg:bg-surface-2')}>
      <dd className="text-[26px] leading-8 font-semibold tracking-[-0.02em] tabular">{value}</dd>
      <dt className={cn('text-[12px] leading-4', strong ? 'text-accent-fg/85' : 'text-muted')}>{label}</dt>
    </div>
  )
}

function CountryList({ title, countries, onPick }) {
  if (!countries.length) return null
  return (
    <section className="mt-6">
      <h2 className="px-1 mb-1.5 text-[15px] font-semibold text-fg">{title}</h2>
      <ul className="rounded-2xl bg-surface lg:bg-transparent shadow-sm lg:shadow-none divide-y divide-border overflow-hidden lg:-mx-2">
        {countries.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className="w-full flex items-center gap-3 px-4 lg:px-2 py-3 text-left hover:bg-surface-2 transition lg:rounded-xl"
            >
              <span
                aria-hidden="true"
                className={cn('h-3 w-3 shrink-0 rounded-full', c.visited ? 'bg-accent' : 'bg-accent/35')}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium text-fg truncate">{c.name}</span>
                <span className="block text-[13px] text-muted truncate">
                  {[c.cities.slice(0, 4).join(' · '), c.trips.length > 0 && plural(c.trips.length, 'voyage')].filter(Boolean).join(' — ') || 'Ajouté à la main'}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function CountryDetail({ country, rawEntries, meta, onBack }) {
  const { currentUid } = useAuth()
  const today = useToday()

  function remove(item) {
    const raw = rawEntries.find((x) => x.entry.id === item.id)?.raw
    if (!raw) return
    removeVisited(raw, meta, currentUid).catch(() => toast.error('Suppression impossible'))
    toast.success(`${item.name} retiré de la carte`)
  }

  return (
    <>
      <button type="button" onClick={onBack} className="-ml-1.5 h-10 inline-flex items-center gap-0.5 text-[15px] text-accent">
        <ChevronLeft size={20} strokeWidth={2.2} /> Tous les pays
      </button>
      <div className="mt-1 flex items-center gap-2.5">
        <h1 className="flex-1 min-w-0 text-[28px] leading-[34px] font-semibold tracking-[-0.02em] text-fg truncate">{country.name}</h1>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold', country.visited ? 'bg-accent text-accent-fg' : 'bg-accent/15 text-accent')}>
          {country.visited ? 'Visité' : 'À venir'}
        </span>
      </div>

      {country.cities.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[13px] font-semibold text-muted">Villes et lieux</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {country.cities.map((name) => (
              <span key={name} className="h-8 px-3 rounded-full bg-surface lg:bg-surface-2 inline-flex items-center text-[14px] text-fg">{name}</span>
            ))}
          </div>
        </section>
      )}

      {country.trips.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[13px] font-semibold text-muted">Voyages</h2>
          <ul className="mt-1.5 rounded-2xl bg-surface lg:bg-transparent shadow-sm lg:shadow-none overflow-hidden lg:-mx-2 divide-y divide-border">
            {country.trips.map(({ trip }) => (
              <li key={trip.id}>
                <Link
                  to={tripPath(trip.id, tripStatus(trip, today) === 'ongoing' ? 'aujourdhui' : 'jours')}
                  className="flex items-center gap-3 px-4 lg:px-2 py-3 hover:bg-surface-2 transition lg:rounded-xl"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium text-fg truncate">{trip.title}</span>
                    <span className="block text-[13px] text-muted tabular">{formatTripRange(trip.startDate, trip.endDate)}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {country.manual.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[13px] font-semibold text-muted">Ajouté à la main</h2>
          <ul className="mt-1.5 rounded-2xl bg-surface lg:bg-transparent shadow-sm lg:shadow-none overflow-hidden lg:-mx-2 divide-y divide-border">
            {country.manual.map((item) => {
              const kind = KIND[item.kind] || KIND.place
              const Icon = kind.icon
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 lg:px-2 py-2.5">
                  <span className="h-9 w-9 shrink-0 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><Icon size={16} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium text-fg truncate">{item.name}</span>
                    <span className="block text-[13px] text-muted">{kind.label}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    aria-label={`Retirer ${item.name}`}
                    title="Retirer de la carte"
                    className="h-9 w-9 rounded-full flex items-center justify-center text-muted hover:text-danger hover:bg-surface-2 transition"
                  >
                    <X size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
