import { useState } from 'react'
import { ChevronDown, Check, Plus, Settings2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'

// Sélecteur de liste de courses : bouton déroulant (nom de la liste active) →
// bascule entre listes actives, création, accès à la gestion/archives.
export default function ListPicker({ activeLists, activeListId, activeList, counts, onSelect, onCreate, onManage }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 min-w-0 max-w-full text-left rounded-lg px-1 -mx-1 py-0.5 hover:bg-surface-2 transition"
        aria-label="Changer de liste"
      >
        <h1 className="text-xl font-semibold tracking-tight text-fg truncate">
          {activeList?.name || 'Nos courses'}
        </h1>
        <ChevronDown size={18} className="shrink-0 text-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 w-64 rounded-xl border border-border bg-surface shadow-lift py-1">
            <div className="max-h-72 overflow-y-auto">
              {activeLists.map((l) => {
                const isActive = l.id === activeListId
                const n = counts?.[l.id] || 0
                return (
                  <button
                    key={l.id}
                    onClick={() => { onSelect(l.id); setOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-fg hover:bg-surface-2 transition"
                  >
                    <Check size={16} className={cn('shrink-0', isActive ? 'text-accent' : 'opacity-0')} />
                    <span className="flex-1 truncate text-left">{l.name}</span>
                    {n > 0 && <span className="shrink-0 text-xs text-muted">{n}</span>}
                  </button>
                )
              })}
            </div>
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => { onCreate(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-fg hover:bg-surface-2 transition"
            >
              <Plus size={16} className="shrink-0 text-accent" />
              Nouvelle liste
            </button>
            <button
              onClick={() => { onManage(); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-fg hover:bg-surface-2 transition"
            >
              <Settings2 size={16} className="shrink-0 text-muted" />
              Gérer les listes
            </button>
          </div>
        </>
      )}
    </div>
  )
}
