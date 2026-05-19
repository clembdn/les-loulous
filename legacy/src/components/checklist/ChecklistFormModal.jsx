import { useState, useEffect } from 'react'
import { X, Save, Trash2, AlertCircle, Link2 } from 'lucide-react'
import { FINAUZI_PEOPLE } from '../../config/people.js'

const STATUS_OPTIONS = [
  { id: 'todo', label: 'À faire' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'done', label: 'Fait' },
  { id: 'optional', label: 'Optionnel' }
]

const PRIORITY_OPTIONS = [
  { id: 'low', label: 'Basse' },
  { id: 'normal', label: 'Normale' },
  { id: 'high', label: 'Haute' }
]

const EMPTY_FORM = {
  title: '',
  description: '',
  section: 'Avant le départ',
  status: 'todo',
  priority: 'normal',
  dueDate: '',
  concerns: 'common',
  plannedCost: '',
  actualCost: '',
  currency: 'EUR',
  linkedTransactionId: '',
}

export default function ChecklistFormModal({ isOpen, onClose, onSave, onDelete, item, sections, transactions = [] }) {
  const isEditing = !!item
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (item) {
      setForm({
        ...EMPTY_FORM,
        ...item,
        dueDate: item.dueDate || '',
        plannedCost: item.plannedCost ? String(item.plannedCost) : '',
        actualCost: item.actualCost ? String(item.actualCost) : '',
        linkedTransactionId: item.linkedTransactionId || '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
    setShowDeleteConfirm(false)
  }, [item, isOpen])

  if (!isOpen) return null

  const validate = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Le titre est requis'
    if (!form.section) errs.section = 'La section est requise'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    const dataToSave = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      plannedCost: form.plannedCost ? Number(form.plannedCost) : null,
      actualCost: form.actualCost ? Number(form.actualCost) : null,
      dueDate: form.dueDate || null,
      linkedTransactionId: form.linkedTransactionId || null,
    }

    if (isEditing) {
      dataToSave.id = item.id
    }

    await onSave(dataToSave)
    onClose()
  }

  const handleDelete = async () => {
    if (showDeleteConfirm) {
      const ok = await onDelete(item.id)
      if (ok) onClose()
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-bg-card border border-border-subtle rounded-2xl shadow-2xl animate-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle shrink-0">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Modifier la tâche' : 'Nouvelle tâche'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
              Titre *
            </label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ex : Acheter les billets d'avion..."
              className={`h-10 w-full rounded-xl bg-bg-elevated border px-3 text-sm outline-none transition-colors
                ${errors.title ? 'border-danger focus:border-danger' : 'border-border-subtle focus:border-brand'}`}
            />
            {errors.title && (
              <p className="text-xs text-danger mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.title}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Section */}
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
                Section *
              </label>
              <select
                value={form.section}
                onChange={(e) => set('section', e.target.value)}
                className="h-10 w-full rounded-xl bg-bg-elevated border border-border-subtle px-3 text-sm outline-none focus:border-brand transition-colors appearance-none"
              >
                {sections.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
                Statut
              </label>
              <select
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
                className="h-10 w-full rounded-xl bg-bg-elevated border border-border-subtle px-3 text-sm outline-none focus:border-brand transition-colors appearance-none"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Concerns */}
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
                Concerne
              </label>
              <select
                value={form.concerns}
                onChange={(e) => set('concerns', e.target.value)}
                className="h-10 w-full rounded-xl bg-bg-elevated border border-border-subtle px-3 text-sm outline-none focus:border-brand transition-colors appearance-none"
              >
                <option value="common">Commun</option>
                <option value="user_a">Utilisateur A (Clément)</option>
                <option value="user_b">Utilisateur B (Lise)</option>
                {FINAUZI_PEOPLE.map(p => (
                  <option key={p.uid} value={p.uid}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
                Priorité
              </label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                className="h-10 w-full rounded-xl bg-bg-elevated border border-border-subtle px-3 text-sm outline-none focus:border-brand transition-colors appearance-none"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
              Deadline (optionnel)
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
              className="h-10 w-full rounded-xl bg-bg-elevated border border-border-subtle px-3 text-sm outline-none focus:border-brand transition-colors"
            />
          </div>

          {/* Costs */}
          <div className="p-4 rounded-xl border border-border-subtle bg-bg-elevated/50 space-y-4">
            <h3 className="text-sm font-medium text-text-primary">Budget (optionnel)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
                  Coût Prévu
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.plannedCost}
                    onChange={(e) => set('plannedCost', e.target.value)}
                    placeholder="0.00"
                    className="h-10 w-full rounded-xl bg-bg-elevated border border-border-subtle px-3 pr-16 text-sm outline-none focus:border-brand tabular-nums transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-text-muted">
                    <select
                      value={form.currency}
                      onChange={(e) => set('currency', e.target.value)}
                      className="bg-transparent outline-none appearance-none cursor-pointer"
                    >
                      <option value="EUR">EUR</option>
                      <option value="AUD">AUD</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
                  Coût Réel
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.actualCost}
                    onChange={(e) => set('actualCost', e.target.value)}
                    placeholder="0.00"
                    className="h-10 w-full rounded-xl bg-bg-elevated border border-border-subtle px-3 pr-16 text-sm outline-none focus:border-brand tabular-nums transition-colors"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-text-muted">
                    {form.currency}
                  </div>
                </div>
              </div>
            </div>

            {/* Budget comparison indicator */}
            {form.plannedCost && form.actualCost && (
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium ${
                Number(form.actualCost) <= Number(form.plannedCost)
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                {Number(form.actualCost) <= Number(form.plannedCost) ? '✓' : '⚠'}{' '}
                {Number(form.actualCost) <= Number(form.plannedCost)
                  ? `${(Number(form.plannedCost) - Number(form.actualCost)).toFixed(2)} ${form.currency} sous le budget`
                  : `${(Number(form.actualCost) - Number(form.plannedCost)).toFixed(2)} ${form.currency} au-dessus du budget`
                }
              </div>
            )}
          </div>

          {/* Linked Transaction */}
          {transactions.length > 0 && (
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
                <Link2 className="h-3 w-3 inline mr-1" />
                Transaction liée (optionnel)
              </label>
              <select
                value={form.linkedTransactionId}
                onChange={(e) => set('linkedTransactionId', e.target.value)}
                className="h-10 w-full rounded-xl bg-bg-elevated border border-border-subtle px-3 text-sm outline-none focus:border-brand transition-colors appearance-none"
              >
                <option value="">Aucune</option>
                {transactions
                  .filter(tx => tx.recurrence === 'one-off')
                  .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
                  .map(tx => (
                    <option key={tx.id} value={tx.id}>
                      {tx.title} — {tx.amountEUR?.toFixed(2)} EUR
                    </option>
                  ))}
              </select>
            </div>
          )}
          {/* Description */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
              Notes (optionnel)
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Détails supplémentaires, liens..."
              rows={3}
              className="w-full rounded-xl bg-bg-elevated border border-border-subtle px-3 py-2 text-sm outline-none focus:border-brand resize-none transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle shrink-0">
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-sm font-medium transition-all ${
                  showDeleteConfirm
                    ? 'bg-danger text-white'
                    : 'text-danger/70 hover:text-danger hover:bg-danger/10'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {showDeleteConfirm ? 'Confirmer la suppression' : 'Supprimer'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 h-9 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-elevated border border-border-subtle hover:border-strong transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-5 h-9 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 shadow-glow transition-all"
            >
              <Save className="h-3.5 w-3.5" />
              {isEditing ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
