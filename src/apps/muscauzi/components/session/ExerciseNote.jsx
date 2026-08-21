import { useState, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'

// Note de réglages du mouvement (« siège 4, dossier 2, prise neutre »).
// Lue debout devant la machine : elle passe avant les séries, en petit, et les
// retours à la ligne sont conservés.
//
// Pas de note → on n'affiche RIEN : ni bloc, ni titre, ni placeholder. Seul le
// crayon reste disponible pour en créer une.
export default function ExerciseNote({ note, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note || '')

  useEffect(() => { if (!editing) setDraft(note || '') }, [note, editing])

  if (editing) {
    return (
      <div className="mb-3">
        <textarea
          autoFocus
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Siège 4, dossier 2, prise neutre…"
          className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-sm text-fg placeholder:text-faint
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition resize-y"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => { setEditing(false); setDraft(note || '') }}
            className="flex-1 h-10 rounded-lg border border-border text-xs font-medium text-muted hover:text-fg transition inline-flex items-center justify-center gap-1.5"
          >
            <X size={14} /> Annuler
          </button>
          <button
            onClick={() => { onSave(draft); setEditing(false) }}
            className="flex-1 h-10 rounded-lg bg-surface-2 border border-accent/40 text-xs font-semibold text-accent transition inline-flex items-center justify-center gap-1.5"
          >
            <Check size={14} strokeWidth={2.6} /> Enregistrer
          </button>
        </div>
      </div>
    )
  }

  if (!note) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 mb-3 text-[11px] text-faint hover:text-muted transition"
      >
        <Pencil size={12} /> Ajouter une note de réglages
      </button>
    )
  }

  return (
    <div className="mb-3 flex items-start gap-2">
      <p className="flex-1 min-w-0 text-[12px] leading-relaxed text-muted whitespace-pre-line">{note}</p>
      <button
        onClick={() => setEditing(true)}
        aria-label="Modifier la note"
        className="shrink-0 p-1.5 -mt-1 rounded-lg text-faint hover:text-fg hover:bg-surface-2 transition"
      >
        <Pencil size={13} />
      </button>
    </div>
  )
}
