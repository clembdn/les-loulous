import { Circle, Clock, CheckCircle2, HelpCircle, Edit2, Wallet } from 'lucide-react'
import { getPersonByUid } from '../../config/people.js'

export default function ChecklistItemCard({ item, onEdit, onChangeStatus }) {
  const isDone = item.status === 'done'
  
  const statusConfig = {
    todo: { icon: Circle, bg: 'bg-bg-elevated', text: 'text-text-muted', label: 'À faire', border: 'border-border-subtle' },
    in_progress: { icon: Clock, bg: 'bg-orange-500/10', text: 'text-orange-500', label: 'En cours', border: 'border-orange-500/30' },
    done: { icon: CheckCircle2, bg: 'bg-success/10', text: 'text-success', label: 'Fait', border: 'border-success/30' },
    optional: { icon: HelpCircle, bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Optionnel', border: 'border-blue-500/30' }
  }

  const priorityConfig = {
    low: { bg: 'bg-bg-hover', text: 'text-text-muted', label: 'Basse' },
    normal: { bg: 'bg-brand/10', text: 'text-brand-glow', label: 'Normale' },
    high: { bg: 'bg-danger/10', text: 'text-danger', label: 'Haute' }
  }

  const status = statusConfig[item.status] || statusConfig.todo
  const priority = priorityConfig[item.priority] || priorityConfig.normal
  
  let concernLabel = 'Commun'
  let concernColor = 'text-text-secondary'
  if (item.concerns && item.concerns !== 'common') {
    const person = getPersonByUid(item.concerns)
    if (person) {
      concernLabel = person.label
      concernColor = person.text
    } else {
      concernLabel = item.concerns === 'user_a' ? 'Clément' : 'Lise'
      concernColor = 'text-brand'
    }
  }

  const StatusIcon = status.icon

  return (
    <div className={`group relative p-4 rounded-2xl border transition-all ${
      isDone ? 'bg-bg-card/50 border-border-subtle/50 opacity-75' : 'bg-bg-card border-border-subtle hover:border-brand/30 shadow-sm'
    }`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onChangeStatus(isDone ? 'todo' : 'done')}
          className={`mt-0.5 rounded-full p-0.5 transition-colors ${status.text} ${status.bg} hover:bg-opacity-80`}
          title={`Passer à ${isDone ? 'À faire' : 'Fait'}`}
        >
          <StatusIcon className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`text-sm font-semibold truncate ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`}>
              {item.title}
            </h3>
            <button
              onClick={onEdit}
              className="p-1 rounded-lg text-text-muted hover:text-brand hover:bg-brand/10 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text} ${status.border} border`}>
              {status.label}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
              {priority.label}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-bg-elevated border border-border-subtle ${concernColor}`}>
              {concernLabel}
            </span>
            {item.plannedCost && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand/5 border border-brand/20 text-brand-glow">
                <Wallet className="h-3 w-3" />
                {item.plannedCost} {item.currency}
              </span>
            )}
            {item.dueDate && (
              <span className="text-[10px] text-text-muted flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(item.dueDate).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
