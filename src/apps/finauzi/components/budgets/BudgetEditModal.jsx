import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from '@/shared/ui/Modal.jsx'
import { updateSettings } from '../../services/settingsService.js'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import { toast } from '@/shared/ui/sonner.jsx'

export default function BudgetEditModal({ open, onClose, category, currentBudgets, currentUid }) {
  const { format: formatEUR } = useCurrency()
  const existingAmount = currentBudgets?.[category?.id]
  const [amount, setAmount] = useState(
    existingAmount != null ? String(existingAmount) : ''
  )

  if (!category) return null
  const Icon = category.icon

  // Écritures optimistes : l'UI est mise à jour par le cache local, fonctionne hors-ligne.
  function onSave(e) {
    e.preventDefault()
    const value = parseFloat(amount.replace(',', '.'))
    if (!isFinite(value) || value < 0) {
      toast.error('Montant invalide')
      return
    }
    updateSettings(
      { budgets: { ...currentBudgets, [category.id]: Math.round(value) } },
      currentUid,
    ).catch((err) => toast.error(err.message || 'Erreur de synchronisation'))
    toast.success(`Budget « ${category.label} » enregistré`)
    onClose()
  }

  function onDelete() {
    if (!confirm(`Supprimer le budget « ${category.label} » ?`)) return
    const next = { ...(currentBudgets || {}) }
    delete next[category.id]
    updateSettings({ budgets: next }, currentUid)
      .catch((err) => toast.error(err.message || 'Erreur de synchronisation'))
    toast.success('Budget supprimé')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Budget mensuel">
      <form onSubmit={onSave} className="space-y-5">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${category.bgClass} ${category.textClass}`}>
            <Icon size={20} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-base font-medium text-white">{category.label}</p>
            <p className="text-xs text-white/40">
              {existingAmount != null
                ? `Budget actuel : ${formatEUR(existingAmount)}`
                : 'Aucun budget défini'}
            </p>
          </div>
        </div>

        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">
            Montant mensuel (EUR)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            autoFocus
            className="w-full px-3 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-lg text-white tabular focus:outline-none focus:border-white/30 transition"
          />
        </label>

        <div className="flex gap-2">
          {existingAmount != null && (
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
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  )
}
