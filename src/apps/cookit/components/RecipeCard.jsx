import { Card } from '@/shared/ui/Card.jsx'
import { ChevronRight, ChefHat, Clock, Users } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatPrepTime } from '../utils/recipeMeta.js'
import { getMealType } from '../config/mealTypes.js'

// Étiquettes de type de repas, en ICÔNES SEULES : sur une grille à deux
// colonnes, une carte fait ~155 px de large sur un téléphone de 360 — les
// libellés n'y tiennent pas. Le mot complet reste sur la fiche recette.
function MealIcons({ meals, size = 12 }) {
  if (!meals.length) return null
  const types = meals.map(getMealType).filter(Boolean)
  if (!types.length) return null
  const labels = types.map((m) => m.label).join(', ')
  return (
    <span className="flex items-center gap-1 shrink-0" title={labels}>
      {types.map((m) => {
        const Icon = m.icon
        return <Icon key={m.id} size={size} className={m.colorClass} aria-hidden="true" />
      })}
      <span className="sr-only">{labels}</span>
    </span>
  )
}

function Thumb({ recipe, className, iconSize }) {
  if (recipe.imageUrl) {
    return (
      <img
        src={recipe.imageUrl}
        alt=""
        loading="lazy"
        // `decoding=async` : sur une grille de 20 vignettes, le décodage
        // synchrone fait tressauter le défilement au doigt.
        decoding="async"
        className={cn('object-cover bg-surface-2', className)}
      />
    )
  }
  return (
    <div className={cn('bg-surface-2 flex items-center justify-center', className)}>
      <ChefHat size={iconSize} className="text-faint" />
    </div>
  )
}

// Résumé d'une recette. Deux densités :
//   'grid' — vignette + titre, en grille (2 colonnes dès le téléphone) ;
//   'row'  — rangée compacte, pour balayer un long répertoire à la verticale.
export default function RecipeCard({ recipe, variant = 'grid', onClick }) {
  const ing = recipe.ingredients.length
  const time = formatPrepTime(recipe.prepMinutes)

  if (variant === 'row') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-1 py-2.5 text-left border-b border-border hover:bg-surface-2 transition"
      >
        <Thumb recipe={recipe} className="h-14 w-14 rounded-xl shrink-0" iconSize={20} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg truncate">{recipe.title}</span>
          <span className="block text-xs text-faint truncate">
            {[time, `${ing} ingrédient${ing > 1 ? 's' : ''}`, recipe.servings > 0 ? `${recipe.servings} pers.` : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <MealIcons meals={recipe.meals} size={14} />
        <ChevronRight size={16} className="text-faint shrink-0" />
      </button>
    )
  }

  return (
    <Card interactive className="overflow-hidden flex flex-col">
      <button
        type="button"
        onClick={onClick}
        className="flex-1 flex flex-col text-left rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <Thumb recipe={recipe} className="w-full aspect-[4/3] shrink-0" iconSize={24} />
        <span className="flex-1 flex flex-col p-2.5 lg:p-3">
          {/* Deux lignes maximum : au-delà, les cartes d'une même rangée
              cessent d'avoir la même hauteur et la grille se déchire. */}
          <span className="text-[13px] lg:text-sm font-medium text-fg leading-snug line-clamp-2">
            {recipe.title}
          </span>
          <span className="mt-auto pt-1.5 flex items-center gap-2 text-[11px] text-faint">
            <MealIcons meals={recipe.meals} />
            {time && (
              <span className="inline-flex items-center gap-1 truncate">
                <Clock size={11} className="shrink-0" /> {time}
              </span>
            )}
            {!time && recipe.servings > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users size={11} className="shrink-0" /> {recipe.servings}
              </span>
            )}
            {!time && !recipe.servings && (
              <span className="truncate">{ing} ingr.</span>
            )}
          </span>
        </span>
      </button>
    </Card>
  )
}
