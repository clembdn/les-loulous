import { Search, X, LayoutGrid, List } from 'lucide-react'
import { Input } from '@/shared/ui/Input.jsx'
import { cn } from '@/shared/lib/utils.js'
import { MEAL_TYPES } from '../config/mealTypes.js'

const ACCENT_CHIP = 'bg-accent text-accent-fg border-accent'

function Chip({ active, icon: Icon, iconClass, activeClass, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[13px] font-medium transition',
        active ? activeClass : 'bg-surface text-muted border-border hover:text-fg',
        // Une catégorie vide reste à sa place — les pastilles ne doivent pas
        // se réordonner sous le doigt — mais s'efface pour ne pas appeler le tap.
        !active && count === 0 && 'opacity-40',
      )}
    >
      {Icon && <Icon size={13} className={cn('shrink-0', !active && iconClass)} />}
      {label}
      <span className={cn('text-[11px] tabular', active ? 'opacity-75' : 'text-faint')}>{count}</span>
    </button>
  )
}

// Barre de recherche + filtre par repas + densité d'affichage.
//
// Collée sous la barre de navigation (44 px) : passé la dixième recette, on
// filtre en cours de défilement sans avoir à remonter en haut de la page.
export default function RecipeFilterBar({
  q, onQueryChange, meal, onMealChange, counts, layout, onLayoutChange,
}) {
  return (
    <div className="sticky top-11 lg:top-0 z-10 -mx-4 px-4 py-2 bg-bg border-b border-border">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0 lg:max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Recette ou ingrédient…"
            aria-label="Rechercher une recette"
            className="pl-9 pr-9"
          />
          {q && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Effacer la recherche"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-faint hover:text-fg transition"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="shrink-0 lg:ml-auto flex items-center gap-0.5 p-0.5 rounded-xl border border-border bg-surface-2">
          {[
            { id: 'grid', icon: LayoutGrid, label: 'Affichage en grille' },
            { id: 'list', icon: List, label: 'Affichage en liste' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onLayoutChange(id)}
              aria-label={label}
              aria-pressed={layout === id}
              title={label}
              className={cn(
                'h-9 w-9 grid place-items-center rounded-lg transition',
                layout === id ? 'bg-surface text-fg shadow-sm' : 'text-faint hover:text-fg',
              )}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {/* Rangée défilable : quatre repas + « Tous » ne tiennent pas sur 360 px. */}
      <div className="mt-2 -mx-4 px-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <Chip
          active={meal === 'all'}
          activeClass={ACCENT_CHIP}
          label="Tous"
          count={counts.all}
          onClick={() => onMealChange('all')}
        />
        {MEAL_TYPES.map((m) => (
          <Chip
            key={m.id}
            active={meal === m.id}
            activeClass={m.chipClass}
            icon={m.icon}
            iconClass={m.colorClass}
            label={m.label}
            count={counts[m.id]}
            onClick={() => onMealChange(m.id)}
          />
        ))}
        {/* Aide à la reprise de l'existant : la pastille disparaît d'elle-même
            une fois toutes les recettes classées. */}
        {counts.none > 0 && (
          <Chip
            active={meal === 'none'}
            activeClass={ACCENT_CHIP}
            label="À classer"
            count={counts.none}
            onClick={() => onMealChange('none')}
          />
        )}
      </div>
    </div>
  )
}
