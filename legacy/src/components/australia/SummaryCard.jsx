export default function SummaryCard({ icon: Icon, label, value, subtitle, status = 'neutral', className = '' }) {
  const statusStyles = {
    green: 'border-success/20 bg-success/5',
    red: 'border-danger/20 bg-danger/5',
    orange: 'border-warning/20 bg-warning/5',
    neutral: 'border-border-subtle',
  }

  const valueStyles = {
    green: 'text-success',
    red: 'text-danger',
    orange: 'text-warning',
    neutral: 'text-text-primary',
  }

  return (
    <div className={`card ${statusStyles[status] || statusStyles.neutral} ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="h-4 w-4 text-text-muted" />}
        <p className="stat-label">{label}</p>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${valueStyles[status] || valueStyles.neutral}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-text-muted mt-1">{subtitle}</p>
      )}
    </div>
  )
}
