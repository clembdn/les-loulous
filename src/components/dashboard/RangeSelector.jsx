export const RANGES = [
  { id: '1M',   label: '1M',  mode: 'past',   pastMonths: 1 },
  { id: '3M',   label: '3M',  mode: 'past',   pastMonths: 3 },
  { id: '6M',   label: '6M',  mode: 'past',   pastMonths: 6 },
  { id: '1A',   label: '1A',  mode: 'past',   pastMonths: 12 },
  { id: 'ALL',  label: 'Tout', mode: 'all' },
  { id: 'FWD',  label: 'Prévision', mode: 'future' },
]

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
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

export function getRangeById(id) {
  return RANGES.find((r) => r.id === id) || RANGES[2] // default to 6M
}
