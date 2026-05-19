import { useMemo } from 'react'
import { Plus, Search, Users, User } from 'lucide-react'
import { useFinAuziData } from '../hooks/useFinAuziData.js'
import { useUI } from '../context/UIContext.jsx'
import { AUTHORIZED_UIDS, getPerson } from '../config/people.js'
import { CATEGORIES, getCategory } from '../config/categories.js'
import TransactionRow from '../components/transactions/TransactionRow.jsx'
import { useState } from 'react'

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
  const { openForm } = useUI()
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

  const filtersProps = {
    personFilter, setPersonFilter,
    typeFilter, setTypeFilter,
    accountFilter, setAccountFilter,
    categoryFilter, setCategoryFilter,
    visibleCategories,
  }

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Transactions</h1>
          <button
            onClick={() => openForm(null)}
            className="h-10 w-10 lg:hidden rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition"
            aria-label="Ajouter"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
          {/* Desktop filter sidebar */}
          <aside className="hidden lg:block">
            <DesktopFilters {...filtersProps} />
          </aside>

          {/* Main column: search + mobile filters + list */}
          <div>
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

            {/* Mobile filters (hidden on desktop) */}
            <div className="lg:hidden">
              <MobileFilters {...filtersProps} />
            </div>

            {isLoading ? (
              <div className="py-12 flex justify-center">
                <span className="h-5 w-5 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-white/40">Aucune transaction.</p>
                <button
                  onClick={() => openForm(null)}
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
                          onClick={() => openForm(tx)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileFilters({
  personFilter, setPersonFilter,
  typeFilter, setTypeFilter,
  accountFilter, setAccountFilter,
  categoryFilter, setCategoryFilter,
  visibleCategories,
}) {
  return (
    <>
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
    </>
  )
}

function DesktopFilters({
  personFilter, setPersonFilter,
  typeFilter, setTypeFilter,
  accountFilter, setAccountFilter,
  categoryFilter, setCategoryFilter,
  visibleCategories,
}) {
  return (
    <div className="sticky top-4 space-y-6">
      <FilterGroup title="Personne">
        <FilterRow active={personFilter === 'all'} onClick={() => setPersonFilter('all')}>
          Tous
        </FilterRow>
        {AUTHORIZED_UIDS.map((uid) => {
          const p = getPerson(uid)
          return (
            <FilterRow
              key={uid}
              active={personFilter === uid}
              onClick={() => setPersonFilter(uid)}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${p.dotClass} mr-2`} />
              {p.label}
            </FilterRow>
          )
        })}
      </FilterGroup>

      <FilterGroup title="Type">
        <FilterRow active={typeFilter === 'all'} onClick={() => { setTypeFilter('all'); setCategoryFilter('all') }}>
          Tous
        </FilterRow>
        <FilterRow
          active={typeFilter === 'income'}
          onClick={() => { setTypeFilter('income'); setCategoryFilter('all') }}
          accentClass="text-emerald-400"
        >
          Revenus
        </FilterRow>
        <FilterRow
          active={typeFilter === 'expense'}
          onClick={() => { setTypeFilter('expense'); setCategoryFilter('all') }}
          accentClass="text-red-400"
        >
          Dépenses
        </FilterRow>
      </FilterGroup>

      <FilterGroup title="Compte">
        <FilterRow active={accountFilter === 'all'} onClick={() => setAccountFilter('all')}>
          Tous comptes
        </FilterRow>
        <FilterRow
          active={accountFilter === 'common'}
          onClick={() => setAccountFilter('common')}
          accentClass="text-sky-400"
        >
          <Users size={12} strokeWidth={2.2} className="mr-2" />
          Commun
        </FilterRow>
        <FilterRow
          active={accountFilter === 'personal'}
          onClick={() => setAccountFilter('personal')}
        >
          <User size={12} strokeWidth={2.2} className="mr-2" />
          Personnel
        </FilterRow>
      </FilterGroup>

      {visibleCategories.length > 0 && (
        <FilterGroup title="Catégorie">
          <FilterRow active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
            Toutes
          </FilterRow>
          {visibleCategories.map((cat) => {
            const Icon = cat.icon
            const active = categoryFilter === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`w-full inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition text-left ${
                  active
                    ? `${cat.bgClass} ${cat.textClass}`
                    : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={12} strokeWidth={2.2} className="mr-2" />
                {cat.label}
              </button>
            )
          })}
        </FilterGroup>
      )}
    </div>
  )
}

function FilterGroup({ title, children }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-2 px-2.5">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function FilterRow({ active, onClick, accentClass, children }) {
  return (
    <button
      onClick={onClick}
      className={`w-full inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition text-left ${
        active
          ? `bg-white/[0.06] ${accentClass || 'text-white'}`
          : 'text-white/50 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      {children}
    </button>
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
