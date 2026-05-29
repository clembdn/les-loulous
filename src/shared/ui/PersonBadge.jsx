import { getPerson } from '@/shared/config/people.js'

export default function PersonBadge({ uid, size = 'sm' }) {
  const person = getPerson(uid)
  if (!person) return null

  const sizes = {
    xs: { dot: 'h-1.5 w-1.5', text: 'text-[10px]' },
    sm: { dot: 'h-2 w-2', text: 'text-xs' },
    md: { dot: 'h-2.5 w-2.5', text: 'text-sm' },
  }
  const s = sizes[size] || sizes.sm

  return (
    <span className={`inline-flex items-center gap-1.5 ${person.textClass}`}>
      <span className={`${s.dot} rounded-full ${person.dotClass}`} />
      <span className={`${s.text} font-medium`}>{person.label}</span>
    </span>
  )
}
