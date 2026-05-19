import { Plane, CheckSquare, Calendar, Sparkles } from 'lucide-react'

const COMING_SOON = [
  {
    icon: CheckSquare,
    title: 'Checklist',
    description: 'Démarches avant départ, à l\'arrivée, valise.',
  },
  {
    icon: Calendar,
    title: 'Timeline',
    description: 'Étapes-clés de l\'année : visa, école, road trip…',
  },
  {
    icon: Sparkles,
    title: 'Scénarios',
    description: 'Comparer prudent / réaliste / optimiste.',
  },
]

export default function VoyageView() {
  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-full flex items-center justify-center bg-cyan-500/15 text-cyan-400">
            <Plane size={16} strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Voyage</h1>
        </div>
        <p className="text-xs text-white/40 mb-10 pl-12">Notre année en Australie</p>

        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4">
          {COMING_SOON.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex items-start gap-3 px-4 py-3.5 lg:flex-col lg:p-6 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl"
            >
              <div className="h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center bg-white/[0.04] text-white/40">
                <Icon size={15} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white/70">{title}</p>
                  <span className="text-[10px] uppercase tracking-wider text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                    Bientôt
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
