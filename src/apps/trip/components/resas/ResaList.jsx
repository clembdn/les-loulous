import { Paperclip } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { formatPrice } from '../../utils/format.js'
import { ResaIcon, resaSummary, resaTitle } from './resaDisplay.jsx'

// La liste chronologique des réservations — hébergements et trajets mêlés,
// dans l'ordre où on les vivra.
export default function ResaList({ entries, selectedKey, attachmentsByParent, colorIndexByStay, onSelect }) {
  return (
    <ul className="space-y-1">
      {entries.map(({ key, kind, item }) => {
        const files = attachmentsByParent[item.id]?.length || 0
        const active = key === selectedKey
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(kind, item.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                active ? 'bg-accent/10' : 'hover:bg-surface-2',
              )}
            >
              <ResaIcon kind={kind} item={item} colorIndex={colorIndexByStay[item.id]} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg truncate">{resaTitle(kind, item)}</span>
                <span className="block text-xs text-muted truncate">{resaSummary(kind, item)}</span>
              </span>
              <span className="shrink-0 text-right">
                {item.price != null && <span className="block text-sm text-fg tabular">{formatPrice(item.price, item.currency)}</span>}
                {files > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-faint">
                    <Paperclip size={11} /> {files}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
