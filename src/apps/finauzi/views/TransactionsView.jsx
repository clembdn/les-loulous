import { useMemo, Fragment, useState } from 'react'
import { Plus, Search, Users, User, Plane, SlidersHorizontal, X, Check } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { AUTHORIZED_UIDS, getPerson } from '@/shared/config/people.js'
import { CATEGORIES, getCategory } from '../config/categories.js'
import { formatDateShort } from '../utils/cashflow.js'
import { DEPARTURE_DATE, DEPARTURE_TIMESTAMP } from '../config/journey.js'
import TransactionRow from '../components/transactions/TransactionRow.jsx'
import { Sheet, SheetContent, SheetBody, SheetFooter } from '@/shared/ui/sheet.jsx'
import { cn } from '@/shared/lib/utils.js'

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
  const { transactions, settings, isLoading } = useAppData()
  const userColors = settings.userColors
  const { openForm } = useUI()
  const [personFilter, setPersonFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  function resetFilters() {
    setPersonFilter('all')
    setTypeFilter('all')
    setAccountFilter('all')
    setCategoryFilter('all')
  }

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
    userColors,
  }

  const activeCount =
    (personFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (accountFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0)

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 pt-8 lg:pt-10">
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

        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 xl:gap-14">
          {/* Desktop filter sidebar */}
          <aside className="hidden lg:block">
            <DesktopFilters {...filtersProps} />
          </aside>

          {/* Main column: search + mobile filters + list */}
          <div>
            {/* Mobile toolbar: search + filters button */}
            <div className="lg:hidden flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition"
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className={cn(
                  'relative inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition flex-shrink-0',
                  activeCount > 0
                    ? 'bg-white text-black border-white'
                    : 'bg-white/[0.04] text-white border-white/10 hover:bg-white/[0.06]',
                )}
                aria-label="Ouvrir les filtres"
              >
                <SlidersHorizontal size={14} strokeWidth={2.2} />
                Filtres
                {activeCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-black/90 text-white text-[10px] font-bold tabular">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>

            {/* Desktop search */}
            <div className="hidden lg:block relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition"
              />
            </div>

            {/* Active filter chips (mobile) */}
            <div className="lg:hidden mb-3">
              <ActiveFilterChips
                {...filtersProps}
                onReset={resetFilters}
              />
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
                {groups.map((g, idx) => {
                  const showDeparture = shouldShowDepartureBefore(groups, idx, DEPARTURE_TIMESTAMP)
                  return (
                    <Fragment key={g.key}>
                      {showDeparture && <DepartureDivider date={DEPARTURE_DATE} />}
                      <div>
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
                    </Fragment>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filters sheet */}
      <MobileFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        resultsCount={filtered.length}
        onReset={resetFilters}
        {...filtersProps}
      />
    </div>
  )
}

// ─── Active filter chips ─────────────────────────────────────────────────

function ActiveFilterChips({
  personFilter, setPersonFilter,
  typeFilter, setTypeFilter,
  accountFilter, setAccountFilter,
  categoryFilter, setCategoryFilter,
  userColors,
  onReset,
}) {
  const chips = []
  if (personFilter !== 'all') {
    const p = getPerson(personFilter, userColors)
    chips.push({
      key: 'person',
      label: p?.label || 'Personne',
      onClear: () => setPersonFilter('all'),
      dotClass: p?.dotClass,
    })
  }
  if (typeFilter !== 'all') {
    chips.push({
      key: 'type',
      label: typeFilter === 'income' ? 'Revenus' : 'Dépenses',
      accentClass: typeFilter === 'income' ? 'text-emerald-400' : 'text-red-400',
      onClear: () => setTypeFilter('all'),
    })
  }
  if (accountFilter !== 'all') {
    chips.push({
      key: 'account',
      label: accountFilter === 'common' ? 'Commun' : 'Personnel',
      accentClass: accountFilter === 'common' ? 'text-sky-400' : 'text-white',
      onClear: () => setAccountFilter('all'),
    })
  }
  if (categoryFilter !== 'all') {
    const cat = getCategory(categoryFilter)
    chips.push({
      key: 'category',
      label: cat.label,
      accentClass: cat.textClass,
      onClear: () => setCategoryFilter('all'),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
      {chips.map((c) => (
        <span
          key={c.key}
          className={cn(
            'inline-flex items-center gap-1.5 flex-shrink-0 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium bg-white/[0.06] border border-white/10',
            c.accentClass,
          )}
        >
          {c.dotClass && <span className={`h-1.5 w-1.5 rounded-full ${c.dotClass}`} />}
          {c.label}
          <button
            type="button"
            onClick={c.onClear}
            className="h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-white/10 transition"
            aria-label={`Retirer ${c.label}`}
          >
            <X size={11} strokeWidth={2.4} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="text-[11px] text-white/40 hover:text-white underline-offset-2 hover:underline transition flex-shrink-0 ml-1"
      >
        Tout effacer
      </button>
    </div>
  )
}

// ─── Mobile filters bottom sheet ─────────────────────────────────────────

function MobileFiltersSheet({
  open,
  onClose,
  resultsCount,
  onReset,
  personFilter, setPersonFilter,
  typeFilter, setTypeFilter,
  accountFilter, setAccountFilter,
  categoryFilter, setCategoryFilter,
  visibleCategories,
  userColors,
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" desktopSide="bottom" title="Filtres" className="sm:max-w-md sm:left-1/2 sm:-translate-x-1/2">
        <SheetBody>
          <SheetSection title="Personne">
            <ChipGroup>
              <Chip active={personFilter === 'all'} onClick={() => setPersonFilter('all')}>
                Tous
              </Chip>
              {AUTHORIZED_UIDS.map((uid) => {
                const p = getPerson(uid, userColors)
                const active = personFilter === uid
                return (
                  <Chip
                    key={uid}
                    active={active}
                    onClick={() => setPersonFilter(uid)}
                    activeClass={`${p.bgClass} ${p.textClass} ${p.borderClass}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${p.dotClass} mr-1.5`} />
                    {p.label}
                  </Chip>
                )
              })}
            </ChipGroup>
          </SheetSection>

          <SheetSection title="Type">
            <ChipGroup>
              <Chip active={typeFilter === 'all'} onClick={() => { setTypeFilter('all'); setCategoryFilter('all') }}>
                Tous
              </Chip>
              <Chip
                active={typeFilter === 'income'}
                onClick={() => { setTypeFilter('income'); setCategoryFilter('all') }}
                activeClass="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              >
                Revenus
              </Chip>
              <Chip
                active={typeFilter === 'expense'}
                onClick={() => { setTypeFilter('expense'); setCategoryFilter('all') }}
                activeClass="bg-red-500/15 text-red-400 border-red-500/30"
              >
                Dépenses
              </Chip>
            </ChipGroup>
          </SheetSection>

          <SheetSection title="Compte">
            <ChipGroup>
              <Chip active={accountFilter === 'all'} onClick={() => setAccountFilter('all')}>
                Tous
              </Chip>
              <Chip
                active={accountFilter === 'common'}
                onClick={() => setAccountFilter('common')}
                activeClass="bg-sky-500/15 text-sky-400 border-sky-500/30"
              >
                <Users size={11} strokeWidth={2.2} className="mr-1.5" />
                Commun
              </Chip>
              <Chip
                active={accountFilter === 'personal'}
                onClick={() => setAccountFilter('personal')}
                activeClass="bg-white/10 text-white border-white/20"
              >
                <User size={11} strokeWidth={2.2} className="mr-1.5" />
                Personnel
              </Chip>
            </ChipGroup>
          </SheetSection>

          {visibleCategories.length > 0 && (
            <SheetSection title="Catégorie">
              <div className="grid grid-cols-3 gap-1.5">
                <Chip
                  active={categoryFilter === 'all'}
                  onClick={() => setCategoryFilter('all')}
                  fullWidth
                >
                  Toutes
                </Chip>
                {visibleCategories.map((cat) => {
                  const Icon = cat.icon
                  const active = categoryFilter === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={cn(
                        'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition border',
                        active
                          ? `${cat.bgClass} ${cat.textClass} ${cat.borderClass}`
                          : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]',
                      )}
                    >
                      <Icon size={12} strokeWidth={2.2} />
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </SheetSection>
          )}
        </SheetBody>
        <SheetFooter className="flex items-center gap-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/[0.04] transition"
          >
            Tout effacer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition"
          >
            <Check size={15} strokeWidth={2.6} />
            Voir {resultsCount} résultat{resultsCount > 1 ? 's' : ''}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SheetSection({ title, children }) {
  return (
    <section className="mb-6">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2 px-1">{title}</p>
      {children}
    </section>
  )
}

function ChipGroup({ children }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>
}

function Chip({ active, onClick, activeClass, fullWidth, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center px-3.5 py-2 rounded-xl text-xs font-medium transition border',
        fullWidth && 'w-full',
        active
          ? activeClass || 'bg-white text-black border-white'
          : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]',
      )}
    >
      {children}
    </button>
  )
}

// ─── Desktop sidebar filters ─────────────────────────────────────────────

function DesktopFilters({
  personFilter, setPersonFilter,
  typeFilter, setTypeFilter,
  accountFilter, setAccountFilter,
  categoryFilter, setCategoryFilter,
  visibleCategories,
  userColors,
}) {
  return (
    <div className="sticky top-4 space-y-6">
      <FilterGroup title="Personne">
        <FilterRow active={personFilter === 'all'} onClick={() => setPersonFilter('all')}>
          Tous
        </FilterRow>
        {AUTHORIZED_UIDS.map((uid) => {
          const p = getPerson(uid, userColors)
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

// Returns true when this group is the first one BELOW the departure date in the
// reverse-chronological list — i.e. the boundary where we render the "départ" divider.
function shouldShowDepartureBefore(groups, idx, departureTime) {
  if (!departureTime) return false
  const phase = (g) => new Date(g.items[0].date).getTime() >= departureTime ? 'australia' : 'prep'
  const current = phase(groups[idx])
  if (current !== 'prep') return false
  if (idx === 0) return false
  return phase(groups[idx - 1]) === 'australia'
}

function DepartureDivider({ date }) {
  return (
    <div className="flex items-center gap-3 px-2 -my-1 select-none">
      <span className="flex-1 h-px bg-gradient-to-r from-transparent to-cyan-500/40" />
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-cyan-400">
        <Plane size={11} strokeWidth={2.2} />
        Départ pour l'Australie · {formatDateShort(date)}
      </span>
      <span className="flex-1 h-px bg-gradient-to-l from-transparent to-cyan-500/40" />
    </div>
  )
}
