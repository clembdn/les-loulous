import { useMemo, useState } from 'react'
import { Plus, Search, Users, User } from 'lucide-react'
import { useFinAuziData } from '../hooks/useFinAuziData.js'
import { useAuth } from '../context/AuthContext.jsx'
import { AUTHORIZED_UIDS, getPerson } from '../config/people.js'
import { CATEGORIES, getCategory } from '../config/categories.js'
import TransactionRow from '../components/transactions/TransactionRow.jsx'
import TransactionFormModal from '../components/transactions/TransactionFormModal.jsx'

function groupByMonth(txs) {
  const groups = new Map()
  for (const tx of txs) {
    const d = new Date(tx.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!groups.has(key)) groups.set(key, { label, items: [] })
    groups.get(key).items.push(tx)
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, group]) => ({ key, ...group }))
}

export default function TransactionsView() {
  const { transactions, isLoading } = useFinAuziData()
  const { currentUser } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [personFilter, setPersonFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = transactions.filter((tx) => tx.isActive !== false)
    if (personFilter !== 'all') list = list.filter((tx) => tx.personUid === personFilter)
    if (typeFilter !== 'all') list = list.filter((tx) => tx.type === typeFilter)
    if (accountFilter !== 'all') list = list.filter((tx) => (tx.account || 'personal') === accountFilter)
    if (categoryFilter !== 'all') list = list.filter((tx) => (tx.category || 'other-expense') === categoryFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((tx) =>
        tx.title?.toLowerCase().includes(q) ||
        tx.notes?.toLowerCase().includes(q) ||
        getCategory(tx.category).label.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, personFilter, typeFilter, accountFilter, categoryFilter, search])

  const groups = useMemo(() => groupByMonth(filtered), [filtered])

  const visibleCategories = useMemo(() => {
    let list = transactions.filter((tx) => tx.isActive !== false)
    if (personFilter !== 'all') list = list.filter((tx) => tx.personUid === personFilter)
    if (typeFilter !== 'all') list = list.filter((tx) => tx.type === typeFilter)
    if (accountFilter !== 'all') list = list.filter((tx) => (tx.account || 'personal') === accountFilter)
    const ids = new Set(list.map((tx) => tx.category || 'other-expense'))
    return CATEGORIES.filter((c) => ids.has(c.id))
  }, [transactions, personFilter, typeFilter, accountFilter])

  return (
    <div className="fade-in pb-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Transactions</h1>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition"
            aria-label="Ajouter"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition"
          />
        </div>

        {/* Person filter */}
        <div className="flex items-center gap-1 mb-2 overflow-x-auto -mx-1 px-1">
          <FilterPill active={personFilter === 'all'} onClick={() => setPersonFilter('all')}>
            Tous
          </FilterPill>
          {AUTHORIZED_UIDS.map((uid) => {
            const p = getPerson(uid)
            return (
              <FilterPill
                key={uid}
                active={personFilter === uid}
                onClick={() => setPersonFilter(uid)}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${p.dotClass} mr-1.5`} />
                {p.label}
              </FilterPill>
            )
          })}
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 mb-2 overflow-x-auto -mx-1 px-1">
          <FilterPill active={typeFilter === 'all'} onClick={() => { setTypeFilter('all'); setCategoryFilter('all') }}>
            Tous
          </FilterPill>
          <FilterPill
            active={typeFilter === 'income'}
            onClick={() => { setTypeFilter('income'); setCategoryFilter('all') }}
            accentClass="bg-emerald-500/15 text-emerald-400"
          >
            Revenus
          </FilterPill>
          <FilterPill
            active={typeFilter === 'expense'}
            onClick={() => { setTypeFilter('expense'); setCategoryFilter('all') }}
            accentClass="bg-red-500/15 text-red-400"
          >
            Dépenses
          </FilterPill>
        </div>

        {/* Account filter */}
        <div className="flex items-center gap-1 mb-2 overflow-x-auto -mx-1 px-1">
          <FilterPill active={accountFilter === 'all'} onClick={() => setAccountFilter('all')}>
            Tous comptes
          </FilterPill>
          <FilterPill
            active={accountFilter === 'common'}
            onClick={() => setAccountFilter('common')}
            accentClass="bg-sky-500/15 text-sky-400"
          >
            <Users size={11} strokeWidth={2.2} className="mr-1.5" />
            Commun
          </FilterPill>
          <FilterPill
            active={accountFilter === 'personal'}
            onClick={() => setAccountFilter('personal')}
          >
            <User size={11} strokeWidth={2.2} className="mr-1.5" />
            Personnel
          </FilterPill>
        </div>

        {/* Category filter (horizontal scroll) */}
        {visibleCategories.length > 0 && (
          <div className="flex items-center gap-1 mb-4 overflow-x-auto -mx-1 px-1 pb-1">
            <FilterPill active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
              Toutes
            </FilterPill>
            {visibleCategories.map((cat) => {
              const Icon = cat.icon
              const active = categoryFilter === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`inline-flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    active
                      ? `${cat.bgClass} ${cat.textClass} ${cat.borderClass}`
                      : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={12} strokeWidth={2.2} />
                  {cat.label}
                </button>
              )
            })}
          </div>
        )}

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <span className="h-5 w-5 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-white/40">Aucune transaction.</p>
            <button
              onClick={() => { setEditing(null); setShowForm(true) }}
              className="mt-4 text-xs text-white/60 hover:text-white underline-offset-4 hover:underline transition"
            >
              Ajouter la première
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 mb-1 px-3">
                  {g.label}
                </p>
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-1">
                  {g.items.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      onClick={() => { setEditing(tx); setShowForm(true) }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <TransactionFormModal
          onClose={() => { setShowForm(false); setEditing(null) }}
          currentUid={currentUser?.uid}
          existing={editing}
        />
      )}
    </div>
  )
}

function FilterPill({ active, onClick, accentClass, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
        active
          ? accentClass || 'bg-white text-black'
          : 'text-white/50 hover:text-white hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}
