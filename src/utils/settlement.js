import { isTransactionActiveForMonth, isOneOffInMonth, getAllocatedAmountForPerson } from './cashflow.js'
import { CLEMENT_UID, LISE_UID } from '../config/people.js'

/**
 * Calculates settlement between two users for the current month.
 * Output:
 * type SettlementResult = {
 *   payerUid: string | null;
 *   receiverUid: string | null;
 *   amountEUR: number;
 *   isBalanced: boolean;
 *   balancesByPerson: Record<string, number>;
 *   paidTotalsByPerson: Record<string, number>;
 *   fairShareByPerson: Record<string, number>;
 * };
 */
export function calculateCurrentMonthSettlement(transactions) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const personUids = [CLEMENT_UID, LISE_UID]

  const balancesByPerson = { [CLEMENT_UID]: 0, [LISE_UID]: 0 }
  const paidTotalsByPerson = { [CLEMENT_UID]: 0, [LISE_UID]: 0 }
  const fairShareByPerson = { [CLEMENT_UID]: 0, [LISE_UID]: 0 }

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue // Ignore income

    // Current month check
    if (tx.recurrence === 'monthly' && !isTransactionActiveForMonth(tx, year, month)) continue
    if (tx.recurrence === 'one-off' && !isOneOffInMonth(tx, year, month)) continue

    const amount = Number(tx.amountEUR) || 0
    const payerUid = tx.paidByUid

    if (!payerUid || !paidTotalsByPerson.hasOwnProperty(payerUid)) continue

    paidTotalsByPerson[payerUid] += amount

    // Calculate fair shares based on splits
    for (const uid of personUids) {
      const share = getAllocatedAmountForPerson(tx, uid)
      fairShareByPerson[uid] += share
    }
  }

  // Balances
  for (const uid of personUids) {
    // How much they paid minus how much they *should* have paid (fair share)
    balancesByPerson[uid] = paidTotalsByPerson[uid] - fairShareByPerson[uid]
  }

  let payerUid = null
  let receiverUid = null
  let amountEUR = 0
  let isBalanced = true

  const uids = Object.keys(balancesByPerson)
  if (uids.length === 2) {
    const uid1 = uids[0]
    const uid2 = uids[1]
    const diff = balancesByPerson[uid1]
    
    // Treat values below 0.01 as balanced
    if (Math.abs(diff) >= 0.01) {
      isBalanced = false
      amountEUR = Number(Math.abs(diff).toFixed(2))
      if (diff > 0) {
        // uid1 paid too much, so uid2 owes uid1
        receiverUid = uid1
        payerUid = uid2
      } else {
        // uid1 paid too little, so uid1 owes uid2
        receiverUid = uid2
        payerUid = uid1
      }
    }
  }

  return {
    payerUid,
    receiverUid,
    amountEUR,
    isBalanced,
    balancesByPerson,
    paidTotalsByPerson,
    fairShareByPerson,
  }
}
