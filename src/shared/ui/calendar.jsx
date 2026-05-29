import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fr } from 'date-fns/locale'
import { cn } from '@/shared/lib/utils.js'

// FinAuzi-themed calendar built on react-day-picker v9.
export function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      locale={fr}
      showOutsideDays={showOutsideDays}
      className={cn('p-3 select-none relative', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'flex flex-col gap-3',
        month_caption: 'flex items-center justify-center pt-1 relative',
        caption_label: 'text-sm font-medium text-white capitalize',
        nav: 'flex items-center gap-1 absolute right-1 top-1 z-10',
        button_previous: cn(
          'h-7 w-7 inline-flex items-center justify-center rounded-md text-white/60',
          'hover:bg-white/10 hover:text-white transition disabled:opacity-30',
        ),
        button_next: cn(
          'h-7 w-7 inline-flex items-center justify-center rounded-md text-white/60',
          'hover:bg-white/10 hover:text-white transition disabled:opacity-30',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-white/30 rounded-md w-9 h-8 inline-flex items-center justify-center text-[11px] font-normal uppercase',
        week: 'flex w-full mt-1',
        day: 'h-9 w-9 p-0 text-center text-sm relative focus-within:relative focus-within:z-20',
        day_button: cn(
          'h-9 w-9 inline-flex items-center justify-center rounded-md text-sm font-normal text-white/80',
          'hover:bg-white/10 hover:text-white transition',
          'focus:outline-none focus:ring-1 focus:ring-white/40',
        ),
        selected:
          '[&>button]:bg-white [&>button]:text-black [&>button]:font-medium [&>button]:hover:bg-white [&>button]:hover:text-black',
        today: '[&>button]:ring-1 [&>button]:ring-white/30',
        outside: '[&>button]:text-white/20',
        disabled: '[&>button]:text-white/15 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left'
            ? <ChevronLeft size={16} />
            : <ChevronRight size={16} />,
      }}
      {...props}
    />
  )
}
