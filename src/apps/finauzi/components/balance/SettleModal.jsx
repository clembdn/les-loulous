import { useState } from 'react'
import { ArrowRight, AlertTriangle, RefreshCw, ArrowLeftRight } from 'lucide-react'
import { getPerson } from '@/shared/config/people.js'
import { createSettlement, createContribution } from '../../services/transactionService.js'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import { useExchangeRate } from '../../hooks/useExchangeRate.js'
import {
  getAccount, getAccountNetwork, isSameNetwork,
  JOINT_ACCOUNT_ID, PERSONAL_ACCOUNT_ID,
} from '../../config/accounts.js'
import { convert } from '../../utils/money.js'
import Modal from '@/shared/ui/Modal.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { todayISO } from '../../utils/dates.js'

const SYMBOL = { EUR: '€', AUD: 'A$' }

// Deux gestes, et un seul répond à « qui doit quoi » :
//
//   mode="settle"       un perso vers l'autre — solde le compte entre eux.
//                       C'est le seul montant à regarder : il englobe déjà
//                       l'écart d'apports ET les avances (voir settlement.js).
//   mode="contribution" un perso vers le joint — remplit le pot. Ça ne règle
//                       rien entre eux, ça donne de quoi payer les charges.
//
// Le montant se saisit en € ou en A$ : c'est le même compte perso, mais pas
// le même argent selon qu'on vire depuis la France ou depuis l'Australie.
export default function SettleModal({
  mode,
  fromUid,
  toUid,
  suggestedEUR,
  onClose,
  currentUid,
}) {
  const { settings } = useAppData()
  const { rate: settingsRate } = useCurrency()
  const live = useExchangeRate(settingsRate)

  const isContribution = mode === 'contribution'

  const [currency, setCurrency] = useState('EUR')
  const [amount, setAmount] = useState(round(suggestedEUR))
  const [received, setReceived] = useState('')
  const [date, setDate] = useState(todayISO())
  const [rateInput, setRateInput] = useState('')

  const from = getPerson(fromUid, settings.userColors)
  const to = toUid ? getPerson(toUid, settings.userColors) : null
  const jointAccount = getAccount(JOINT_ACCOUNT_ID)

  const fromAccountId = PERSONAL_ACCOUNT_ID[fromUid]
  const toAccountId = isContribution ? JOINT_ACCOUNT_ID : PERSONAL_ACCOUNT_ID[toUid]

  const parsed = parseFloat(String(amount).replace(',', '.'))
  const validAmount = isFinite(parsed) && parsed > 0
  const parsedReceived = parseFloat(String(received).replace(',', '.'))

  // Taux retenu : celui tapé à la main s'il y en a un, sinon celui du jour.
  const parsedRate = parseFloat(String(rateInput).replace(',', '.'))
  const isManualRate = isFinite(parsedRate) && parsedRate > 0
  const effectiveRate = isManualRate ? parsedRate : live.rate

  const otherCurrency = currency === 'EUR' ? 'AUD' : 'EUR'
  const estimatedOther = validAmount ? convert(parsed, currency, otherCurrency, effectiveRate) : null

  // Le pot est en A$ : y virer des euros passe par un change et des frais.
  // Y virer des dollars déjà sur place ne coûte rien.
  const jointCurrency = jointAccount.currency
  const crossesCurrency = isContribution && currency !== jointCurrency
  const crossesNetwork = !isContribution
    ? false
    : !!fromAccountId && !isSameNetwork(fromAccountId, toAccountId) && currency === 'EUR'

  function onSubmit(e) {
    e.preventDefault()
    if (!validAmount) return toast.error('Montant invalide')

    const common = { amount: parsed, currency, date, rate: effectiveRate }

    const action = isContribution
      ? createContribution({
        ...common,
        fromUid,
        // Ce qui atterrit vraiment sur le compte australien, frais inclus.
        amountReceived: crossesCurrency
          ? (isFinite(parsedReceived) && parsedReceived > 0 ? parsedReceived : estimatedOther)
          : null,
      }, currentUid)
      : createSettlement({ ...common, fromUid, toUid }, currentUid)

    action.catch((err) => { console.error(err); toast.error(err.message || 'Erreur de synchronisation') })
    toast.success(isContribution ? 'Apport enregistré' : 'Règlement enregistré')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={isContribution ? 'Alimenter le compte joint' : 'Régler le solde'}>
      <form onSubmit={onSubmit} className="space-y-4">

        {/* Trajet de l'argent */}
        <div className="flex items-center justify-center gap-3 py-3 bg-white/[0.03] rounded-xl">
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${from.textClass}`}>
            <span className={`h-2 w-2 rounded-full ${from.dotClass}`} />
            {from.label}
          </span>
          <ArrowRight size={14} className="text-white/25" />
          {isContribution ? (
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${jointAccount.textClass}`}>
              <span className={`h-2 w-2 rounded-full ${jointAccount.dotClass}`} />
              {jointAccount.label}
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${to?.textClass}`}>
              <span className={`h-2 w-2 rounded-full ${to?.dotClass}`} />
              {to?.label}
            </span>
          )}
        </div>

        {/* Montant, avec bascule de devise */}
        <Field label="Montant">
          <div className="relative">
            <span className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-base font-semibold text-white/50 border-r border-white/10 pointer-events-none">
              {SYMBOL[currency]}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className={`${inputClass} pl-14 pr-20 text-lg tabular`}
              autoFocus
            />
            <button
              type="button"
              onClick={() => { setCurrency(otherCurrency); setReceived('') }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white hover:bg-white/[0.06] transition"
              aria-label={`Saisir en ${otherCurrency} plutôt qu'en ${currency}`}
              title={`Basculer en ${otherCurrency}`}
            >
              <ArrowLeftRight size={12} strokeWidth={2.2} />
              {otherCurrency}
            </button>
          </div>
          {validAmount && estimatedOther != null && (
            <p className="text-[11px] text-white/35 mt-1.5">
              ≈ {estimatedOther.toFixed(2).replace('.', ',')} {SYMBOL[otherCurrency]} au taux du jour
            </p>
          )}
        </Field>

        {/* Le seul avertissement qui compte : ce virement va coûter des frais. */}
        {crossesNetwork && (
          <div className="flex gap-2.5 items-start px-3 py-2.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/20">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-amber-200/80">
              Virer des euros du réseau {getAccountNetwork(fromAccountId).label} vers
              le réseau {getAccountNetwork(toAccountId).label} coûte des frais et un change.
              Si l'argent est déjà en Australie, bascule le montant en A$.
            </p>
          </div>
        )}

        {/* Taux : n'a d'effet que si le virement change de devise. */}
        {crossesCurrency && (
          <Field label="Taux EUR → AUD">
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder={live.rate.toFixed(4).replace('.', ',')}
                className={`${inputClass} pr-24 tabular`}
              />
              <button
                type="button"
                onClick={() => { setRateInput(''); live.refresh({ force: true }) }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition"
              >
                <RefreshCw size={11} className={live.isLoading ? 'animate-spin' : ''} />
                Taux du jour
              </button>
            </div>
            <p className="text-[11px] text-white/35 mt-1.5">
              {rateSourceLabel(live, isManualRate)}
            </p>
          </Field>
        )}

        {crossesCurrency && (
          <Field label={`Reçu en ${jointCurrency} (optionnel)`}>
            <div className="relative">
              <span className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-base font-semibold text-white/50 border-r border-white/10 pointer-events-none">
                {SYMBOL[jointCurrency]}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                placeholder={estimatedOther != null ? estimatedOther.toFixed(2).replace('.', ',') : '0,00'}
                className={`${inputClass} pl-14 text-lg tabular`}
              />
            </div>
            <p className="text-[11px] text-white/35 mt-1.5">
              Le montant réellement crédité sur le compte australien, frais inclus.
            </p>
          </Field>
        )}

        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <p className="text-[11px] text-white/35">
          {isContribution
            ? 'Cet apport remplit le pot. Il compte aussi dans le solde entre vous : mettre plus que l\'autre, c\'est prendre de l\'avance.'
            : 'Ce virement solde tout d\'un coup — l\'écart d\'apports comme les avances.'}
        </p>

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition"
        >
          Enregistrer
        </button>
      </form>
    </Modal>
  )
}

// Un montant proposé, arrondi au centime et prêt à être tapé dans un champ.
function round(value) {
  const n = Number(value)
  return isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : ''
}

function rateSourceLabel(live, isManual) {
  if (isManual) return 'Taux saisi à la main — c\'est lui qui sera enregistré.'
  if (live.isFallback) return 'Taux de référence de l\'app : le taux du jour n\'a pas pu être récupéré.'
  if (live.isStale) return 'Dernier taux connu (hors ligne). Modifiable à la main.'
  if (live.date) return `Taux BCE du ${live.date}, via Frankfurter. Modifiable à la main.`
  return 'Taux du jour. Modifiable à la main.'
}

const inputClass = 'w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition'

function Field({ label, children }) {
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">{label}</span>
      {children}
    </div>
  )
}
