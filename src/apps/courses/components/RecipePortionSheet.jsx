import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { normalizeName } from '../utils/aisleGuess.js'
import { sumIngredients, formatKcal } from '../utils/nutrition.js'

// Inscrire un plat maison au journal : on choisit la recette, puis le nombre
// de portions réellement mangées (rarement la recette entière).

export default function RecipePortionSheet({ open, recipes, foodById, onClose, onAdd }) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [portions, setPortions] = useState(1)

  const filtered = useMemo(() => {
    const n = normalizeName(q)
    return [...recipes]
      .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
      .filter((r) => !n || normalizeName(r.title).includes(n))
  }, [recipes, q])

  const nutrition = useMemo(
    () => (selected ? sumIngredients(selected.ingredients, foodById) : null),
    [selected, foodById],
  )
  const base = selected?.servings > 0 ? selected.servings : 1
  const kcalPerPortion = nutrition ? nutrition.totals.kcal / base : 0

  function close() { setSelected(null); setQ(''); setPortions(1); onClose() }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()} title={selected ? selected.title : 'Quel plat ?'}>
      {!selected ? (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une recette" className="pl-9" autoFocus />
          </div>
          <div className="-mx-2">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelected(r); setPortions(1) }}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-surface-2 transition"
              >
                <span className="text-sm text-fg truncate">{r.title}</span>
                {r.servings > 0 && <span className="text-xs text-faint shrink-0">{r.servings} port.</span>}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted">Aucune recette.</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {nutrition.unresolved.length > 0 && (
            <p className="text-xs text-warning">
              {nutrition.unresolved.length} ingrédient{nutrition.unresolved.length > 1 ? 's' : ''} non estimé{nutrition.unresolved.length > 1 ? 's' : ''} :
              le total de ce plat est incomplet.
            </p>
          )}

          <div>
            <label className="block text-xs text-muted mb-1.5">Portions mangées</label>
            <div className="inline-flex items-center rounded-xl border border-border overflow-hidden">
              <button onClick={() => setPortions((p) => Math.max(0.5, p - 0.5))} className="px-3.5 py-2 text-fg hover:bg-surface-2 transition" aria-label="Moins">−</button>
              <span className="px-3 min-w-[3rem] text-center tabular text-fg">{portions}</span>
              <button onClick={() => setPortions((p) => p + 0.5)} className="px-3.5 py-2 text-fg hover:bg-surface-2 transition" aria-label="Plus">+</button>
            </div>
            <p className="text-[11px] text-faint mt-1.5">
              Recette prévue pour {base} portion{base > 1 ? 's' : ''}.
            </p>
          </div>

          <div className="rounded-xl bg-surface-2 p-3">
            <span className="text-lg font-semibold text-fg tabular">{formatKcal(kcalPerPortion * portions)}</span>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSelected(null)}>Retour</Button>
            <Button className="flex-1" onClick={() => { onAdd(selected, portions); close() }}>
              Ajouter au journal
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
