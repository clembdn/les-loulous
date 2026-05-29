import { useState } from 'react'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Popover, PopoverTrigger, PopoverContent } from './popover.jsx'
import { Calendar } from './calendar.jsx'
import { cn } from '@/shared/lib/utils.js'

function isoToDate(iso) {
  if (!iso) return undefined
  return parseISO(iso)
}

function dateToIso(d) {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Date picker producing an ISO string (YYYY-MM-DD) for back-compat with current
 * Firestore data and `<input type="date">` call sites.
 *
 * Props:
 *   value: 'YYYY-MM-DD' | ''
 *   onChange: (iso: string) => void
 *   placeholder: string
 *   clearable: bool (show ✕ to set empty)
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Choisir une date',
  clearable = false,
  className,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const selected = isoToDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white transition',
            'hover:bg-white/[0.06] hover:border-white/20',
            'focus:outline-none focus:border-white/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            !selected && 'text-white/40',
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon size={14} className="text-white/40 flex-shrink-0" />
            <span className="truncate">
              {selected ? format(selected, 'd MMMM yyyy', { locale: fr }) : placeholder}
            </span>
          </span>
          {clearable && selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange('') }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault(); e.stopPropagation(); onChange('')
                }
              }}
              className="text-white/30 hover:text-white/70 transition"
              aria-label="Effacer la date"
            >
              <X size={14} />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(dateToIso(d))
              setOpen(false)
            }
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
