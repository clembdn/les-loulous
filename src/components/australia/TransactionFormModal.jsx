import { useState, useEffect } from 'react'
import { X, Save, Trash2, AlertCircle, ArrowLeftRight, CheckCircle2 } from 'lucide-react'
import { getCategoryConfig } from './CategoryBadge.jsx'
import { CLEMENT_UID, LISE_UID, FINAUZI_PEOPLE, getPersonByUid, isAuthorizedUid } from '../../config/people.js'
import { CURRENCY_RATES } from '../../context/CurrencyContext.jsx'

const CATEGORIES = [
  'housing', 'food', 'transport', 'admin', 'travel',
  'health', 'income', 'leisure', 'emergency', 'other',
]

const EMPTY_FORM = {
  title: '',
  amountEUR: '',
  type: 'expense',
  recurrence: 'one-off',
  category: 'other',
  date: new Date().toISOString().slice(0, 10),
  endDate: '',
  notes: '',
  paidByUid: CLEMENT_UID,
  reimbursementOn: false,
  reimbursementPct: 50,
}

const TRANSACTION_CURRENCIES = ['EUR', 'AUD']
const AUD_RATE = CURRENCY_RATES.AUD.rate

function formatDateFr(dateValue) {
  if (!dateValue) return ''
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default function TransactionFormModal({ isOpen, onClose, onSave, onDelete, transaction, currentUserUid }) {
  const isEditing = !!transaction
  const [form, setForm] = useState(EMPTY_FORM)
  const [amountCurrency, setAmountCurrency] = useState('EUR')
  const [errors, setErrors] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const fallbackUid = isAuthorizedUid(currentUserUid) ? currentUserUid : CLEMENT_UID
    let initialPaidByUid = fallbackUid
    let initialReimbOn = false
    let initialReimbPct = 50

    if (transaction) {
      if (isAuthorizedUid(transaction.paidByUid)) {
        initialPaidByUid = transaction.paidByUid
      } else if (isAuthorizedUid(transaction.createdBy)) {
        initialPaidByUid = transaction.createdBy
      } else if (isAuthorizedUid(transaction.personUid)) {
        initialPaidByUid = transaction.personUid
      }

      if (transaction.type === 'expense' && Array.isArray(transaction.splits) && transaction.splits.length > 0) {
        const clementSplit = transaction.splits.find(s => s.personUid === CLEMENT_UID)
        const liseSplit = transaction.splits.find(s => s.personUid === LISE_UID)

        if (clementSplit && liseSplit && clementSplit.percentage > 0 && liseSplit.percentage > 0) {
          initialReimbOn = true
          if (initialPaidByUid === CLEMENT_UID) {
            initialReimbPct = liseSplit.percentage
          } else {
            initialReimbPct = clementSplit.percentage
          }
        }
      }

      setForm({
        title: transaction.title,
        amountEUR: transaction.amountEUR != null ? String(transaction.amountEUR) : '',
        type: transaction.type,
        recurrence: transaction.recurrence,
        category: transaction.category,
        date: transaction.date,
        endDate: transaction.endDate || '',
        notes: transaction.notes || '',
        paidByUid: initialPaidByUid,
        reimbursementOn: initialReimbOn,
        reimbursementPct: initialReimbPct,
      })
    } else {
      setForm({
        ...EMPTY_FORM,
        paidByUid: fallbackUid,
      })
    }
    setAmountCurrency('EUR')
    setErrors({})
    setShowDeleteConfirm(false)
  }, [transaction, isOpen, currentUserUid])

  if (!isOpen) return null

  const validate = () => {
    const errs = {}
    if (!form.title.trim()) errs.title = 'Le titre est requis'
    if (!form.amountEUR || Number(form.amountEUR) <= 0) errs.amountEUR = 'Le montant doit être supérieur à 0'
    if (!form.date) errs.date = 'La date est requise'
    if (form.recurrence === 'monthly' && form.endDate && form.endDate < form.date) {
      errs.endDate = 'La date de fin doit être après la date de début'
    }
    if (form.type === 'expense' && form.reimbursementOn) {
      if (form.reimbursementPct < 0 || form.reimbursementPct > 100) {
        errs.reimbursementPct = 'Pourcentage invalide'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    const parsedAmount = Number(form.amountEUR)
    const amountInEUR = amountCurrency === 'EUR' ? parsedAmount : parsedAmount / AUD_RATE
    const now = new Date().toISOString()

    let allocationType = 'single'
    let splits = [{ personUid: form.paidByUid, percentage: 100 }]

    if (form.type === 'expense' && form.reimbursementOn) {
      allocationType = 'shared'
      const otherUid = form.paidByUid === CLEMENT_UID ? LISE_UID : CLEMENT_UID
      splits = [
        { personUid: form.paidByUid, percentage: 100 - form.reimbursementPct },
        { personUid: otherUid, percentage: form.reimbursementPct }
      ]
    }

    const txData = {
      ...(transaction || {}),
      id: transaction?.id || undefined,
      title: form.title.trim(),
      amountEUR: Number(amountInEUR.toFixed(2)),
      type: form.type,
      recurrence: form.recurrence,
      category: form.category,
      date: form.date,
      endDate: form.recurrence === 'monthly' && form.endDate ? form.endDate : null,
      notes: form.notes.trim() || null,
      isActive: transaction?.isActive ?? true,
      paidByUid: form.paidByUid,
      allocationType,
      splits,
      personUid: allocationType === 'single' ? form.paidByUid : null,
      createdAt: transaction?.createdAt || now,
      updatedAt: now,
    }
    await onSave(txData)
  }

  const handleDelete = async () => {
    if (showDeleteConfirm) {
      const ok = await onDelete(transaction.id)
      if (ok) {
        onClose()
      }
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const setAmountCurrencyWithConversion = (nextCurrency) => {
    setAmountCurrency((prevCurrency) => {
      if (prevCurrency === nextCurrency) return prevCurrency
      setForm((prevForm) => {
        const raw = Number(prevForm.amountEUR)
        if (!prevForm.amountEUR || Number.isNaN(raw)) return prevForm
        const converted = prevCurrency === 'EUR' ? raw * AUD_RATE : raw / AUD_RATE
        return { ...prevForm, amountEUR: String(Number(converted.toFixed(2))) }
      })
      return nextCurrency
    })
  }

  const amountNumber = Number(form.amountEUR) || 0
  const reimbAmount = (amountNumber * (form.reimbursementPct / 100)).toFixed(2)
  const payer = getPersonByUid(form.paidByUid)
  const otherUid = form.paidByUid === CLEMENT_UID ? LISE_UID : CLEMENT_UID
  const reimbPerson = getPersonByUid(otherUid)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-bg-card border border-border-subtle rounded-2xl shadow-2xl animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Modifier la transaction' : 'Nouvelle transaction'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
              Titre *
            </label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ex : Loyer, Visa, Bourse…"
              className={`h-10 w-full rounded-xl bg-bg-elevated border px-3 text-sm outline-none transition-colors
                ${errors.title ? 'border-danger focus:border-danger' : 'border-border-subtle focus:border-brand'}`}
            />
            {errors.title && (
              <p className="text-xs text-danger mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.title}
              </p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
              Montant ({amountCurrency}) *
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAmountCurrencyWithConversion(amountCurrency === 'EUR' ? 'AUD' : 'EUR')}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-muted hover:text-brand-glow hover:bg-brand/10 transition-colors"
                title="Convertir EUR/AUD"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amountEUR}
                onChange={(e) => set('amountEUR', e.target.value)}
                placeholder="0"
                className={`h-10 w-full rounded-xl bg-bg-elevated border pl-10 pr-[84px] text-sm outline-none tabular-nums transition-colors
                ${errors.amountEUR ? 'border-danger focus:border-danger' : 'border-border-subtle focus:border-brand'}`}
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 p-0.5 rounded-lg border border-border-subtle bg-bg-card/80">
                {TRANSACTION_CURRENCIES.map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => setAmountCurrencyWithConversion(currency)}
                    className={`h-7 px-2 rounded-md text-[10px] font-semibold transition-colors ${
                      amountCurrency === currency
                        ? 'bg-brand/20 text-brand-glow'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>
            {errors.amountEUR && (
              <p className="text-xs text-danger mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.amountEUR}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
                {form.recurrence === 'monthly' ? 'Départ *' : 'Date *'}
              </label>
              <input
                type="date"
                lang="fr-FR"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className={`h-10 w-full rounded-xl bg-bg-elevated border px-3 text-sm outline-none text-text-primary transition-colors
                  ${errors.date ? 'border-danger focus:border-danger' : 'border-border-subtle focus:border-brand'}`}
              />
              {!errors.date && form.date && (
                <p className="text-xs text-text-muted mt-1 capitalize">{formatDateFr(form.date)}</p>
              )}
              {errors.date && (
                <p className="text-xs text-danger mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.date}
                </p>
              )}
            </div>

            {form.recurrence === 'monthly' && (
              <div>
                <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
                  Retour
                </label>
                <input
                  type="date"
                  lang="fr-FR"
                  value={form.endDate}
                  onChange={(e) => set('endDate', e.target.value)}
                  className={`h-10 w-full rounded-xl bg-bg-elevated border px-3 text-sm outline-none text-text-primary transition-colors
                    ${errors.endDate ? 'border-danger focus:border-danger' : 'border-border-subtle focus:border-brand'}`}
                />
                {!errors.endDate && form.endDate && (
                  <p className="text-xs text-text-muted mt-1 capitalize">{formatDateFr(form.endDate)}</p>
                )}
                {errors.endDate && (
                  <p className="text-xs text-danger mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {errors.endDate}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Type toggle */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
              Type
            </label>
            <div className="flex p-0.5 rounded-xl bg-bg-elevated border border-border-subtle">
              <button
                onClick={() => { set('type', 'expense'); set('reimbursementOn', false); }}
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
                  form.type === 'expense'
                    ? 'bg-danger/20 text-danger shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Dépense
              </button>
              <button
                onClick={() => { set('type', 'income'); set('reimbursementOn', false); }}
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
                  form.type === 'income'
                    ? 'bg-success/20 text-success shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Revenu
              </button>
            </div>
          </div>

          {/* Recurrence toggle */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
              Récurrence
            </label>
            <div className="flex p-0.5 rounded-xl bg-bg-elevated border border-border-subtle">
              <button
                onClick={() => set('recurrence', 'one-off')}
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
                  form.recurrence === 'one-off'
                    ? 'bg-brand/20 text-brand-glow shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Occasionnel
              </button>
              <button
                onClick={() => set('recurrence', 'monthly')}
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
                  form.recurrence === 'monthly'
                    ? 'bg-brand/20 text-brand-glow shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Mensuel
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
              Catégorie
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORIES.map((cat) => {
                const config = getCategoryConfig(cat)
                const Icon = config.icon
                const isSelected = form.category === cat
                return (
                  <button
                    key={cat}
                    onClick={() => set('category', cat)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? `${config.bg} ${config.text} ${config.border} ring-1 ring-current/20`
                        : 'border-border-subtle bg-bg-elevated text-text-muted hover:text-text-secondary hover:border-border-strong'
                    }`}
                    title={config.label}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate w-full text-center text-[10px]">{config.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Paid By */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
              {form.type === 'expense' ? 'Payé par' : 'Reçu par'}
            </label>
            <div className="flex p-0.5 rounded-xl bg-bg-elevated border border-border-subtle">
              {FINAUZI_PEOPLE.map((person) => (
                <button
                  key={person.uid}
                  onClick={() => set('paidByUid', person.uid)}
                  className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                    form.paidByUid === person.uid
                      ? `${person.bg} ${person.text} shadow-sm`
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {person.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reimbursement Toggle (Expenses only) */}
          {form.type === 'expense' && (
            <div className="bg-bg-elevated border border-border-subtle rounded-xl overflow-hidden transition-all duration-300">
              <label className="flex items-center justify-between p-4 cursor-pointer">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-text-primary">Demander un remboursement</span>
                  <span className="text-xs text-text-muted mt-0.5">
                    {form.reimbursementOn ? 'FinAuzi calculera automatiquement qui doit quoi.' : 'Aucun remboursement ne sera calculé.'}
                  </span>
                </div>
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.reimbursementOn ? 'bg-brand' : 'bg-border-strong'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.reimbursementOn ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
                {/* Hidden actual checkbox to enable clicking the entire row */}
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={form.reimbursementOn}
                  onChange={(e) => set('reimbursementOn', e.target.checked)}
                />
              </label>

              {/* Reimbursement Details */}
              {form.reimbursementOn && (
                <div className="px-4 pb-4 border-t border-border-subtle/50 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">{reimbPerson?.label} rembourse</span>
                    {form.reimbursementPct === 50 && (
                      <span className="px-2 py-0.5 bg-brand/10 text-brand-glow text-[10px] rounded-full font-bold">50/50</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={form.reimbursementPct}
                      onChange={(e) => set('reimbursementPct', Number(e.target.value))}
                      className="flex-1 accent-brand h-1.5 bg-border-strong rounded-full appearance-none"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={form.reimbursementPct}
                        onChange={(e) => set('reimbursementPct', Number(e.target.value))}
                        className="w-16 h-10 rounded-xl bg-bg-card border border-border-subtle px-2 text-sm tabular-nums text-center focus:border-brand outline-none"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    {[25, 50, 75, 100].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => set('reimbursementPct', pct)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${form.reimbursementPct === pct ? 'bg-brand/10 border-brand/30 text-brand-glow' : 'bg-bg-card border-border-subtle text-text-muted hover:border-text-muted'}`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>

                  <div className={`p-3 rounded-xl border flex items-start gap-2 ${form.reimbursementPct > 0 ? 'bg-brand/5 border-brand/20' : 'bg-bg-card border-border-subtle'}`}>
                    {form.reimbursementPct > 0 ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                        <p className="text-sm text-text-primary">
                          <span className="font-semibold">{reimbPerson?.label}</span> devra rembourser <span className="font-bold tabular-nums">{amountNumber > 0 ? `${reimbAmount} ${amountCurrency}` : 'le montant'}</span> à <span className="font-semibold">{payer?.label}</span>.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-text-muted">Le montant du remboursement apparaîtra ici.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs text-text-muted mb-1.5 block font-medium uppercase tracking-wider">
              Notes (optionnel)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Détails supplémentaires…"
              rows={2}
              className="w-full rounded-xl bg-bg-elevated border border-border-subtle px-3 py-2 text-sm outline-none focus:border-brand resize-none transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle">
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
              className="px-4 h-9 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-elevated border border-border-subtle hover:border-border-strong transition-colors"
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
