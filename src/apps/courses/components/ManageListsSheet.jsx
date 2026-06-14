import { useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Trash2, Check, X } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { cn } from '@/shared/lib/utils.js'

function IconBtn({ onClick, label, danger, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'p-1.5 rounded-lg transition shrink-0',
        danger ? 'text-muted hover:text-danger hover:bg-surface-2' : 'text-muted hover:text-fg hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  )
}

// Gestion des listes : renommer / archiver / supprimer les actives, rouvrir ou
// supprimer les archivées. La traçabilité passe par l'archivage.
export default function ManageListsSheet({
  open, onClose, activeLists, archivedLists, counts,
  onRename, onArchive, onUnarchive, onDelete,
}) {
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState(null) // liste à supprimer

  function startEdit(l) { setEditId(l.id); setDraft(l.name) }
  function commitEdit() {
    const v = draft.trim()
    if (v) onRename(editId, v)
    setEditId(null)
  }

  function row(l, { archived }) {
    const isEditing = editId === l.id
    const n = counts?.[l.id] || 0
    return (
      <div key={l.id} className="flex items-center gap-2 py-2">
        {isEditing ? (
          <>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditId(null) }}
              autoFocus
              className="flex-1"
            />
            <IconBtn onClick={commitEdit} label="Valider"><Check size={16} /></IconBtn>
            <IconBtn onClick={() => setEditId(null)} label="Annuler"><X size={16} /></IconBtn>
          </>
        ) : (
          <>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-fg truncate">{l.name}</span>
              {n > 0 && <span className="block text-xs text-muted">{n} article{n > 1 ? 's' : ''}</span>}
            </span>
            <IconBtn onClick={() => startEdit(l)} label="Renommer"><Pencil size={16} /></IconBtn>
            {archived ? (
              <IconBtn onClick={() => onUnarchive(l.id)} label="Rouvrir"><ArchiveRestore size={16} /></IconBtn>
            ) : (
              <IconBtn onClick={() => onArchive(l.id)} label="Archiver"><Archive size={16} /></IconBtn>
            )}
            <IconBtn onClick={() => setConfirm(l)} label="Supprimer" danger><Trash2 size={16} /></IconBtn>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Gérer les listes">
        <div className="space-y-6">
          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-1">En cours</h3>
            {activeLists.length === 0 ? (
              <p className="text-sm text-muted py-2">Aucune liste active.</p>
            ) : (
              <div className="divide-y divide-border">{activeLists.map((l) => row(l, { archived: false }))}</div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-1">Archives</h3>
            {archivedLists.length === 0 ? (
              <p className="text-sm text-muted py-2">Aucune liste archivée.</p>
            ) : (
              <div className="divide-y divide-border">{archivedLists.map((l) => row(l, { archived: true }))}</div>
            )}
          </section>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        title="Supprimer la liste ?"
        message={confirm ? `« ${confirm.name} » et tous ses articles seront supprimés définitivement.` : ''}
        confirmLabel="Supprimer"
        onConfirm={() => { if (confirm) onDelete(confirm.id) }}
        onClose={() => setConfirm(null)}
      />
    </>
  )
}
