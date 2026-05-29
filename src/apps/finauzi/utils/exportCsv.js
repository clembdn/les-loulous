import { getCategory } from '../config/categories.js'
import { getPersonLabel } from '@/shared/config/people.js'

const HEADERS = [
  'Date',
  'Type',
  'Compte',
  'Catégorie',
  'Titre',
  'Montant EUR',
  'Récurrence',
  'Fin',
  'Payé par',
  'Notes',
  'Actif',
]

const TYPE_LABEL = { income: 'Revenu', expense: 'Dépense' }
const ACCOUNT_LABEL = { common: 'Commun', personal: 'Personnel' }
const RECURRENCE_LABEL = { 'one-off': 'Ponctuelle', monthly: 'Mensuelle', weekly: 'Hebdo' }

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
        TYPE_LABEL[tx.type] || tx.type,
        ACCOUNT_LABEL[tx.account] || 'Personnel',
        cat.label,
        tx.title || '',
        Number(tx.amountEUR || 0).toFixed(2).replace('.', ','),
        RECURRENCE_LABEL[tx.recurrence] || tx.recurrence,
        tx.endDate ? tx.endDate.slice(0, 10) : '',
        getPersonLabel(tx.personUid),
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
  const date = new Date().toISOString().slice(0, 10)
  downloadCsv(`finauzi-transactions-${date}.csv`, csv)
}
