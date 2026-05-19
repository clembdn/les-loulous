import { useState, useEffect } from 'react'
import { Shield, Pencil, Save, X } from 'lucide-react'

export default function SafetyBufferControl({ value, onChange, format }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft(value), [value])

  const commit = () => {
    const num = Number(draft)
    if (num >= 0) onChange(num)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-elevated border border-border-subtle">
      <Shield className="h-4 w-4 text-warning shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Seuil de sécurité</p>
        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              type="number"
              min="0"
              step="100"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
              className="h-8 w-32 rounded-lg bg-bg-card border border-brand px-2 text-sm outline-none tabular-nums"
            />
            <button onClick={commit} className="p-1 text-success hover:text-success/80 transition-colors">
              <Save className="h-4 w-4" />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="group flex items-center gap-1.5 mt-0.5"
          >
            <span className="text-lg font-semibold tabular-nums text-warning">{format(value)}</span>
            <Pencil className="h-3 w-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </div>
  )
}
