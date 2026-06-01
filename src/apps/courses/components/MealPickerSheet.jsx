import { useState, useEffect, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { cn } from '@/shared/lib/utils.js'
import { normalizeName } from '../utils/aisleGuess.js'
import { WHO_OPTIONS, WHO_BOTH } from '../utils/who.js'

export default function MealPickerSheet({ open, onClose, recipes, onSubmit }) {
  const [who, setWho] = useState(WHO_BOTH)
  const [q, setQ] = useState('')

  // Reset à chaque ouverture.
  useEffect(() => {
    if (open) { setWho(WHO_BOTH); setQ('') }
  }, [open])

  const filtered = useMemo(() => {
    const base = [...recipes].sort((a, b) => a.title.localeCompare(b.title))
    const n = normalizeName(q)
    return n ? base.filter((r) => normalizeName(r.title).includes(n)) : base
  }, [recipes, q])

  function pickRecipe(r) {
    onSubmit({ recipeId: r.id, title: r.title, who })
    onClose()
  }
  function addFree() {
    const t = q.trim()
    if (!t) return
    onSubmit({ recipeId: null, title: t, who })
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Ajouter un repas">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Pour qui ?</label>
          <div className="flex gap-2">
            {WHO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setWho(opt.value)}
                className={cn(
                  'flex-1 px-3 py-1.5 rounded-lg text-sm border transition',
                  who === opt.value
                    ? 'bg-accent text-accent-fg border-accent'
                    : 'bg-surface-2 text-muted border-border hover:text-fg',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recette ou repas libre…" autoFocus />

        {q.trim() && (
          <button
            onClick={addFree}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border text-sm text-fg hover:border-accent transition"
          >
            <Plus size={16} className="text-accent shrink-0" />
            <span className="truncate">Ajouter « {q.trim()} »</span>
            <span className="text-muted shrink-0">repas libre</span>
          </button>
        )}

        <div className="max-h-64 overflow-y-auto -mx-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-faint py-4 text-center">
              {q.trim() ? 'Aucune recette trouvée.' : 'Aucune recette pour l’instant.'}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => pickRecipe(r)}
                  className="w-full text-left flex items-center justify-between gap-2 px-1 py-2.5 hover:bg-surface-2 rounded-lg transition"
                >
                  <span className="text-sm text-fg truncate">{r.title}</span>
                  <span className="text-xs text-faint shrink-0">{r.ingredients.length} ingr.</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}
