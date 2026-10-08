import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowUpRight, Link2Off, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { formatDayFr } from '@/shared/lib/dates.js'
import { Button } from '@/shared/ui/Button.jsx'
import { toast } from '@/shared/ui/sonner.jsx'
import { getAccount, getSplitLabel } from '@/apps/finauzi/config/accounts.js'
import { useTripData } from '../../context/TripDataContext.jsx'
import { useTripUI } from '../../context/TripUIContext.jsx'
import { subscribeToTransaction, unlinkExpense } from '../../services/expenseService.js'
import { formatPrice } from '../../utils/format.js'
import { linkStatus } from '../../utils/expense.js'
import ExpenseSheet from './ExpenseSheet.jsx'

const ROW_BUTTON = 'h-10 px-3.5 rounded-xl bg-surface-2 text-[14px] font-medium text-fg inline-flex items-center gap-1.5 hover:bg-border transition'

/**
 * La dépense d'une réservation dans FinAuzi, au bas de sa fiche :
 *  · pas encore envoyée → « Envoyer à FinAuzi » ;
 *  · envoyée → montant, compte, pour qui, date — et « Mettre à jour » si le
 *    prix de la réservation a changé depuis (jamais d'office : on a pu
 *    corriger le montant dans FinAuzi, d'après le relevé) ;
 *  · supprimée dans FinAuzi entre-temps → la renvoyer, ou oublier le lien.
 * Pas pour un invité : ce sont les comptes du couple.
 */
export default function ExpenseCard({ kind, item }) {
  const ui = useTripUI()
  const { currentUid } = useAuth()
  const { tripId } = useTripData()
  const link = item.expense
  // `undefined` : pas encore lue ; `null` : absente de FinAuzi.
  const [tx, setTx] = useState(undefined)
  const [sheet, setSheet] = useState({ open: false, update: false, nonce: 0 })

  useEffect(() => {
    setTx(undefined)
    if (!link?.txId) return undefined
    return subscribeToTransaction(link.txId, setTx, () => setTx(undefined))
  }, [link?.txId])

  if (ui.readOnly) return null
  const status = linkStatus(link, item, tx)
  const open = (update) => setSheet((s) => ({ open: true, update, nonce: s.nonce + 1 }))
  const unlink = () => {
    unlinkExpense(kind, tripId, item, currentUid).catch(() => toast.error('Impossible d’oublier le lien'))
    toast('Lien oublié · la dépense reste dans FinAuzi')
  }
  // Ce qu'on affiche : la dépense telle que FinAuzi la connaît, sinon ce qu'on a envoyé.
  const shown = tx || link

  return (
    <section className="rounded-2xl bg-surface-2/60 px-4 py-3.5">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
        <Wallet size={16} className="text-accent" /> FinAuzi
      </h3>

      {status === 'none' ? (
        <>
          <p className="mt-1 text-[14px] text-muted">
            {item.price != null ? `${formatPrice(item.price, item.currency)} à compter dans le budget du voyage.` : 'Ajouter ce que la réservation a coûté au budget.'}
          </p>
          <Button className="mt-3 w-full" onClick={() => open(false)}>
            <Wallet size={16} /> Envoyer à FinAuzi
          </Button>
        </>
      ) : status === 'missing' ? (
        <>
          <p className="mt-1 flex items-start gap-1.5 text-[14px] text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> La dépense a été supprimée dans FinAuzi.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => open(false)}>La renvoyer</Button>
            <button type="button" className={ROW_BUTTON} onClick={unlink}>Oublier</button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[15px] text-fg tabular">
            <span className="font-semibold">{formatPrice(shown.amount, shown.currency)}</span>
            {tx && <> · {getAccount(tx.fromAccount).short} · {getSplitLabel(tx.split)}</>}
            {shown.date && <span className="text-muted"> · {formatDayFr(shown.date)}</span>}
          </p>
          {!link.created && <p className="text-[13px] text-muted">Rattachée à une dépense de FinAuzi.</p>}
          {status === 'outdated' && (
            <div className="mt-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-[14px] text-amber-900">
              <p>
                Le prix de la réservation a changé
                {item.price != null ? ` (${formatPrice(item.price, item.currency)})` : ''} depuis l’envoi.
              </p>
              <Button size="sm" className="mt-2" onClick={() => open(true)} disabled={!tx}>Mettre à jour la dépense</Button>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/finauzi/transactions" className={ROW_BUTTON}>
              Voir dans FinAuzi <ArrowUpRight size={14} />
            </Link>
            <button type="button" className={ROW_BUTTON} onClick={unlink}>
              <Link2Off size={14} /> Oublier le lien
            </button>
          </div>
        </>
      )}

      <ExpenseSheet
        key={sheet.nonce}
        open={sheet.open}
        kind={kind}
        item={item}
        tx={sheet.update ? tx : null}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
      />
    </section>
  )
}
