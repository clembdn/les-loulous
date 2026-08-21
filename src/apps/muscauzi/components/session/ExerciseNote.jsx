import { useState, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/shared/ui/Button.jsx'
import { Textarea } from '@/shared/ui/Textarea.jsx'

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
        <Textarea
          autoFocus
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Siège 4, dossier 2, prise neutre…"
        />
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(false); setDraft(note || '') }}>
            <X size={14} /> Annuler
          </Button>
          <Button size="sm" className="flex-1" onClick={() => { onSave(draft); setEditing(false) }}>
            <Check size={14} strokeWidth={2.6} /> Enregistrer
          </Button>
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
      <Button variant="ghost" size="iconSm" className="shrink-0 -mt-1" aria-label="Modifier la note" onClick={() => setEditing(true)}>
        <Pencil size={13} />
      </Button>
    </div>
  )
}
