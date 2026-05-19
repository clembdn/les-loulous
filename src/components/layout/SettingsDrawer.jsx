import { useState, useEffect } from 'react'
import { X, LogOut, Save, Download } from 'lucide-react'
import { useFinAuziData } from '../../hooks/useFinAuziData.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { updateSettings } from '../../services/settingsService.js'
import { getPerson } from '../../config/people.js'
import { downloadTransactionsCsv } from '../../utils/exportCsv.js'

function formatEUR(n) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

export default function SettingsDrawer({ open, onClose }) {
  const { transactions, settings, isLoading } = useFinAuziData()
  const { currentUser, logout } = useAuth()
  const me = getPerson(currentUser?.uid)

  const [initialCapital, setInitialCapital] = useState('')
  const [commonInitial, setCommonInitial] = useState('')
  const [safetyBuffer, setSafetyBuffer] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isLoading) {
      setInitialCapital(String(settings.initialCapitalEUR ?? 0))
      setCommonInitial(String(settings.commonInitialCapitalEUR ?? 0))
      setSafetyBuffer(String(settings.safetyBufferEUR ?? 0))
    }
  }, [isLoading, settings.initialCapitalEUR, settings.commonInitialCapitalEUR, settings.safetyBufferEUR])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  async function onSave(e) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const total = Number(initialCapital.replace(',', '.')) || 0
    const common = Number(commonInitial.replace(',', '.')) || 0
    if (common > total) {
      setError('Le capital commun ne peut pas dépasser le capital total.')
      return
    }
    setSaving(true)
    try {
      await updateSettings({
        initialCapitalEUR: total,
        commonInitialCapitalEUR: common,
        safetyBufferEUR: Number(safetyBuffer.replace(',', '.')) || 0,
      }, currentUser?.uid)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm fade-in"
        onClick={onClose}
      />
      <aside className="relative w-full sm:max-w-md h-full bg-[#0B0E13] border-l border-white/10 shadow-2xl slide-in-right flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">Réglages</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">

            {/* Account */}
            <Section title="Compte">
              <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border border-white/5 rounded-2xl">
                {me && (
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold border ${me.bgClass} ${me.textClass} ${me.borderClass}`}>
                    {me.initial}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{me?.label || 'Utilisateur'}</p>
                  <p className="text-xs text-white/40 truncate">{currentUser?.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="text-white/40 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition"
                  aria-label="Se déconnecter"
                  title="Se déconnecter"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </Section>

            {/* Capital */}
            <Section title="Capital">
              <form onSubmit={onSave} className="space-y-4">
                <Field label="Capital initial — Total">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-[11px] text-white/30 mt-1.5">
                    Solde global de départ (perso + commun). Actuel&nbsp;: {formatEUR(settings.initialCapitalEUR)}
                  </p>
                </Field>
                <Field label="Dont compte commun">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={commonInitial}
                    onChange={(e) => setCommonInitial(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-[11px] text-white/30 mt-1.5">
                    Part déjà sur le compte commun. Actuel&nbsp;: {formatEUR(settings.commonInitialCapitalEUR)}
                  </p>
                </Field>
                <Field label="Seuil de sécurité">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={safetyBuffer}
                    onChange={(e) => setSafetyBuffer(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-[11px] text-white/30 mt-1.5">
                    Capital minimum souhaité. Actuel&nbsp;: {formatEUR(settings.safetyBufferEUR)}
                  </p>
                </Field>

                {error && <p className="text-xs text-red-400">{error}</p>}
                {saved && <p className="text-xs text-emerald-400">Enregistré ✓</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-medium text-sm disabled:opacity-50 hover:bg-white/90 transition"
                >
                  <Save size={14} />
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </form>
            </Section>

            {/* Data */}
            <Section title="Données">
              <button
                type="button"
                onClick={() => downloadTransactionsCsv(transactions)}
                disabled={transactions.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm font-medium hover:bg-white/[0.06] hover:border-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={14} />
                Exporter en CSV ({transactions.length})
              </button>
              <p className="text-[11px] text-white/30 mt-2 px-1">
                Téléchargement local, format Excel-friendly (séparateur point-virgule).
              </p>
            </Section>

            <p className="text-center text-[10px] uppercase tracking-[0.2em] text-white/20 mt-12">
              FinAuzi · v1.0
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}

const inputClass = 'w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white tabular focus:outline-none focus:border-white/30 transition'

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 mb-3 px-1">{title}</p>
      {children}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">{label}</span>
      {children}
    </label>
  )
}
