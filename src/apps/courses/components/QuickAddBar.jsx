import { useMemo, useState } from 'react'
import { Plus, Star } from 'lucide-react'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { normalizeName } from '../utils/aisleGuess.js'
import { cn } from '@/shared/lib/utils.js'

const MAX_SUGGESTIONS = 8

// Barre d'ajout rapide. Pas de menu déroulant natif (<datalist>) : les suggestions
// s'affichent en pastilles sous le champ et se filtrent en direct pendant la frappe.
export default function QuickAddBar({ catalog, items, onAdd }) {
  const [name, setName] = useState('')

  const listedNames = useMemo(
    () => new Set((items || []).map((i) => normalizeName(i.name))),
    [items],
  )

  const suggestions = useMemo(() => {
    const q = normalizeName(name.trim())
    const pool = catalog.filter((c) => !listedNames.has(normalizeName(c.name)))
    const matches = q ? pool.filter((c) => normalizeName(c.name).includes(q)) : pool
    return matches
      .sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || (b.useCount - a.useCount) || a.name.localeCompare(b.name))
      .slice(0, MAX_SUGGESTIONS)
  }, [catalog, listedNames, name])

  function add(v) {
    const val = v.trim()
    if (!val) return
    onAdd(val)
    setName('')
  }
  function submit(e) {
    e.preventDefault()
    add(name)
  }

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ajouter un article…"
          autoComplete="off"
          aria-label="Nom de l'article"
        />
        <Button type="submit" className="px-4 shrink-0" aria-label="Ajouter">
          <Plus size={18} />
        </Button>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => add(s.name)}
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border transition',
                'bg-surface-2 border-border text-fg hover:border-accent hover:text-accent',
              )}
            >
              {s.favorite && <Star size={12} className="fill-current text-accent" />}
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
