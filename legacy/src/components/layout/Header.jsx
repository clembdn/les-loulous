import { Menu } from 'lucide-react'
import { useCurrency } from '../../context/CurrencyContext.jsx'
import CurrencyToggle from '../ui/CurrencyToggle.jsx'

export default function Header({ onOpenMobile }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg-base/70 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          onClick={onOpenMobile}
          className="lg:hidden rounded-md p-2 text-text-secondary hover:bg-bg-hover"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-baseline gap-3 min-w-0 flex-1">
          <span className="text-lg font-semibold tracking-tight">FinAuzi</span>
          <span className="text-xs text-text-muted hidden sm:inline">Notre trésorerie pour l'Australie</span>
        </div>

        <CurrencyToggle />
      </div>
    </header>
  )
}
