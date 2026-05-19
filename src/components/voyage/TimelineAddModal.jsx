import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import { toast } from '../ui/sonner.jsx'
import { DatePicker } from '../ui/date-picker.jsx'
import {
  createTimelineItem,
  updateTimelineItem,
  deleteTimelineItem,
} from '../../services/timelineService.js'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function TimelineAddModal({ open, onClose, existing, currentUid }) {
  const isEdit = !!existing
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setLabel(existing?.label || '')
    setDate(existing?.date || todayISO())
    setDescription(existing?.description || '')
  }, [open, existing])

  async function onSubmit(e) {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) return toast.error('Donne un libellé')
    if (!date) return toast.error('Choisis une date')
    setBusy(true)
    try {
      if (isEdit) {
        await updateTimelineItem(existing.id, {
          label: trimmed,
          date,
          description: description.trim() || null,
        }, currentUid)
        toast.success('Jalon mis à jour')
      } else {
        await createTimelineItem({
          label: trimmed,
          date,
          description: description.trim() || null,
        }, currentUid)
        toast.success('Jalon ajouté')
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
      await deleteTimelineItem(existing.id)
      toast.success('Jalon supprimé')
      onClose()
    } catch (err) {
      toast.error(err.message || 'Erreur')
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Modifier le jalon' : 'Nouveau jalon'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Date">
          <DatePicker value={date} onChange={setDate} />
        </Field>

        <Field label="Libellé">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: Visa, Avion, Road trip…"
            className={inputClass}
            autoFocus
          />
        </Field>

        <Field label="Description (optionnel)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Détails complémentaires…"
            className={inputClass}
          />
        </Field>

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
