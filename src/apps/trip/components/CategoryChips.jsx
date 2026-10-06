import { useEffect, useRef } from 'react'
import { cn } from '@/shared/lib/utils.js'
import { STOP_CATEGORIES } from '../config/categories.js'

/**
 * Le choix de la catégorie d'une étape, en couleur : la puce choisie prend
 * la couleur de la pastille qu'aura l'étape dans la frise et sur la carte.
 *
 * `layout` : `grid` (fiche d'une étape) ou `row`, une rangée qui défile
 * (écran de partage).
 */
export default function CategoryChips({ value, onChange, layout = 'grid' }) {
  // En rangée, la catégorie choisie (souvent devinée) doit être visible.
  const row = useRef(null)
  useEffect(() => {
    if (layout !== 'row') return
    const active = row.current?.querySelector('[aria-pressed="true"]')
    if (active) row.current.scrollLeft = active.offsetLeft - row.current.clientWidth / 2 + active.clientWidth / 2
  }, [layout, value])

  return (
    <div
      ref={row}
      className={layout === 'grid'
        ? 'grid grid-cols-3 sm:grid-cols-5 gap-1.5'
        : '-mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar'}
    >
      {STOP_CATEGORIES.map((c) => {
        const Icon = c.icon
        const active = value === c.id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={active}
            style={active ? { backgroundColor: c.color, borderColor: c.color } : undefined}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 border transition',
              layout === 'grid' ? 'h-11 rounded-xl text-[13px]' : 'shrink-0 h-9 px-3 rounded-full text-[13px]',
              active ? 'text-white font-semibold' : 'border-border bg-surface text-fg hover:border-border-strong',
            )}
          >
            <Icon size={15} style={active ? undefined : { color: c.color }} /> {c.label}
          </button>
        )
      })}
    </div>
  )
}
