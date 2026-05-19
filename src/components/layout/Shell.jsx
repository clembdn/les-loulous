import BottomNav, { TABS } from './BottomNav.jsx'

export default function Shell({ active, onChange, children }) {
  return (
    <div className="min-h-screen text-white">
      {/* Desktop top nav */}
      <header className="hidden sm:block sticky top-0 z-20 bg-[#0B0E13]/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-6">
          <p className="text-sm font-semibold tracking-tight text-white">FinAuzi</p>
          <div className="flex items-center gap-1 ml-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = active === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => onChange(tab.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/[0.06] text-white'
                      : 'text-white/40 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.3 : 2} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <BottomNav active={active} onChange={onChange} />
    </div>
  )
}
