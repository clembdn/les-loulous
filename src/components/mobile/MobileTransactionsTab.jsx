import { useState } from 'react'
import { Calendar, Pause, Play, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import CategoryBadge from '../australia/CategoryBadge.jsx'
import { CLEMENT_UID, LISE_UID, FINAUZI_PEOPLE, getPersonWithColor } from '../../config/people.js'
import { getCategoryConfig } from '../australia/CategoryBadge.jsx'

const CATEGORIES = [
  'housing', 'food', 'transport', 'admin', 'travel',
  'health', 'income', 'leisure', 'emergency', 'other',
]

export default function MobileTransactionsTab({ data }) {
  const [tab, setTab] = useState('monthly')
  const {
    format,
    recurringTxs,
    oneOffTxs,
    openEditModal,
    handleDelete,
    handleTogglePause,
    settings,
  } = data

  const [filterUser, setFilterUser] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [sortMode, setSortMode] = useState('date-desc')

  let list = tab === 'monthly' ? recurringTxs : oneOffTxs

  // Apply filters
  if (filterUser !== 'all') {
    list = list.filter(tx => {
      const payer = tx.paidByUid || tx.personUid
      if (payer === filterUser) return true
      if (Array.isArray(tx.splits) && tx.splits.some(s => s.personUid === filterUser && s.percentage > 0)) return true
      return false
    })
  }

  if (filterCategory !== 'all') {
    list = list.filter(tx => tx.category === filterCategory)
  }

  // Apply sorting
  list = [...list].sort((a, b) => {
    if (sortMode === 'price-desc') return b.amountEUR - a.amountEUR
    if (sortMode === 'price-asc') return a.amountEUR - b.amountEUR
    // Default 'date-desc' is already the default for oneOffTxs, for recurring it's alphabetical but we can enforce date if needed, or just let it be.
    return 0 
  })

  return (
    <div className="">
      {/* Section header */}
      <h2 className="text-lg font-semibold mb-1">Transactions</h2>
      <p className="text-xs text-text-muted mb-4">
        {recurringTxs.length + oneOffTxs.length} transaction{(recurringTxs.length + oneOffTxs.length) !== 1 ? 's' : ''} au total
      </p>

      {/* Segmented control */}
      <div className="flex p-1 rounded-2xl bg-bg-elevated border border-border-subtle mb-5">
        <button
          onClick={() => setTab('monthly')}
          className={`flex-1 h-10 rounded-xl text-sm font-medium transition-all ${
            tab === 'monthly'
              ? 'bg-brand/20 text-brand-glow shadow-sm'
              : 'text-text-muted'
          }`}
        >
          Mensuel
          {recurringTxs.length > 0 && (
            <span className="ml-1.5 text-[10px] opacity-60">{recurringTxs.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('oneoff')}
          className={`flex-1 h-10 rounded-xl text-sm font-medium transition-all ${
            tab === 'oneoff'
              ? 'bg-brand/20 text-brand-glow shadow-sm'
              : 'text-text-muted'
          }`}
        >
          Ponctuel
          {oneOffTxs.length > 0 && (
            <span className="ml-1.5 text-[10px] opacity-60">{oneOffTxs.length}</span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        <select 
          value={filterUser} 
          onChange={e => setFilterUser(e.target.value)}
          className="bg-bg-elevated border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-secondary outline-none min-w-fit"
        >
          <option value="all">Tous les utilisateurs</option>
          {FINAUZI_PEOPLE.map(p => <option key={p.uid} value={p.uid}>{p.label}</option>)}
        </select>
        
        <select 
          value={filterCategory} 
          onChange={e => setFilterCategory(e.target.value)}
          className="bg-bg-elevated border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-secondary outline-none min-w-fit"
        >
          <option value="all">Toutes les catégories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryConfig(c).label}</option>)}
        </select>
        
        <select 
          value={sortMode} 
          onChange={e => setSortMode(e.target.value)}
          className="bg-bg-elevated border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-secondary outline-none min-w-fit"
        >
          <option value="date-desc">Tri par défaut</option>
          <option value="price-desc">Prix décroissant</option>
          <option value="price-asc">Prix croissant</option>
        </select>
      </div>

      {/* Transaction list */}
      {list.length > 0 ? (
        <div className="space-y-2">
          {list.map(tx => (
            <MobileTransactionRow
              key={tx.id}
              transaction={tx}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onTogglePause={handleTogglePause}
              format={format}
              settings={settings}
            />
          ))}
        </div>
      ) : (
        <MobileEmptyState tab={tab} />
      )}
    </div>
  )
}

// ─── Mobile Transaction Row ───
function MobileTransactionRow({ transaction, onEdit, onDelete, onTogglePause, format, settings }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { title, amountEUR, type, recurrence, category, date, isActive, notes } = transaction
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
  })

  return (
    <div
      className={`relative rounded-2xl border bg-bg-card transition-all active:scale-[0.98] ${
        isPaused
          ? 'border-border-subtle/40 opacity-50'
          : 'border-border-subtle'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Category badge */}
        <CategoryBadge category={category} size="md" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-medium truncate ${isPaused ? 'line-through text-text-muted' : ''}`}>
              {title}
            </p>
            {isPaused && (
              <span className="shrink-0 px-1.5 py-0 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                Pause
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1.5">
            <span className="truncate">{reimbText}</span>
            <span>{isRecurring ? 'Mensuel' : formattedDate}</span>
            {notes ? <span>· {notes}</span> : null}
          </p>
        </div>

        {/* Amount */}
        <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
          isIncome ? 'text-emerald-400' : 'text-rose-400'
        }`}>
          {isIncome ? '+' : '−'}{format(amountEUR)}
          {isRecurring && <span className="text-text-muted font-normal text-[10px]">/m</span>}
        </span>

        {/* Actions menu */}
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          className="p-2 -mr-2 rounded-xl text-text-muted active:bg-bg-hover transition-colors"
          aria-label="Actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-3 top-full -mt-1 z-50 w-44 rounded-xl bg-bg-elevated border border-border-subtle shadow-2xl overflow-hidden animate-in">
            <button
              onClick={() => { onEdit(transaction); setMenuOpen(false) }}
              className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-text-secondary hover:bg-bg-hover active:bg-bg-hover transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </button>
            {isRecurring && onTogglePause && (
              <button
                onClick={() => { onTogglePause(transaction.id); setMenuOpen(false) }}
                className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-text-secondary hover:bg-bg-hover active:bg-bg-hover transition-colors border-t border-border-subtle/50"
              >
                {isPaused ? (
                  <><Play className="h-3.5 w-3.5 text-emerald-400" /> Reprendre</>
                ) : (
                  <><Pause className="h-3.5 w-3.5 text-amber-400" /> Mettre en pause</>
                )}
              </button>
            )}
            <button
              onClick={() => { onDelete(transaction.id); setMenuOpen(false) }}
              className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/10 transition-colors border-t border-border-subtle/50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Mobile Empty State ───
function MobileEmptyState({ tab }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4">
        <Calendar className="h-6 w-6 text-text-muted" />
      </div>
      <p className="text-sm text-text-secondary font-medium">
        {tab === 'monthly' ? 'Aucune mensualité' : 'Aucune dépense ponctuelle'}
      </p>
      <p className="text-xs text-text-muted mt-1 max-w-[240px]">
        {tab === 'monthly'
          ? 'Ajoutez votre loyer, abonnements ou revenus récurrents.'
          : 'Ajoutez votre visa, billet d\'avion ou frais d\'installation.'
        }
      </p>
    </div>
  )
}
