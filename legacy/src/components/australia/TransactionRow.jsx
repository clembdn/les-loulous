import { Pencil, Trash2, Pause, Play, Calendar } from 'lucide-react'
import CategoryBadge from './CategoryBadge.jsx'
import { CLEMENT_UID, LISE_UID, getPersonWithColor } from '../../config/people.js'

export default function TransactionRow({ transaction, onEdit, onDelete, onTogglePause, format, settings }) {
  const { title, amountEUR, type, recurrence, category, date, endDate, isActive, notes } = transaction
  const isIncome = type === 'income'
  const isRecurring = recurrence === 'monthly'
  const isPaused = !isActive

  const txPayer = getPersonWithColor(transaction.paidByUid || transaction.personUid, settings?.personColors)
  let reimbText = ''

  if (isIncome) {
    reimbText = `Reçu par ${txPayer?.shortLabel || 'Inconnu'}`
  } else {
    let clementShare = 0
    let liseShare = 0
    if (Array.isArray(transaction.splits) && transaction.splits.length > 0) {
      clementShare = transaction.splits.find(s => s.personUid === CLEMENT_UID)?.percentage || 0
      liseShare = transaction.splits.find(s => s.personUid === LISE_UID)?.percentage || 0
    } else {
      // fallback
      if (txPayer?.uid === CLEMENT_UID) clementShare = 100
      else liseShare = 100
    }

    if (clementShare > 0 && liseShare > 0) {
      if (txPayer?.uid === CLEMENT_UID) {
        reimbText = `${txPayer?.shortLabel} a payé · Lise rembourse ${Math.round(liseShare)}%`
      } else if (txPayer?.uid === LISE_UID) {
        reimbText = `${txPayer?.shortLabel} a payé · Clément rembourse ${Math.round(clementShare)}%`
      }
    } else {
      reimbText = `${txPayer?.shortLabel || 'Inconnu'} a payé · Pas de remboursement`
    }
  }

  const formattedDate = new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const formattedEndDate = endDate
    ? new Date(endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 ${
        isPaused
          ? 'bg-bg-elevated/50 border-border-subtle/50 opacity-60'
          : 'bg-bg-elevated border-border-subtle hover:border-border-strong hover:shadow-card'
      }`}
    >
      {/* Category icon */}
      <CategoryBadge category={category} />

      {/* Title + date info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${isPaused ? 'line-through text-text-muted' : ''}`}>
            {title}
          </p>
          {isPaused && (
            <span className="pill bg-warning/10 text-warning border border-warning/20 text-[10px] py-0">
              En pause
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-text-muted truncate max-w-[200px]">
            {reimbText}
          </span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-muted flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
            {formattedEndDate && (
              <span> → {formattedEndDate}</span>
            )}
          </span>
          {notes && (
            <span className="text-[10px] text-text-muted truncate max-w-[150px]" title={notes}>
              · {notes}
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
        isIncome ? 'text-success' : 'text-danger'
      }`}>
        {isIncome ? '+' : '−'}{format(amountEUR)}
        {isRecurring && <span className="text-text-muted font-normal">/mois</span>}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isRecurring && onTogglePause && (
          <button
            onClick={() => onTogglePause(transaction.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              isPaused
                ? 'text-success/70 hover:text-success hover:bg-success/10'
                : 'text-warning/70 hover:text-warning hover:bg-warning/10'
            }`}
            title={isPaused ? 'Reprendre' : 'Mettre en pause'}
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          onClick={() => onEdit(transaction)}
          className="p-1.5 rounded-lg text-text-muted hover:text-brand-glow hover:bg-brand/10 transition-colors"
          title="Modifier"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(transaction.id)}
          className="p-1.5 rounded-lg text-danger/50 hover:text-danger hover:bg-danger/10 transition-colors"
          title="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
