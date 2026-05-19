import { useCurrency } from '../../context/CurrencyContext.jsx'

export default function CurrencyToggle() {
  const { code, setCode } = useCurrency()

  return (
    <div className="inline-flex p-0.5 rounded-lg bg-bg-card border border-border-subtle">
      {['EUR', 'AUD'].map((c) => (
        <button
          key={c}
          onClick={() => setCode(c)}
          className={`relative px-3 h-8 rounded-md text-xs font-semibold tracking-wide transition-colors ${
            code === c
              ? 'bg-brand text-white shadow-glow'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
