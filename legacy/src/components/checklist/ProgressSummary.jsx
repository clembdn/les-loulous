import { Wallet, CheckSquare, ListTodo, AlertCircle } from 'lucide-react'

export default function ProgressSummary({ stats }) {
  const percentage = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="bg-bg-card border border-border-subtle rounded-2xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center gap-2 text-text-muted mb-2">
          <CheckSquare className="h-4 w-4 text-brand" />
          <span className="text-xs font-medium uppercase tracking-wider">Progression</span>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-text-primary">
            {percentage}%
          </div>
          <p className="text-xs text-text-muted mt-1">{stats.done} terminés sur {stats.total}</p>
        </div>
      </div>

      <div className="bg-bg-card border border-border-subtle rounded-2xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center gap-2 text-text-muted mb-2">
          <ListTodo className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-medium uppercase tracking-wider">Restant</span>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-text-primary">
            {stats.todo + stats.inProgress}
          </div>
          <p className="text-xs text-text-muted mt-1">{stats.inProgress} en cours, {stats.todo} à faire</p>
        </div>
      </div>

      <div className="bg-bg-card border border-border-subtle rounded-2xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center gap-2 text-text-muted mb-2">
          <Wallet className="h-4 w-4 text-danger" />
          <span className="text-xs font-medium uppercase tracking-wider">Coût Prévu</span>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-text-primary">
            {stats.plannedCost}
          </div>
          <p className="text-xs text-text-muted mt-1">Montant estimé des dépenses</p>
        </div>
      </div>

      <div className="bg-bg-card border border-border-subtle rounded-2xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center gap-2 text-text-muted mb-2">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-medium uppercase tracking-wider">Coût Réel</span>
        </div>
        <div>
          <div className="text-2xl font-bold tracking-tight text-text-primary">
            {stats.actualCost}
          </div>
          <p className="text-xs text-text-muted mt-1">Dépenses déjà réalisées</p>
        </div>
      </div>
    </div>
  )
}
