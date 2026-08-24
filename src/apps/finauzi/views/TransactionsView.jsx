import { useMemo, Fragment, useState } from 'react'
import { Plus, Search, Plane, SlidersHorizontal, X, Check, Upload } from 'lucide-react'
import { useAppData } from '../context/AppDataContext.jsx'
import { useUI } from '../context/UIContext.jsx'
import { AUTHORIZED_UIDS, getPerson } from '@/shared/config/people.js'
import { CATEGORIES, getCategory } from '../config/categories.js'
import { ACCOUNTS, SPLIT_COMMON, getAccount } from '../config/accounts.js'
import { touchesAccount, expandOccurrences } from '../utils/ledger.js'
import { formatDateShort, addMonths } from '../utils/cashflow.js'
import { DEPARTURE_DATE, DEPARTURE_TIMESTAMP } from '../config/journey.js'
import TransactionRow from '../components/transactions/TransactionRow.jsx'
import { Sheet, SheetContent, SheetBody, SheetFooter } from '@/shared/ui/sheet.jsx'
import { cn } from '@/shared/lib/utils.js'

// Un mois d'avance, pas plus. De quoi voir le prochain loyer et les prochaines
// semaines d'abonnement pour anticiper, sans noyer l'historique sous des années
// d'échéances théoriques.
const FORECAST_HORIZON_MONTHS = 1

// Une transaction récurrente n'est qu'UN document, mais elle se produit autant
// de fois qu'elle a d'échéances. L'historique les déplie toutes, sans rien à
// ressaisir : un loyer mensuel apparaît chaque mois, un abonnement hebdo chaque
// semaine. Les échéances postérieures à aujourd'hui sont marquées
// `isForecast` — elles ne se sont pas encore produites, elles s'affichent en
// pointillés et ne comptent nulle part ailleurs (soldes, équilibre, budgets
// s'arrêtent tous à aujourd'hui).
function expandHistory(txs, now) {
  if (txs.length === 0) return []
  let earliest = null
  for (const tx of txs) {
    const d = tx.date ? new Date(tx.date) : null
    if (d && !isNaN(d) && (earliest === null || d < earliest)) earliest = d
  }
  if (!earliest) return []
  const horizon = addMonths(now, FORECAST_HORIZON_MONTHS)
  return expandOccurrences(txs, { from: earliest, to: horizon })
    .map((event) => ({ ...event, isForecast: event.date > now }))
}

function groupByMonth(events) {
  const groups = new Map()
  for (const event of events) {
    const d = event.date
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    if (!groups.has(key)) groups.set(key, { label, items: [] })
    groups.get(key).items.push(event)
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, group]) => ({
      key,
      ...group,
      forecastCount: group.items.filter((e) => e.isForecast).length,
    }))
}

export default function TransactionsView({ onNavigate }) {
  const { transactions, settings, isLoading } = useAppData()
  const userColors = settings.userColors
  const { openForm } = useUI()
  const [splitFilter, setSplitFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  function resetFilters() {
    setSplitFilter('all')
    setKindFilter('all')
    setAccountFilter('all')
    setCategoryFilter('all')
  }

  // Le filtre par compte prend les deux sens : un virement apparaît aussi
  // bien dans le compte qui l'envoie que dans celui qui le reçoit.
  const applyBaseFilters = useMemo(() => (list) => {
    let out = list
    if (splitFilter !== 'all') out = out.filter((tx) => tx.split === splitFilter)
    if (kindFilter !== 'all') out = out.filter((tx) => tx.kind === kindFilter)
    if (accountFilter !== 'all') out = out.filter((tx) => touchesAccount(tx, accountFilter))
    return out
  }, [splitFilter, kindFilter, accountFilter])

  // Filtrer AVANT de déplier : inutile de générer les échéances de lignes
  // que l'utilisateur ne regarde pas.
  const filtered = useMemo(() => {
    let list = applyBaseFilters(transactions.filter((tx) => tx.isActive !== false))
    if (categoryFilter !== 'all') list = list.filter((tx) => (tx.category || 'other-expense') === categoryFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((tx) =>
        tx.title?.toLowerCase().includes(q) ||
        tx.notes?.toLowerCase().includes(q) ||
        getCategory(tx.category).label.toLowerCase().includes(q),
      )
    }
    return list
  }, [transactions, applyBaseFilters, categoryFilter, search])

  const events = useMemo(() => {
    const expanded = expandHistory(filtered, new Date())
    // `expandOccurrences` trie du plus ancien au plus récent ; l'historique
    // se lit à l'envers.
    return expanded.reverse()
  }, [filtered])

  const groups = useMemo(() => groupByMonth(events), [events])

  const visibleCategories = useMemo(() => {
    const list = applyBaseFilters(transactions.filter((tx) => tx.isActive !== false))
    const ids = new Set(list.map((tx) => tx.category || 'other-expense'))
    return CATEGORIES.filter((c) => ids.has(c.id))
  }, [transactions, applyBaseFilters])

  const filtersProps = {
    splitFilter, setSplitFilter,
    kindFilter, setKindFilter,
    accountFilter, setAccountFilter,
    categoryFilter, setCategoryFilter,
    visibleCategories,
    userColors,
  }

  const activeCount =
    (splitFilter !== 'all' ? 1 : 0) +
    (kindFilter !== 'all' ? 1 : 0) +
    (accountFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0)

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 pt-8 lg:pt-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Transactions</h1>
          <div className="flex items-center gap-2">
            {/* Sur desktop, l'import a son entrée dans la sidebar ; ici c'est
                le seul chemin pour l'atteindre. */}
            <button
              onClick={() => onNavigate?.('import')}
              className="lg:hidden h-10 px-3.5 rounded-full bg-white/[0.06] border border-white/10 text-white/70 inline-flex items-center gap-1.5 text-xs font-medium hover:text-white active:scale-95 transition"
            >
              <Upload size={14} />
              Importer
            </button>
            <button
              onClick={() => openForm(null)}
              className="h-10 w-10 lg:hidden rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition"
              aria-label="Ajouter"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
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
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/30 mb-1 px-3 flex items-center gap-2">
                          {g.label}
                          {g.forecastCount > 0 && (
                            <span className="normal-case tracking-normal text-[10px] text-white/25">
                              · {g.forecastCount} à venir
                            </span>
                          )}
                        </p>
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-1">
                          {g.items.map((event) => (
                            <TransactionRow
                              key={`${event.tx.id}-${event.timestamp}`}
                              tx={event.tx}
                              date={event.date}
                              isForecast={event.isForecast}
                              onClick={() => openForm(event.tx)}
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
        resultsCount={events.length}
        onReset={resetFilters}
        {...filtersProps}
      />
    </div>
  )
}

// ─── Options partagées entre les trois surfaces de filtre ────────────────

const KIND_OPTIONS = [
  { id: 'expense', label: 'Dépenses', accentClass: 'text-red-400', activeClass: 'bg-red-500/15 text-red-400 border-red-500/30' },
  { id: 'income', label: 'Revenus', accentClass: 'text-emerald-400', activeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { id: 'transfer', label: 'Virements', accentClass: 'text-sky-400', activeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
]

// « À la charge de » : la répartition, pas le payeur. Avec un compte joint,
// savoir qui a sorti la carte n'apprend plus rien — savoir qui supporte
// la dépense, si.
function useSplitOptions(userColors) {
  return useMemo(() => [
    {
      id: SPLIT_COMMON,
      label: 'Commun',
      dotClass: 'bg-sky-400',
      accentClass: 'text-sky-400',
      activeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    },
    ...AUTHORIZED_UIDS.map((uid) => {
      const p = getPerson(uid, userColors)
      return {
        id: uid,
        label: p.label,
        dotClass: p.dotClass,
        accentClass: p.textClass,
        activeClass: `${p.bgClass} ${p.textClass} ${p.borderClass}`,
      }
    }),
  ], [userColors])
}

// ─── Active filter chips ─────────────────────────────────────────────────

function ActiveFilterChips({
  splitFilter, setSplitFilter,
  kindFilter, setKindFilter,
  accountFilter, setAccountFilter,
  categoryFilter, setCategoryFilter,
  userColors,
  onReset,
}) {
  const splitOptions = useSplitOptions(userColors)
  const chips = []
  if (splitFilter !== 'all') {
    const option = splitOptions.find((o) => o.id === splitFilter)
    chips.push({
      key: 'split',
      label: option?.label || 'Répartition',
      accentClass: option?.accentClass,
      dotClass: option?.dotClass,
      onClear: () => setSplitFilter('all'),
    })
  }
  if (kindFilter !== 'all') {
    const option = KIND_OPTIONS.find((o) => o.id === kindFilter)
    chips.push({
      key: 'kind',
      label: option?.label || 'Type',
      accentClass: option?.accentClass,
      onClear: () => setKindFilter('all'),
    })
  }
  if (accountFilter !== 'all') {
    const account = getAccount(accountFilter)
    chips.push({
      key: 'account',
      label: account.short,
      accentClass: account.textClass,
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
  splitFilter, setSplitFilter,
  kindFilter, setKindFilter,
  accountFilter, setAccountFilter,
  categoryFilter, setCategoryFilter,
  visibleCategories,
  userColors,
}) {
  const splitOptions = useSplitOptions(userColors)
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" desktopSide="bottom" title="Filtres" className="sm:max-w-md sm:left-1/2 sm:-translate-x-1/2">
        <SheetBody>
          <SheetSection title="Compte">
            <ChipGroup>
              <Chip active={accountFilter === 'all'} onClick={() => setAccountFilter('all')}>
                Tous
              </Chip>
              {ACCOUNTS.map((account) => {
                const Icon = account.icon
                return (
                  <Chip
                    key={account.id}
                    active={accountFilter === account.id}
                    onClick={() => setAccountFilter(account.id)}
                    activeClass={`${account.bgClass} ${account.textClass} ${account.borderClass}`}
                  >
                    <Icon size={11} strokeWidth={2.2} className="mr-1.5" />
                    {account.short}
                  </Chip>
                )
              })}
            </ChipGroup>
          </SheetSection>

          <SheetSection title="À la charge de">
            <ChipGroup>
              <Chip active={splitFilter === 'all'} onClick={() => setSplitFilter('all')}>
                Tous
              </Chip>
              {splitOptions.map((option) => (
                <Chip
                  key={option.id}
                  active={splitFilter === option.id}
                  onClick={() => setSplitFilter(option.id)}
                  activeClass={option.activeClass}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${option.dotClass} mr-1.5`} />
                  {option.label}
                </Chip>
              ))}
            </ChipGroup>
          </SheetSection>

          <SheetSection title="Type">
            <ChipGroup>
              <Chip active={kindFilter === 'all'} onClick={() => { setKindFilter('all'); setCategoryFilter('all') }}>
                Tous
              </Chip>
              {KIND_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  active={kindFilter === option.id}
                  onClick={() => { setKindFilter(option.id); setCategoryFilter('all') }}
                  activeClass={option.activeClass}
                >
                  {option.label}
                </Chip>
              ))}
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
  splitFilter, setSplitFilter,
  kindFilter, setKindFilter,
  accountFilter, setAccountFilter,
  categoryFilter, setCategoryFilter,
  visibleCategories,
  userColors,
}) {
  const splitOptions = useSplitOptions(userColors)
  return (
    <div className="sticky top-4 space-y-6">
      <FilterGroup title="Compte">
        <FilterRow active={accountFilter === 'all'} onClick={() => setAccountFilter('all')}>
          Tous comptes
        </FilterRow>
        {ACCOUNTS.map((account) => {
          const Icon = account.icon
          return (
            <FilterRow
              key={account.id}
              active={accountFilter === account.id}
              onClick={() => setAccountFilter(account.id)}
              accentClass={account.textClass}
            >
              <Icon size={12} strokeWidth={2.2} className="mr-2" />
              {account.short}
            </FilterRow>
          )
        })}
      </FilterGroup>

      <FilterGroup title="À la charge de">
        <FilterRow active={splitFilter === 'all'} onClick={() => setSplitFilter('all')}>
          Tous
        </FilterRow>
        {splitOptions.map((option) => (
          <FilterRow
            key={option.id}
            active={splitFilter === option.id}
            onClick={() => setSplitFilter(option.id)}
            accentClass={option.accentClass}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${option.dotClass} mr-2`} />
            {option.label}
          </FilterRow>
        ))}
      </FilterGroup>

      <FilterGroup title="Type">
        <FilterRow active={kindFilter === 'all'} onClick={() => { setKindFilter('all'); setCategoryFilter('all') }}>
          Tous
        </FilterRow>
        {KIND_OPTIONS.map((option) => (
          <FilterRow
            key={option.id}
            active={kindFilter === option.id}
            onClick={() => { setKindFilter(option.id); setCategoryFilter('all') }}
            accentClass={option.accentClass}
          >
            {option.label}
          </FilterRow>
        ))}
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
  const phase = (g) => g.items[0].timestamp >= departureTime ? 'australia' : 'prep'
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
