import { Star, Trash2 } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { cn } from '@/shared/lib/utils.js'
import { AISLES, getAisle } from '../config/aisles.js'

export default function FavoritesSheet({ open, onClose, catalog, onToggleFavorite, onSetAisle, onRemove }) {
  const sorted = [...catalog].sort(
    (a, b) => (Number(b.favorite) - Number(a.favorite)) || (b.useCount - a.useCount) || a.name.localeCompare(b.name),
  )

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Favoris & fréquents">
      {sorted.length === 0 ? (
        <p className="text-sm text-muted py-8 text-center">Aucun produit mémorisé pour l'instant.</p>
      ) : (
        <div className="divide-y divide-border">
          {sorted.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2.5">
              <button
                onClick={() => onToggleFavorite(c)}
                aria-label={c.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                className={cn('p-1 transition', c.favorite ? 'text-accent' : 'text-faint hover:text-muted')}
              >
                <Star size={18} className={c.favorite ? 'fill-current' : ''} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-fg truncate">{c.name}</p>
                <p className="text-xs text-faint">{getAisle(c.aisle).label} · {c.useCount}×</p>
              </div>
              <select
                value={c.aisle}
                onChange={(e) => onSetAisle(c, e.target.value)}
                aria-label="Rayon par défaut"
                className="text-xs bg-surface-2 border border-border rounded-md px-1.5 py-1 text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {AISLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <button
                onClick={() => onRemove(c.id)}
                aria-label="Retirer du catalogue"
                className="text-faint hover:text-danger p-1 transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
