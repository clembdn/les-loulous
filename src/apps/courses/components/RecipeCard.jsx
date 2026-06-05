import { Card } from '@/shared/ui/Card.jsx'
import { ChevronRight, ChefHat } from 'lucide-react'

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
        </div>
        <ChevronRight size={18} className="text-faint shrink-0" />
      </div>
    </Card>
  )
}
