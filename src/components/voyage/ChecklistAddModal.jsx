import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import { toast } from '../ui/sonner.jsx'
import {
  CHECKLIST_SECTIONS,
  STATUS_META,
  STATUS_ORDER,
} from '../../config/checklistSuggestions.js'
import {
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from '../../services/checklistService.js'
import { cn } from '../../lib/utils.js'

export default function ChecklistAddModal({
  open,
  onClose,
  existing,
  defaultSection,
  currentUid,
}) {
  const isEdit = !!existing
  const [label, setLabel] = useState('')
  const [section, setSection] = useState(defaultSection || 'before')
  const [status, setStatus] = useState('todo')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setLabel(existing?.label || '')
    setSection(existing?.section || defaultSection || 'before')
    setStatus(existing?.status || 'todo')
  }, [open, existing, defaultSection])

  async function onSubmit(e) {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) return toast.error('Donne un libellé')
    setBusy(true)
    try {
      if (isEdit) {
        await updateChecklistItem(existing.id, { label: trimmed, section, status }, currentUid)
        toast.success('Item mis à jour')
      } else {
        await createChecklistItem({ label: trimmed, section }, currentUid)
        toast.success('Item ajouté')
      }
      onClose()
    } catch (err) {
      toast.error(err.message || 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!existing?.id) return
    if (!confirm(`Supprimer « ${existing.label} » ?`)) return
    setBusy(true)
    try {
      await deleteChecklistItem(existing.id)
      toast.success('Item supprimé')
      onClose()
    } catch (err) {
      toast.error(err.message || 'Erreur')
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier' : 'Nouvel élément'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Libellé">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Visa, TFN, Chargeur…"
            className={inputClass}
            autoFocus
          />
        </Field>

        <Field label="Section">
          <div className="grid grid-cols-3 gap-1 p-1 bg-white/[0.04] rounded-xl">
            {CHECKLIST_SECTIONS.map((s) => {
              const Icon = s.icon
              const active = section === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={cn(
                    'py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5',
                    active ? `${s.bgClass} ${s.accentClass}` : 'text-white/40',
                  )}
                >
                  <Icon size={12} strokeWidth={2.2} />
                  {s.short}
                </button>
              )
            })}
          </div>
        </Field>

        {isEdit && (
          <Field label="Statut">
            <div className="grid grid-cols-3 gap-1 p-1 bg-white/[0.04] rounded-xl">
              {STATUS_ORDER.map((id) => {
                const meta = STATUS_META[id]
                const active = status === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStatus(id)}
                    className={cn(
                      'py-2 rounded-lg text-xs font-medium transition',
                      active ? `bg-white/10 ${meta.textClass}` : 'text-white/40',
                    )}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </Field>
        )}

        <div className="flex gap-2 pt-2">
          {isEdit && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-medium transition disabled:opacity-50"
            >
              <Trash2 size={14} />
              Supprimer
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-3 rounded-xl bg-white text-black font-medium text-sm disabled:opacity-50 hover:bg-white/90 transition"
          >
            {busy ? '…' : isEdit ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const inputClass = 'w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">{label}</span>
      {children}
    </label>
  )
}
