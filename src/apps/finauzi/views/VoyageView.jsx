import Checklist from '../components/voyage/Checklist.jsx'
import Timeline from '../components/voyage/Timeline.jsx'
import { VOYAGE_SUBS, getVoyageSub } from '../config/navigation.js'
import MobileSubTabs from '../components/layout/MobileSubTabs.jsx'

// Renders one of the Voyage sub-pages (Checklist or Timeline).
// Each section is a top-level page on desktop (via the sidebar);
// on mobile they share the Voyage tab and a sub-tab switcher.
export default function VoyageView({ section = 'checklist', onNavigate }) {
  const current = getVoyageSub(section)
  const Icon = current.icon

  return (
    <div className="fade-in pb-32 lg:pb-12">
      <div className="max-w-3xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 pt-8 lg:pt-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-full flex items-center justify-center bg-cyan-500/15 text-cyan-400">
            <Icon size={16} strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{current.label}</h1>
        </div>
        <p className="text-xs text-white/40 mb-8 pl-12">{current.subtitle}</p>

        <MobileSubTabs subs={VOYAGE_SUBS} active={section} onNavigate={onNavigate} className="mb-6" />

        <SectionContent section={section} />
      </div>
    </div>
  )
}

function SectionContent({ section }) {
  switch (section) {
    case 'timeline':
      return <Timeline />
    case 'checklist':
    default:
      return <Checklist />
  }
}

