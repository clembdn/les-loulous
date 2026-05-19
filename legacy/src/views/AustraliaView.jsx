import {
  Plane, Calendar, Plus, RefreshCw, ArrowUpDown,
  TrendingUp, Wallet, Timer, ArrowDownCircle, Users, Filter,
  Banknote, Briefcase, BarChart3
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { FINAUZI_PEOPLE } from '../config/people.js'
import { getCategoryConfig } from '../components/australia/CategoryBadge.jsx'

const CATEGORIES = [
  'housing', 'food', 'transport', 'admin', 'travel',
  'health', 'income', 'leisure', 'emergency', 'other',
]

import { useAustraliaData } from '../hooks/useAustraliaData.js'

import SummaryCard from '../components/australia/SummaryCard.jsx'
import WarningBanner from '../components/australia/WarningBanner.jsx'
import ForecastChart from '../components/australia/ForecastChart.jsx'
import TransactionFormModal from '../components/australia/TransactionFormModal.jsx'
import TransactionRow from '../components/australia/TransactionRow.jsx'
import SafetyBufferControl from '../components/australia/SafetyBufferControl.jsx'
import ScenariosModal from '../components/australia/ScenariosModal.jsx'
import MobileAustraliaView from '../components/mobile/MobileAustraliaView.jsx'

export default function AustraliaView() {
  const data = useAustraliaData()

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="inline-block h-6 w-6 border-2 border-brand/30 border-t-brand-glow rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {/* ─── Mobile: shown only on small screens ─── */}
      <div className="lg:hidden py-3">
        <MobileAustraliaView data={data} />
      </div>

      {/* ─── Desktop: hidden on small screens ─── */}
      <div className="hidden lg:block">
        <DesktopAustraliaView data={data} />
      </div>
    </>
  )
}

// ─── Desktop Dashboard ───
function DesktopAustraliaView({ data }) {
  const {
    format,
    defaultPersonUid,
    settings,
    modalOpen,
    editingTx,
    transactions,
    recurringTxs,
    oneOffTxs,
    forecastData,
    monthlyCashflow,
    lowestBalance,
    finalCapital,
    healthStatus,
    personBreakdown,
    compteCommunBalance,
    capitalProjet,
    scenarioData,
    handleSave,
    handleDelete,
    handleTogglePause,
    openCreateModal,
    openEditModal,
    closeModal,
    setSafetyBuffer,
    getCashflowStatus,
    getFinalCapitalStatus,
    getRunwayLabel,
    getRunwayStatus,
    getLowestStatus,
  } = data

  const [showScenarios, setShowScenarios] = useState(false)

  const [filterUser, setFilterUser] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [sortMode, setSortMode] = useState('date-desc')

  // Apply filters and sorting to both lists
  const filterAndSort = (list) => {
    let filtered = list
    if (filterUser !== 'all') {
      filtered = filtered.filter(tx => {
        const payer = tx.paidByUid || tx.personUid
        if (payer === filterUser) return true
        if (Array.isArray(tx.splits) && tx.splits.some(s => s.personUid === filterUser && s.percentage > 0)) return true
        return false
      })
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter(tx => tx.category === filterCategory)
    }
    return [...filtered].sort((a, b) => {
      if (sortMode === 'price-desc') return b.amountEUR - a.amountEUR
      if (sortMode === 'price-asc') return a.amountEUR - b.amountEUR
      return 0
    })
  }

  const filteredRecurring = useMemo(() => filterAndSort(recurringTxs), [recurringTxs, filterUser, filterCategory, sortMode])
  const filteredOneOff = useMemo(() => filterAndSort(oneOffTxs), [oneOffTxs, filterUser, filterCategory, sortMode])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Plane className="h-6 w-6 text-brand-glow" /> FinAuzi
          </h1>
          <p className="text-sm text-text-secondary">
            Notre trésorerie pour l'Australie
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SafetyBufferControl
            value={settings.safetyBuffer}
            onChange={setSafetyBuffer}
            format={format}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <SummaryCard
          icon={ArrowUpDown}
          label="Cashflow Mensuel Net"
          value={monthlyCashflow.netCashflow >= 0
            ? `+${format(monthlyCashflow.netCashflow)}`
            : `−${format(Math.abs(monthlyCashflow.netCashflow))}`
          }
          subtitle={`${format(monthlyCashflow.totalIncome)} revenus — ${format(monthlyCashflow.totalExpenses)} dépenses`}
          status={getCashflowStatus()}
        />
        <SummaryCard
          icon={Wallet}
          label="Capital Projeté Fin d'Année"
          value={format(finalCapital)}
          subtitle={finalCapital > settings.safetyBuffer
            ? 'Au-dessus du seuil de sécurité'
            : finalCapital > 0
              ? 'Sous le seuil de sécurité'
              : 'Capital épuisé'
          }
          status={getFinalCapitalStatus()}
        />
        <SummaryCard
          icon={Timer}
          label="Runway"
          value={getRunwayLabel()}
          subtitle={data.runway === null
            ? 'Le capital ne s\'épuise pas sur 12 mois'
            : `Capital épuisé au mois ${data.runway}`
          }
          status={getRunwayStatus()}
        />
        <SummaryCard
          icon={ArrowDownCircle}
          label="Mois le plus bas"
          value={format(lowestBalance.amount)}
          subtitle={lowestBalance.label}
          status={getLowestStatus()}
        />
        <SummaryCard
          icon={Banknote}
          label="Solde Compte Commun"
          value={format(compteCommunBalance)}
          subtitle={compteCommunBalance >= 0 ? 'Capital disponible' : 'Solde négatif'}
          status={compteCommunBalance > settings.safetyBuffer ? 'green' : compteCommunBalance > 0 ? 'orange' : 'red'}
        />
        <SummaryCard
          icon={Briefcase}
          label="Capital Projet"
          value={format(capitalProjet)}
          subtitle="Total engagé dans le projet"
          status="neutral"
        />
      </div>

      {/* Scénarios Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowScenarios(true)}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-xl bg-bg-elevated border border-border-subtle text-sm font-medium text-text-secondary hover:text-brand-glow hover:border-brand/30 transition-all"
        >
          <BarChart3 className="h-4 w-4" /> Scénarios
        </button>
      </div>

      {/* Warning Banner */}
      <WarningBanner status={healthStatus} />



      {/* Forecast Chart */}
      <section className="card">
        <header className="flex items-center justify-between mb-4">
          <div>
            <p className="stat-label flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Projection sur 12 mois
            </p>
            <p className="text-sm text-text-secondary">
              Capital initial : {format(settings.initialCapital)}
            </p>
          </div>
        </header>
        <ForecastChart
          forecastData={forecastData}
          safetyBuffer={settings.safetyBuffer}
          format={format}
        />
      </section>

      {/* Transaction Manager */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Gestion des transactions</h2>
          <p className="text-sm text-text-secondary">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="flex items-center gap-2 p-1 bg-bg-elevated border border-border-subtle rounded-xl">
            <Filter className="h-4 w-4 text-text-muted ml-2 shrink-0" />
            <select 
              value={filterUser} 
              onChange={e => setFilterUser(e.target.value)}
              className="bg-transparent text-sm text-text-secondary outline-none px-1 cursor-pointer"
            >
              <option value="all">Tous utilisateurs</option>
              {FINAUZI_PEOPLE.map(p => <option key={p.uid} value={p.uid}>{p.label}</option>)}
            </select>
            <span className="w-px h-4 bg-border-subtle" />
            <select 
              value={filterCategory} 
              onChange={e => setFilterCategory(e.target.value)}
              className="bg-transparent text-sm text-text-secondary outline-none px-1 cursor-pointer"
            >
              <option value="all">Toutes catégories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryConfig(c).label}</option>)}
            </select>
            <span className="w-px h-4 bg-border-subtle" />
            <select 
              value={sortMode} 
              onChange={e => setSortMode(e.target.value)}
              className="bg-transparent text-sm text-text-secondary outline-none px-1 cursor-pointer"
            >
              <option value="date-desc">Tri par défaut</option>
              <option value="price-desc">Prix ↘</option>
              <option value="price-asc">Prix ↗</option>
            </select>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-brand text-white text-sm font-medium hover:bg-brand/90 shadow-glow transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <Plus className="h-4 w-4" />
            Ajouter une transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recurring */}
        <section className="card">
          <header className="flex items-center justify-between mb-4">
            <div>
              <p className="stat-label flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Mensualités Actives
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {filteredRecurring.length} transaction{filteredRecurring.length !== 1 ? 's' : ''} récurrente{filteredRecurring.length !== 1 ? 's' : ''}
              </p>
            </div>
          </header>

          {filteredRecurring.length > 0 ? (
            <div className="space-y-2">
              {filteredRecurring.map(tx => (
                <TransactionRow
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
            <EmptyState
              message="Aucune mensualité active."
              hint="Ajoutez votre loyer, abonnements ou revenus récurrents."
            />
          )}
        </section>

        {/* One-off */}
        <section className="card">
          <header className="flex items-center justify-between mb-4">
            <div>
              <p className="stat-label flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Dépenses / Gains Occasionnels
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {filteredOneOff.length} transaction{filteredOneOff.length !== 1 ? 's' : ''} ponctuelle{filteredOneOff.length !== 1 ? 's' : ''}
              </p>
            </div>
          </header>

          {filteredOneOff.length > 0 ? (
            <div className="space-y-2">
              {filteredOneOff.map(tx => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  format={format}
                  settings={settings}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              message="Aucune transaction occasionnelle prévue."
              hint="Ajoutez votre visa, billet d'avion ou frais d'installation."
            />
          )}
        </section>
      </div>

      {/* Transaction Form Modal */}
      <TransactionFormModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={handleDelete}
        transaction={editingTx}
        currentUserUid={defaultPersonUid}
      />

      {/* Scénarios Modal */}
      <ScenariosModal
        isOpen={showScenarios}
        onClose={() => setShowScenarios(false)}
        scenarioData={scenarioData}
        format={format}
        safetyBuffer={settings.safetyBuffer}
      />
    </div>
  )
}

// ─── Empty State ───
function EmptyState({ message, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="h-12 w-12 rounded-2xl bg-bg-elevated border border-border-subtle flex items-center justify-center mb-3">
        <Calendar className="h-5 w-5 text-text-muted" />
      </div>
      <p className="text-sm text-text-secondary">{message}</p>
      <p className="text-xs text-text-muted mt-1">{hint}</p>
    </div>
  )
}
