import AccountCard from '../components/global/AccountCard.jsx'
import AllocationDonut from '../components/global/AllocationDonut.jsx'
import TotalCapitalChart from '../components/global/TotalCapitalChart.jsx'
import { accounts } from '../data/portfolio.js'

export default function GlobalView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portefeuille Global</h1>
        <p className="text-sm text-text-secondary">
          Une vue unifiée de l'épargne, des investissements et du capital bloqué.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <TotalCapitalChart />
        </div>
        <AllocationDonut />
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">
          Comptes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} />
          ))}
        </div>
      </div>
    </div>
  )
}
