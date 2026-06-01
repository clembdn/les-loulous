import { X } from 'lucide-react'
import { Button } from '@/shared/ui/Button.jsx'
import { groupByAisle } from '../utils/grouping.js'

export default function StoreModeView({ items, onToggle, onExit }) {
  const visible = items.filter((i) => !i.checked)
  const groups = groupByAisle(visible)

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-semibold text-fg">Mode magasin</h1>
        <Button variant="secondary" size="sm" onClick={onExit}><X size={16} /> Fini</Button>
      </header>
      <div className="max-w-xl mx-auto px-4 py-4">
        {groups.length === 0 ? (
          <p className="text-center text-muted py-16">Tout est coché 🎉</p>
        ) : (
          groups.map(({ aisle, items: its }) => {
            const Icon = aisle.icon
            return (
              <section key={aisle.id} className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={18} className={aisle.colorClass} />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{aisle.label}</h2>
                </div>
                <div className="space-y-2">
                  {its.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => onToggle(it)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface border border-border text-left active:scale-[0.99] transition"
                    >
                      <span className="h-7 w-7 rounded-full border-2 border-border-strong shrink-0" />
                      <span className="flex-1 text-lg text-fg">{it.name}</span>
                      {it.quantityLabel && <span className="text-base text-muted">{it.quantityLabel}</span>}
                    </button>
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
