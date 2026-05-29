import { useState, useEffect } from 'react'
import { LogOut, Save, Download, Check, Lock } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import { updateSettings } from '../../services/settingsService.js'
import {
  getPerson,
  COLOR_PALETTE,
  getLockedColorId,
  DEFAULT_USER_COLORS,
} from '@/shared/config/people.js'
import { downloadTransactionsCsv } from '../../utils/exportCsv.js'
import { Sheet, SheetContent, SheetBody } from '@/shared/ui/sheet.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { cn } from '@/shared/lib/utils.js'

export default function SettingsDrawer({ open, onClose }) {
  const { transactions, settings, isLoading } = useAppData()
  const { currentUser, logout } = useAuth()
  const { format: formatMoney, currency } = useCurrency()
  const me = getPerson(currentUser?.uid, settings.userColors)

  const [initialCapital, setInitialCapital] = useState('')
  const [commonInitial, setCommonInitial] = useState('')
  const [safetyBuffer, setSafetyBuffer] = useState('')
  const [eurToAud, setEurToAud] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingRate, setSavingRate] = useState(false)
  const [savingColor, setSavingColor] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setInitialCapital(String(settings.initialCapitalEUR ?? 0))
      setCommonInitial(String(settings.commonInitialCapitalEUR ?? 0))
      setSafetyBuffer(String(settings.safetyBufferEUR ?? 0))
      setEurToAud(String(settings.eurToAud ?? 1.65))
    }
  }, [isLoading, settings.initialCapitalEUR, settings.commonInitialCapitalEUR, settings.safetyBufferEUR, settings.eurToAud])

  async function onSave(e) {
    e.preventDefault()
    const total = Number(initialCapital.replace(',', '.')) || 0
    const common = Number(commonInitial.replace(',', '.')) || 0
    if (common > total) {
      toast.error('Le capital commun ne peut pas dépasser le capital total.')
      return
    }
    setSaving(true)
    try {
      await updateSettings({
        initialCapitalEUR: total,
        commonInitialCapitalEUR: common,
        safetyBufferEUR: Number(safetyBuffer.replace(',', '.')) || 0,
      }, currentUser?.uid)
      toast.success('Réglages enregistrés')
    } catch (err) {
      toast.error(err.message || 'Erreur d\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  async function onPickColor(colorId) {
    if (!currentUser?.uid || savingColor) return
    const nextUserColors = { ...(settings.userColors || {}), [currentUser.uid]: colorId }
    setSavingColor(true)
    try {
      await updateSettings({ userColors: nextUserColors }, currentUser.uid)
      toast.success('Couleur mise à jour')
    } catch (err) {
      toast.error(err.message || 'Erreur')
    } finally {
      setSavingColor(false)
    }
  }

  async function onToggleCurrency() {
    const next = currency === 'EUR' ? 'AUD' : 'EUR'
    try {
      await updateSettings({ currency: next }, currentUser?.uid)
    } catch (err) {
      toast.error(err.message || 'Erreur')
    }
  }

  async function onSaveRate() {
    const value = Number(eurToAud.replace(',', '.'))
    if (!isFinite(value) || value <= 0) {
      toast.error('Taux invalide')
      return
    }
    setSavingRate(true)
    try {
      await updateSettings({ eurToAud: value }, currentUser?.uid)
      toast.success('Taux mis à jour')
    } catch (err) {
      toast.error(err.message || 'Erreur')
    } finally {
      setSavingRate(false)
    }
  }

  const lockedColorId = getLockedColorId(currentUser?.uid, settings.userColors)
  const myColorId = me?.colorId || DEFAULT_USER_COLORS[currentUser?.uid]

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" desktopSide="right" title="Réglages">
        <SheetBody className="pb-[max(env(safe-area-inset-bottom),1.5rem)]">
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

          {/* Apparence */}
          <Section title="Apparence">
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
              <p className="text-xs text-white/60 mb-3">Ta couleur d'affichage</p>
              <div className="grid grid-cols-5 gap-2">
                {COLOR_PALETTE.map((c) => {
                  const isMine = c.id === myColorId
                  const isLocked = c.id === lockedColorId && !isMine
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={isLocked || savingColor}
                      onClick={() => onPickColor(c.id)}
                      title={isLocked ? `Pris par l'autre utilisateur` : c.label}
                      className={cn(
                        'relative aspect-square rounded-xl border transition flex items-center justify-center',
                        isMine && 'border-white/40 ring-2 ring-white/20',
                        !isMine && !isLocked && 'border-white/10 hover:border-white/30 hover:scale-105 active:scale-95',
                        isLocked && 'border-white/5 opacity-40 cursor-not-allowed',
                      )}
                    >
                      <span className={cn('h-6 w-6 rounded-full', c.swatchClass)} />
                      {isMine && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-white text-black flex items-center justify-center">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                      {isLocked && (
                        <span className="absolute inset-0 flex items-center justify-center text-white/40">
                          <Lock size={12} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-white/30 mt-3">
                Une couleur prise par l'autre utilisateur est verrouillée.
              </p>
            </div>
          </Section>

          {/* Devise */}
          <Section title="Devise">
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-4">
              <div className="grid grid-cols-2 gap-1 p-1 bg-white/[0.04] rounded-xl">
                <button
                  type="button"
                  onClick={() => currency !== 'EUR' && onToggleCurrency()}
                  className={cn(
                    'py-2 rounded-lg text-sm font-medium transition',
                    currency === 'EUR' ? 'bg-white text-black' : 'text-white/40',
                  )}
                >
                  € EUR
                </button>
                <button
                  type="button"
                  onClick={() => currency !== 'AUD' && onToggleCurrency()}
                  className={cn(
                    'py-2 rounded-lg text-sm font-medium transition',
                    currency === 'AUD' ? 'bg-white text-black' : 'text-white/40',
                  )}
                >
                  $ AUD
                </button>
              </div>

              <div>
                <p className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">
                  Taux 1 € → AUD
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={eurToAud}
                    onChange={(e) => setEurToAud(e.target.value)}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={onSaveRate}
                    disabled={savingRate}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    OK
                  </button>
                </div>
                <p className="text-[11px] text-white/30 mt-1.5">
                  Les calculs internes restent en euros — la devise change seulement l'affichage.
                </p>
              </div>
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
                  Solde global de départ (perso + commun). Actuel&nbsp;: {formatMoney(settings.initialCapitalEUR)}
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
                  Part déjà sur le compte commun. Actuel&nbsp;: {formatMoney(settings.commonInitialCapitalEUR)}
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
                  Capital minimum souhaité. Actuel&nbsp;: {formatMoney(settings.safetyBufferEUR)}
                </p>
              </Field>

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
        </SheetBody>
      </SheetContent>
    </Sheet>
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
