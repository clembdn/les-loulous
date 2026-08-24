import { RANGES } from '../../config/ranges.js'

export default function RangeSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 py-1">
      {RANGES.map((r) => {
        const active = r.id === value
        return (
          <button
            key={r.id}
            onClick={() => onChange(r.id)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition ${
              active
                ? 'bg-white text-black'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
            aria-pressed={active}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
