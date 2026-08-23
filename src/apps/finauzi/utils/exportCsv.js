import { getCategory } from '../config/categories.js'
import { getAccount, getSplitLabel } from '../config/accounts.js'
import { getTransferKind } from './ledger.js'
import { RECURRENCES_BY_ID } from './recurrence.js'
import { todayISO } from './dates.js'

const HEADERS = [
  'Date',
  'Type',
  'Compte débité',
  'Compte crédité',
  'À la charge de',
  'Catégorie',
  'Titre',
  'Montant',
  'Devise',
  'Montant reçu',
  'Récurrence',
  'Fin',
  'Remboursement',
  'Notes',
  'Actif',
]

const KIND_LABEL = { income: 'Revenu', expense: 'Dépense', transfer: 'Virement' }

function accountLabel(id) {
  return id ? getAccount(id).label : ''
}

function money(value) {
  if (value == null) return ''
  return Number(value).toFixed(2).replace('.', ',')
}

function escapeCsvCell(value) {
  if (value == null) return ''
  const str = String(value)
  if (/[",;\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsv(row) {
  return row.map(escapeCsvCell).join(';')
}

export function buildTransactionsCsv(transactions) {
  const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date))
  const lines = [rowToCsv(HEADERS)]
  for (const tx of sorted) {
    const cat = getCategory(tx.category)
    lines.push(
      rowToCsv([
        tx.date ? tx.date.slice(0, 10) : '',
        KIND_LABEL[tx.kind] || tx.kind,
        accountLabel(tx.fromAccount),
        accountLabel(tx.toAccount),
        tx.kind === 'transfer' ? '' : getSplitLabel(tx.split),
        cat.label,
        tx.title || '',
        money(tx.amount),
        tx.currency || 'EUR',
        money(tx.amountReceived),
        RECURRENCES_BY_ID[tx.recurrence]?.label || tx.recurrence,
        tx.endDate ? tx.endDate.slice(0, 10) : '',
        getTransferKind(tx)?.label || '',
        tx.notes || '',
        tx.isActive === false ? 'Non' : 'Oui',
      ]),
    )
  }
  return lines.join('\n')
}

export function downloadCsv(filename, content) {
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadTransactionsCsv(transactions) {
  const csv = buildTransactionsCsv(transactions)
  const date = todayISO()
  downloadCsv(`finauzi-transactions-${date}.csv`, csv)
}
