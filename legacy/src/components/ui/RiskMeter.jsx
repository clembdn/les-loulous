export default function RiskMeter({ level }) {
  const segments = Array.from({ length: 7 }, (_, i) => i + 1)
  const colorFor = (i) => {
    if (i > level) return 'bg-border-subtle'
    if (level <= 2) return 'bg-success'
    if (level <= 4) return 'bg-warning'
    return 'bg-danger'
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {segments.map((i) => (
          <span
            key={i}
            className={`h-1.5 w-3 rounded-sm ${colorFor(i)}`}
          />
        ))}
      </div>
      <span className="text-xs text-text-muted tabular-nums">{level}/7</span>
    </div>
  )
}
