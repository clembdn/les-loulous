import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { cn } from '@/shared/lib/utils.js'
import { normalizeName } from '../utils/aisleGuess.js'
import { WHO_OPTIONS, WHO_BOTH } from '../utils/who.js'
import { AUTHORIZED_UIDS } from '@/shared/config/people.js'

export default function MealPickerSheet({ open, onClose, recipes, onSubmit }) {
  const [who, setWho] = useState(WHO_BOTH)
  // Parts SERVIES à ce repas. « Nous deux » en vaut deux — une chacun — et non
  // une, sinon un plat prévu pour 4 ne comptait qu'une demi-portion par personne.
  const [portions, setPortions] = useState(AUTHORIZED_UIDS.length)
  const [q, setQ] = useState('')
  // Une fois la quantité réglée à la main, changer « pour qui » ne la réécrit plus.
  const touched = useRef(false)

  // Reset à chaque ouverture.
  useEffect(() => {
    if (open) { setWho(WHO_BOTH); setQ(''); setPortions(AUTHORIZED_UIDS.length); touched.current = false }
  }, [open])

  function chooseWho(value) {
    setWho(value)
    if (!touched.current) setPortions(value === WHO_BOTH ? AUTHORIZED_UIDS.length : 1)
  }

  function bump(delta) {
    touched.current = true
    setPortions((p) => Math.max(0.5, Math.round((p + delta) * 2) / 2))
  }

  const filtered = useMemo(() => {
    const base = [...recipes].sort((a, b) => a.title.localeCompare(b.title))
    const n = normalizeName(q)
    return n ? base.filter((r) => normalizeName(r.title).includes(n)) : base
  }, [recipes, q])

  function pickRecipe(r) {
    onSubmit({ recipeId: r.id, title: r.title, who, portions })
    onClose()
  }
  function addFree() {
    const t = q.trim()
    if (!t) return
    onSubmit({ recipeId: null, title: t, who, portions })
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Ajouter un repas">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Parts servies</label>
          <div className="inline-flex items-center rounded-xl border border-border overflow-hidden">
            <button onClick={() => bump(-0.5)} className="px-3.5 py-2 text-fg hover:bg-surface-2 transition" aria-label="Moins de parts">−</button>
            <span className="px-3 min-w-[3rem] text-center tabular text-fg">{portions}</span>
            <button onClick={() => bump(0.5)} className="px-3.5 py-2 text-fg hover:bg-surface-2 transition" aria-label="Plus de parts">+</button>
          </div>
          <p className="text-[11px] text-faint mt-1.5">
            Au sens de la recette : {AUTHORIZED_UIDS.length} = une portion pour chacun.
          </p>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Pour qui ?</label>
          <div className="flex gap-2">
            {WHO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => chooseWho(opt.value)}
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
