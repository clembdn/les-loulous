import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from '@/shared/ui/Modal.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { DatePicker } from '@/shared/ui/date-picker.jsx'
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

  useEffect(() => {
    if (!open) return
    setLabel(existing?.label || '')
    setDate(existing?.date || todayISO())
    setDescription(existing?.description || '')
  }, [open, existing])

  // Écritures optimistes : l'UI est mise à jour par le cache local, fonctionne hors-ligne.
  function onSubmit(e) {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) return toast.error('Donne un libellé')
    if (!date) return toast.error('Choisis une date')
    const payload = { label: trimmed, date, description: description.trim() || null }
    if (isEdit) {
      updateTimelineItem(existing.id, payload, currentUid)
        .catch((err) => toast.error(err.message || 'Erreur de synchronisation'))
      toast.success('Jalon mis à jour')
    } else {
      createTimelineItem(payload, currentUid)
        .catch((err) => toast.error(err.message || 'Erreur de synchronisation'))
      toast.success('Jalon ajouté')
    }
    onClose()
  }

  function onDelete() {
    if (!existing?.id) return
    if (!confirm(`Supprimer « ${existing.label} » ?`)) return
    deleteTimelineItem(existing.id)
      .catch((err) => toast.error(err.message || 'Erreur de synchronisation'))
    toast.success('Jalon supprimé')
    onClose()
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
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-medium transition"
            >
              <Trash2 size={14} />
              Supprimer
            </button>
          )}
          <button
            type="submit"
            className="flex-1 py-3 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition"
          >
            {isEdit ? 'Enregistrer' : 'Ajouter'}
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
