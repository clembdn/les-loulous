import { Plane } from 'lucide-react'
import Checklist from '../components/voyage/Checklist.jsx'
import Timeline from '../components/voyage/Timeline.jsx'
import { VOYAGE_SUBS } from '../config/navigation.js'
import { cn } from '../lib/utils.js'

export default function VoyageView({ section = 'checklist', onNavigate }) {
  const currentSection = VOYAGE_SUBS.find((s) => s.id === section) || VOYAGE_SUBS[0]

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 pt-8 lg:pt-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-full flex items-center justify-center bg-cyan-500/15 text-cyan-400">
            <Plane size={16} strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Voyage</h1>
        </div>
        <p className="text-xs text-white/40 mb-8 pl-12">Notre année en Australie</p>

        {/* Mobile-only page-level tabs (desktop uses sidebar) */}
        <MobileVoyageTabs active={section} onNavigate={onNavigate} />

        {/* Section title (desktop) — gives context since sidebar is the only navigation hint */}
        <div className="hidden lg:flex items-center gap-2 mb-4">
          <currentSection.icon size={14} strokeWidth={2.2} className="text-white/40" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/30">
            {currentSection.label}
          </p>
        </div>

        <SectionContent section={section} />
      </div>
    </div>
  )
}

function SectionContent({ section }) {
  switch (section) {
    case 'checklist':
      return <Checklist />
    case 'timeline':
      return <Timeline />
    case 'scenarios':
      return <ComingSoonCard label="Scénarios" description="Comparer prudent / réaliste / optimiste." />
    default:
      return <Checklist />
  }
}

function MobileVoyageTabs({ active, onNavigate }) {
  return (
    <div className="lg:hidden flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl mb-6">
      {VOYAGE_SUBS.map((s) => {
        const Icon = s.icon
        const isActive = active === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onNavigate?.(s.id)}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition',
              isActive ? 'bg-white text-black' : 'text-white/40 hover:text-white/70',
            )}
          >
            <Icon size={12} strokeWidth={2.2} />
            <span>{s.short}</span>
          </button>
        )
      })}
    </div>
  )
}

function ComingSoonCard({ label, description }) {
  return (
    <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-8 text-center">
      <p className="text-sm font-medium text-white/70 mb-1">{label}</p>
      <p className="text-xs text-white/40">{description}</p>
      <p className="text-[10px] uppercase tracking-wider text-white/30 bg-white/5 px-1.5 py-0.5 rounded inline-block mt-3">
        Bientôt
      </p>
    </div>
  )
}
