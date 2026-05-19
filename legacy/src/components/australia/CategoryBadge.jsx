import {
  Home, Utensils, Bus, FileText, Plane, HeartPulse,
  TrendingUp, Sparkles, AlertTriangle, Circle,
} from 'lucide-react'

const CATEGORY_CONFIG = {
  housing:    { icon: Home,          label: 'Logement',   bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20' },
  food:       { icon: Utensils,      label: 'Alimentation', bg: 'bg-amber-500/10', text: 'text-amber-400',   border: 'border-amber-500/20' },
  transport:  { icon: Bus,           label: 'Transport',  bg: 'bg-violet-500/10',  text: 'text-violet-400',  border: 'border-violet-500/20' },
  admin:      { icon: FileText,      label: 'Admin',      bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/20' },
  travel:     { icon: Plane,         label: 'Voyage',     bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    border: 'border-cyan-500/20' },
  health:     { icon: HeartPulse,    label: 'Santé',      bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/20' },
  income:     { icon: TrendingUp,    label: 'Revenu',     bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  leisure:    { icon: Sparkles,      label: 'Loisirs',    bg: 'bg-pink-500/10',    text: 'text-pink-400',    border: 'border-pink-500/20' },
  emergency:  { icon: AlertTriangle, label: 'Urgence',    bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20' },
  other:      { icon: Circle,        label: 'Autre',      bg: 'bg-gray-500/10',    text: 'text-gray-400',    border: 'border-gray-500/20' },
}

export function getCategoryConfig(category) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other
}

export default function CategoryBadge({ category, showLabel = false, size = 'sm' }) {
  const config = getCategoryConfig(category)
  const Icon = config.icon
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const padding = size === 'sm' ? 'p-1.5' : 'p-2'

  if (showLabel) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
        <Icon className={iconSize} />
        {config.label}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center justify-center rounded-lg ${padding} ${config.bg} ${config.text} border ${config.border}`}>
      <Icon className={iconSize} />
    </span>
  )
}
