import { useState } from 'react'
import { Plus, Star } from 'lucide-react'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'

export default function QuickAddBar({ catalog, suggestions, onAdd }) {
  const [name, setName] = useState('')

  function submit(e) {
    e.preventDefault()
    const v = name.trim()
    if (!v) return
    onAdd(v)
    setName('')
  }

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          list="courses-catalog"
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
      <datalist id="courses-catalog">
        {catalog.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => onAdd(s.name)}
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
