import { useState } from 'react'
import { ArrowRight, AlertTriangle, RefreshCw, Check } from 'lucide-react'
import { getPerson } from '@/shared/config/people.js'
import {
  createDebtSettlement,
  createContribution,
  createContributionRebalance,
} from '../../services/transactionService.js'
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


// Trois règlements possibles, et surtout deux façons de rattraper un retard
// d'apports — pour des montants différents :
//
//   mode="debt"                    un perso vers l'autre, solde la dette
//   mode="contribution" · direct   un perso vers l'autre, MOITIÉ de l'écart,
//                                  virement France→France gratuit
//   mode="contribution" · pot      un perso vers le joint, TOUT l'écart,
//                                  virement international avec frais
//
// Le chemin direct est proposé par défaut : il coûte moins cher et referme
// l'écart aussi bien. Le chemin « au pot » reste là pour le cas où le pot a
// vraiment besoin d'être réalimenté.
export default function SettleModal({
  mode,
  fromUid,
  toUid,
  suggestedEUR,
  suggestedDirectEUR,
  onClose,
  currentUid,
}) {
  const { settings } = useAppData()
  const { rate: settingsRate } = useCurrency()
  const live = useExchangeRate(settingsRate)

  const isContribution = mode === 'contribution'
  // Un rééquilibrage direct n'a de sens que si on sait à qui virer.
  const canGoDirect = isContribution && !!toUid

  const [path, setPath] = useState(canGoDirect ? 'direct' : 'pot')
  const isDirect = isContribution && path === 'direct'
  const isPot = isContribution && path === 'pot'

  const defaultAmount = isContribution
    ? (canGoDirect ? suggestedDirectEUR : suggestedEUR)
    : suggestedEUR

  const [amount, setAmount] = useState(round(defaultAmount))
  const [received, setReceived] = useState('')
  const [date, setDate] = useState(todayISO())
  const [rateInput, setRateInput] = useState('')

  function selectPath(next) {
    setPath(next)
    // Le montant juste n'est pas le même selon le chemin : on repropose
    // celui du chemin choisi plutôt que de laisser un chiffre trompeur.
    setAmount(round(next === 'direct' ? suggestedDirectEUR : suggestedEUR))
    setReceived('')
  }

  const from = getPerson(fromUid, settings.userColors)
  const to = toUid ? getPerson(toUid, settings.userColors) : null
  const jointAccount = getAccount(JOINT_ACCOUNT_ID)

  const fromAccountId = PERSONAL_ACCOUNT_ID[fromUid]
  const toAccountId = isPot ? JOINT_ACCOUNT_ID : PERSONAL_ACCOUNT_ID[toUid]
  const crossesNetwork = fromAccountId && toAccountId && !isSameNetwork(fromAccountId, toAccountId)

  const parsed = parseFloat(String(amount).replace(',', '.'))
  const validAmount = isFinite(parsed) && parsed > 0
  const parsedReceived = parseFloat(String(received).replace(',', '.'))

  // Taux retenu : celui tapé à la main s'il y en a un, sinon celui du jour.
  const parsedRate = parseFloat(String(rateInput).replace(',', '.'))
  const isManualRate = isFinite(parsedRate) && parsedRate > 0
  const effectiveRate = isManualRate ? parsedRate : live.rate
  const estimatedAUD = validAmount ? convert(parsed, 'EUR', 'AUD', effectiveRate) : null

  function onSubmit(e) {
    e.preventDefault()
    if (!validAmount) return toast.error('Montant invalide')

    const common = { amountEUR: parsed, date, rate: effectiveRate }

    let action
    if (isPot) {
      action = createContribution({
        ...common,
        fromUid,
        amountReceivedAUD: isFinite(parsedReceived) && parsedReceived > 0 ? parsedReceived : estimatedAUD,
      }, currentUid)
    } else if (isDirect) {
      action = createContributionRebalance({ ...common, fromUid, toUid }, currentUid)
    } else {
      action = createDebtSettlement({ ...common, fromUid, toUid }, currentUid)
    }

    action.catch((err) => { console.error(err); toast.error(err.message || 'Erreur de synchronisation') })
    toast.success(isContribution ? 'Rééquilibrage enregistré' : 'Remboursement enregistré')
    onClose()
  }

  const title = isContribution ? 'Rééquilibrer les apports' : 'Régler la dette'

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={onSubmit} className="space-y-4">

        {/* Choix du chemin — seulement quand il y en a deux. */}
        {canGoDirect && (
          <div className="grid grid-cols-2 gap-2">
            <PathCard
              active={isDirect}
              onClick={() => selectPath('direct')}
              label={`Virer à ${to?.label}`}
              hint="France → France"
              amount={suggestedDirectEUR}
              badge="Gratuit"
              badgeClass="bg-emerald-500/15 text-emerald-400"
            />
            <PathCard
              active={isPot}
              onClick={() => selectPath('pot')}
              label="Verser au pot"
              hint="France → Australie"
              amount={suggestedEUR}
              badge="Frais + change"
              badgeClass="bg-amber-500/15 text-amber-400"
            />
          </div>
        )}

        {/* Trajet de l'argent */}
        <div className="flex items-center justify-center gap-3 py-3 bg-white/[0.03] rounded-xl">
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${from.textClass}`}>
            <span className={`h-2 w-2 rounded-full ${from.dotClass}`} />
            {from.label}
          </span>
          <ArrowRight size={14} className="text-white/25" />
          {isPot ? (
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

        {/* Le seul avertissement qui compte : ce virement va coûter des frais. */}
        {crossesNetwork && (
          <div className="flex gap-2.5 items-start px-3 py-2.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/20">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-amber-200/80">
              Ce virement quitte le réseau {getAccountNetwork(fromAccountId).label} pour
              le réseau {getAccountNetwork(toAccountId).label} : frais de transfert et change.
              {canGoDirect && ' Le rééquilibrage France → France, lui, est gratuit.'}
            </p>
          </div>
        )}

        <Field label="Montant envoyé en EUR">
          <div className="relative">
            <span className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-base font-semibold text-white/50 border-r border-white/10 pointer-events-none">
              €
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className={`${inputClass} pl-14 text-lg tabular`}
              autoFocus
            />
          </div>
          {isContribution && validAmount && (
            <p className="text-[11px] text-white/35 mt-1.5">
              {isDirect
                ? 'Un virement direct referme l\'écart de deux fois son montant : la moitié suffit.'
                : 'Au pot, il faut verser tout l\'écart pour égaliser les apports.'}
            </p>
          )}
        </Field>

        {/* Taux : n'a d'effet que si le virement change de devise. */}
        {isPot && (
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

        {isPot && (
          <Field label="Reçu en AUD (optionnel)">
            <div className="relative">
              <span className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-base font-semibold text-white/50 border-r border-white/10 pointer-events-none">
                A$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                placeholder={estimatedAUD != null ? estimatedAUD.toFixed(2).replace('.', ',') : '0,00'}
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
          {isDirect
            ? 'Ce virement compte dans l\'équilibre des apports, pas dans la balance des dettes.'
            : isPot
              ? 'Cet apport compte dans l\'équilibre des versements au pot commun.'
              : 'Ce virement est marqué comme remboursement : il solde la dette sans compter comme un apport.'}
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

function PathCard({ active, onClick, label, hint, amount, badge, badgeClass }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-3 py-2.5 rounded-xl border transition ${
        active
          ? 'bg-white/[0.07] border-white/25'
          : 'bg-white/[0.02] border-white/10 hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-xs font-medium text-white leading-tight">{label}</span>
        {active && <Check size={13} className="text-white/70 shrink-0" />}
      </div>
      <span className="block text-[10px] text-white/35 mt-0.5">{hint}</span>
      <span className="block text-sm font-semibold text-white tabular mt-1.5">
        {Number(amount) > 0 ? `${(Math.round(Number(amount) * 100) / 100).toFixed(2).replace('.', ',')} €` : '—'}
      </span>
      <span className={`inline-block mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide ${badgeClass}`}>
        {badge}
      </span>
    </button>
  )
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
