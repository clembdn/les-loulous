import { useRef, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { useMediaQuery } from '@/shared/lib/useMediaQuery.js'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { useTripData } from '../context/TripDataContext.jsx'
import { useTripUI } from '../context/TripUIContext.jsx'
import { useIdeas, useIdeaActions } from '../hooks/useIdeas.js'
import { plural } from '../utils/format.js'
import { hasCoords } from '../utils/geo.js'
import TripMap from '../components/map/TripMap.jsx'
import QuickAdd from '../components/days/QuickAdd.jsx'
import IdeaRow from '../components/ideas/IdeaRow.jsx'

const NO_ITEMS = []

/**
 * « À caser » : les lieux repérés, pas encore placés dans un jour — un
 * conseil, une adresse vue sur Instagram, un lieu partagé depuis Google Maps
 * avant de savoir quand y aller.
 *
 * Chaque lieu propose le jour où l'on sera tout près (« + Mar 14 », un tap),
 * ou le choix du jour. Téléphone : la saisie, la carte, la liste. Ordinateur :
 * la liste à gauche, la carte à droite, survoler l'un allume l'autre.
 */
export default function IdeasView() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const ui = useTripUI()
  const { trip, isLoading } = useTripData()
  const { ideas, suggestions } = useIdeas()
  const actions = useIdeaActions()
  const [hoverKey, setHoverKey] = useState(null)
  const listRef = useRef(null)
  const located = ideas.some(hasCoords)

  // Un repère touché sur la carte : sa ligne s'allume et vient sous les yeux.
  function selectOnMap(key) {
    setHoverKey(key)
    listRef.current?.querySelector(`[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const map = (className, interactive) => (
    <TripMap
      items={NO_ITEMS}
      ideas={ideas}
      activeKey={hoverKey}
      onHover={interactive ? setHoverKey : undefined}
      onSelect={interactive ? selectOnMap : undefined}
      fallbackCenter={ui.near}
      interactive={interactive}
      controls={interactive}
      attribution="bottom-left"
      padding={{ top: 50, bottom: 50, left: 50, right: 50 }}
      className={className}
    />
  )

  const header = (
    <header className="px-1 lg:px-0">
      <p className="hidden lg:block text-[13px] font-semibold text-muted truncate">{trip.title}</p>
      <h1 className="text-[30px] leading-9 lg:text-[28px] font-bold lg:font-semibold tracking-[-0.02em] text-fg lg:mt-0.5">À caser</h1>
      <p className="text-[15px] text-muted mt-0.5">
        {ideas.length ? `${plural(ideas.length, 'lieu repéré', 'lieux repérés')}, à placer dans un jour.` : 'Les lieux repérés, à placer dans un jour.'}
      </p>
    </header>
  )

  const add = (
    <QuickAdd
      onAdd={actions.add}
      near={ui.near}
      placeholder="Repérer un lieu, ou coller un lien Google Maps"
    />
  )

  const list = isLoading ? (
    <div className="space-y-2">
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  ) : ideas.length === 0 ? (
    <div className="py-10 px-6 text-center">
      <span className="mx-auto h-12 w-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
        <Bookmark size={22} />
      </span>
      <p className="mt-3 text-[16px] font-semibold text-fg">Rien à caser</p>
      <p className="mt-1 text-[14px] text-muted">
        Tapez un lieu ci-dessus, ou partagez-le depuis Google Maps. On le placera dans le jour où l’on passe tout près.
      </p>
    </div>
  ) : (
    <ul ref={listRef} className="space-y-0.5">
      {ideas.map((idea) => (
        <IdeaRow
          key={idea.id}
          idea={idea}
          suggestion={suggestions[idea.id]}
          onOpen={ui.editIdea}
          onSuggested={(i, date) => actions.place(i, date)}
          onPlace={ui.placeIdea}
          active={hoverKey === `idea:${idea.id}`}
          onHover={isDesktop ? setHoverKey : null}
        />
      ))}
    </ul>
  )

  if (isDesktop) {
    return (
      <div className="max-w-[1500px] mx-auto px-8 pt-7 pb-12 grid gap-8 items-start grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <div className="space-y-4 min-w-0">
          {header}
          {add}
          <section className="rounded-2xl bg-surface shadow-sm p-2">{list}</section>
        </div>
        <aside className="sticky top-6 h-[calc(100vh-3rem)] min-h-[480px] rounded-2xl overflow-hidden shadow-sm">
          {map('h-full', true)}
        </aside>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-3 pt-4 pb-28 space-y-3">
      {header}
      {add}
      {located && map('h-48 rounded-2xl', false)}
      <section className="rounded-2xl bg-surface px-1 py-1">{list}</section>
    </div>
  )
}
