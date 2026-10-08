import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { useIdeaActions } from '../../hooks/useIdeas.js'
import { plural } from '../../utils/format.js'
import IdeaRow from './IdeaRow.jsx'

const MAX_SHOWN = 5

/**
 * Sous la journée : les lieux à caser tout près (≤ 15 km de ses lieux), à
 * ajouter d'un « + ». Sans lieu proche, une ligne discrète mène à la liste.
 *
 * Desktop (`dnd`) : on glisse un lieu d'ici dans la frise ou sur un jour, et
 * une étape de la frise ici pour la remettre à caser.
 *   `dnd` : `{ shelving, onDragOver, onDrop, onIdeaDragStart(id), onDragEnd }`.
 */
export default function NearbyIdeas({ date, nearby, dnd = null, activeKey = null, onHover = null, className }) {
  const ui = useTripUI()
  const { ideas } = useTripData()
  const actions = useIdeaActions()
  const shown = nearby.slice(0, MAX_SHOWN)
  const shelving = !!dnd?.shelving

  if (ui.readOnly || (!ideas.length && !shelving)) return null

  const seeAll = (
    <button type="button" onClick={ui.openIdeas} className="shrink-0 h-9 -mr-1 pl-2 pr-1 inline-flex items-center text-[14px] font-medium text-accent">
      {ideas.length ? `Tout voir (${ideas.length})` : 'La liste'} <ChevronRight size={16} />
    </button>
  )

  return (
    <section
      onDragOver={shelving ? dnd.onDragOver : undefined}
      onDrop={shelving ? dnd.onDrop : undefined}
      className={cn(
        'rounded-2xl bg-surface px-2 py-2 transition',
        shelving && 'outline-dashed outline-2 outline-accent/60 bg-accent/5',
        className,
      )}
    >
      <header className="px-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-muted">
          {shown.length ? 'À caser près d’ici' : 'À caser'}
        </h3>
        {seeAll}
      </header>
      {shelving ? (
        <p className="px-2 py-3 text-[14px] text-accent font-medium">Lâchez ici pour remettre l’étape à caser.</p>
      ) : shown.length ? (
        <ul>
          {shown.map(({ idea, distanceM }) => (
            <IdeaRow
              key={idea.id}
              compact
              idea={idea}
              distanceM={distanceM}
              onOpen={ui.editIdea}
              onAdd={(i) => actions.place(i, date)}
              active={activeKey === `idea:${idea.id}`}
              onHover={onHover}
              draggable={!!dnd}
              onDragStart={() => dnd?.onIdeaDragStart(idea.id)}
              onDragEnd={dnd?.onDragEnd}
            />
          ))}
        </ul>
      ) : (
        <p className="px-2 pb-1 text-[14px] text-muted">
          {plural(ideas.length, 'lieu', 'lieux')} en attente, aucun près de cette journée.
        </p>
      )}
    </section>
  )
}
