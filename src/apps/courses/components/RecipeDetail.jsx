import { useState, useMemo } from 'react'
import { ArrowLeft, Pencil, Copy, Trash2, Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { buildStockIndex, getStockStatus, getStatusMeta } from '../config/pantryStatus.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import AddIngredientsSheet from './AddIngredientsSheet.jsx'

export default function RecipeDetail({ recipe, items, catalog, pantry = [], onBack, onEdit, onDuplicate, onDelete, onAdded }) {
  const [addOpen, setAddOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const stockIndex = useMemo(() => buildStockIndex(pantry), [pantry])
  const inStockCount = recipe.ingredients.filter((ing) => getStockStatus(ing.name, stockIndex) === 'ok').length

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition">
            <ArrowLeft size={16} /> Recettes
          </button>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition" aria-label="Modifier">
              <Pencil size={18} />
            </button>
            <button onClick={() => onDuplicate(recipe)} className="p-2 rounded-lg text-muted hover:text-fg hover:bg-surface-2 transition" aria-label="Dupliquer">
              <Copy size={18} />
            </button>
            <button onClick={() => setConfirmDel(true)} className="p-2 rounded-lg text-muted hover:text-danger hover:bg-surface-2 transition" aria-label="Supprimer">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 pb-28 pt-4">
        {recipe.imageUrl && (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full aspect-[16/9] object-cover rounded-2xl mb-4"
          />
        )}
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-fg">{recipe.title}</h1>
        {recipe.note && <p className="text-sm text-muted mt-2 whitespace-pre-line">{recipe.note}</p>}

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Ingrédients ({recipe.ingredients.length})
            {inStockCount > 0 && (
              <span className="normal-case font-medium text-emerald-600"> · {inStockCount} déjà en stock</span>
            )}
          </h2>
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-faint">Aucun ingrédient.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recipe.ingredients.map((ing, i) => {
                const stock = getStockStatus(ing.name, stockIndex)
                const meta = stock ? getStatusMeta(stock) : null
                return (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[15px] text-fg">{ing.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {ing.quantityLabel && <span className="text-sm text-muted">{ing.quantityLabel}</span>}
                      {meta && (
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border', meta.pillClass)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClass)} />
                          {meta.label}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {recipe.steps.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Préparation</h2>
            <ol className="space-y-3">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="text-[15px] text-fg whitespace-pre-line pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-gradient-to-t from-bg to-transparent pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto">
          <Button className="w-full shadow-lift" size="lg" onClick={() => setAddOpen(true)}>
            <Plus size={18} /> Ajouter à la liste
          </Button>
        </div>
      </div>

      <AddIngredientsSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        ingredients={recipe.ingredients}
        items={items}
        catalog={catalog}
        pantry={pantry}
        onAdded={onAdded}
      />
      <ConfirmDialog
        open={confirmDel}
        title="Supprimer la recette ?"
        message="Cette recette sera définitivement supprimée. Les articles déjà ajoutés à la liste ne sont pas affectés."
        confirmLabel="Supprimer"
        onConfirm={() => onDelete(recipe.id)}
        onClose={() => setConfirmDel(false)}
      />
    </div>
  )
}
