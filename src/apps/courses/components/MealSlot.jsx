import { Plus, X, ListPlus, Users } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { whoMeta } from '../utils/who.js'

export default function MealSlot({ label, slot, meals, recipes, onAdd, onRemove, onSendToList }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">{label}</h4>
      <div className="space-y-1">
        {meals.map((m) => {
          const meta = whoMeta(m.who)
          const recipe = m.recipeId ? recipes.find((r) => r.id === m.recipeId) : null
          return (
            <div key={m.id} className="flex items-center gap-2 rounded-lg bg-surface-2 border border-border px-2.5 py-1.5">
              {meta.both ? (
                <Users size={13} className="text-faint shrink-0" />
              ) : (
                <span className={cn('h-2 w-2 rounded-full shrink-0', meta.dotClass)} />
              )}
              <span className="flex-1 min-w-0 text-sm text-fg truncate">
                {m.title}
                <span className="text-faint"> · {meta.label}</span>
              </span>
              {recipe && (
                <button
                  onClick={() => onSendToList(recipe)}
                  aria-label="Ajouter les ingrédients à la liste"
                  className="shrink-0 p-1 text-muted hover:text-accent transition"
                >
                  <ListPlus size={15} />
                </button>
              )}
              <button
                onClick={() => onRemove(slot, m.id)}
                aria-label="Retirer le repas"
                className="shrink-0 p-1 text-faint hover:text-danger transition"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
        <button
          onClick={() => onAdd(slot)}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-border text-xs text-muted hover:text-fg hover:border-border-strong transition"
        >
          <Plus size={13} /> Ajouter
        </button>
      </div>
    </div>
  )
}
