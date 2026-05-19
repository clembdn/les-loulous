import { ShieldCheck, AlertTriangle, XCircle } from 'lucide-react'

const BANNERS = {
  green: {
    icon: ShieldCheck,
    message: 'Projection saine : ton capital reste au-dessus du seuil de sécurité.',
    bg: 'bg-success/5',
    border: 'border-success/20',
    text: 'text-success',
    iconColor: 'text-success',
  },
  orange: {
    icon: AlertTriangle,
    message: 'Attention : ton capital passe sous le seuil de sécurité pendant la période.',
    bg: 'bg-warning/5',
    border: 'border-warning/20',
    text: 'text-warning',
    iconColor: 'text-warning',
  },
  red: {
    icon: XCircle,
    message: 'Risque critique : ton capital atteint zéro ou passe en négatif.',
    bg: 'bg-danger/5',
    border: 'border-danger/20',
    text: 'text-danger',
    iconColor: 'text-danger',
  },
}

export default function WarningBanner({ status }) {
  const banner = BANNERS[status]
  if (!banner) return null
  const Icon = banner.icon

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${banner.bg} ${banner.border} transition-all duration-300`}>
      <Icon className={`h-5 w-5 shrink-0 ${banner.iconColor}`} />
      <p className={`text-sm font-medium ${banner.text}`}>
        {banner.message}
      </p>
    </div>
  )
}
