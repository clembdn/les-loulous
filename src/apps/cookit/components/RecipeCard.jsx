import { Card } from '@/shared/ui/Card.jsx'
import { ChevronRight, ChefHat, Clock, Users } from 'lucide-react'
import { formatPrepTime } from '../utils/recipeMeta.js'

export default function RecipeCard({ recipe, onClick }) {
  const ing = recipe.ingredients.length
  const st = recipe.steps.length
  return (
    <Card interactive onClick={onClick} className="cursor-pointer overflow-hidden flex flex-col">
      {recipe.imageUrl ? (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          loading="lazy"
          className="w-full aspect-[16/9] object-cover"
        />
      ) : (
        <div className="w-full aspect-[16/9] bg-surface-2 flex items-center justify-center">
          <ChefHat size={26} className="text-faint" />
        </div>
      )}
      <div className="p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-fg truncate">{recipe.title}</h3>
          <p className="text-xs text-muted mt-0.5">
            {ing} ingrédient{ing > 1 ? 's' : ''}{st > 0 && ` · ${st} étape${st > 1 ? 's' : ''}`}
          </p>
          {(recipe.prepMinutes > 0 || recipe.servings > 0) && (
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
              {recipe.prepMinutes > 0 && (
                <span className="inline-flex items-center gap-1"><Clock size={12} /> {formatPrepTime(recipe.prepMinutes)}</span>
              )}
              {recipe.servings > 0 && (
                <span className="inline-flex items-center gap-1"><Users size={12} /> {recipe.servings}</span>
              )}
            </div>
          )}
        </div>
        <ChevronRight size={18} className="text-faint shrink-0" />
      </div>
    </Card>
  )
}
