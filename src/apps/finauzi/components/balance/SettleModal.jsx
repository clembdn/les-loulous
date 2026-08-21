import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { getPerson } from '@/shared/config/people.js'
import { createDebtSettlement, createContribution } from '../../services/transactionService.js'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import { getAccount, JOINT_ACCOUNT_ID } from '../../config/accounts.js'
import { convert } from '../../utils/money.js'
import Modal from '@/shared/ui/Modal.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { todayISO } from '../../utils/dates.js'


// Deux règlements possibles, deux destinations différentes :
//   mode="debt"         — un perso vers l'autre perso
//   mode="contribution" — un perso vers le compte joint
export default function SettleModal({ mode, fromUid, toUid, suggestedEUR, onClose, currentUid }) {
  const { settings } = useAppData()
  const { rate } = useCurrency()
  const [amount, setAmount] = useState(
    suggestedEUR ? String(Math.round(suggestedEUR * 100) / 100) : '',
  )
  const [received, setReceived] = useState('')
  const [date, setDate] = useState(todayISO())

  const isContribution = mode === 'contribution'
  const from = getPerson(fromUid, settings.userColors)
  const to = isContribution ? null : getPerson(toUid, settings.userColors)
  const jointAccount = getAccount(JOINT_ACCOUNT_ID)

  const parsed = parseFloat(String(amount).replace(',', '.'))
  const validAmount = isFinite(parsed) && parsed > 0
  const parsedReceived = parseFloat(String(received).replace(',', '.'))
  const estimatedAUD = validAmount ? convert(parsed, 'EUR', 'AUD', rate) : null

  function onSubmit(e) {
    e.preventDefault()
    if (!validAmount) return toast.error('Montant invalide')

    const action = isContribution
      ? createContribution({
        fromUid,
        amountEUR: parsed,
        amountReceivedAUD: isFinite(parsedReceived) && parsedReceived > 0 ? parsedReceived : estimatedAUD,
        date,
      }, currentUid)
      : createDebtSettlement({ fromUid, toUid, amountEUR: parsed, date }, currentUid)

    action.catch((err) => { console.error(err); toast.error(err.message || 'Erreur de synchronisation') })
    toast.success(isContribution ? 'Apport enregistré' : 'Remboursement enregistré')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={isContribution ? 'Apport au compte joint' : 'Régler la dette'}>
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
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${to.textClass}`}>
              <span className={`h-2 w-2 rounded-full ${to.dotClass}`} />
              {to.label}
            </span>
          )}
        </div>

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
        </Field>

        {isContribution && (
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
          {isContribution
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

const inputClass = 'w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition'

function Field({ label, children }) {
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wider text-white/40 mb-1.5">{label}</span>
      {children}
    </div>
  )
}
