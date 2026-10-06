import { useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { tick } from '@/shared/lib/haptics.js'
import { getCategory } from '../../config/categories.js'

const ROW = 60 // hauteur d'une ligne, px : le doigt avance d'une ligne tous les 60 px

/**
 * Le mode « Réorganiser » du téléphone : les étapes seules, chacune avec sa
 * poignée, qu'on fait glisser du doigt (pointer events, sans bibliothèque).
 * L'ordre change à l'écran tout de suite ; il est enregistré en une fois en
 * sortant du mode (« Terminé »), par le parent.
 *
 * `stops` : les étapes du jour dans l'ordre courant ; `onChange(ids)`.
 */
export default function ReorderList({ stops, onChange }) {
  const [drag, setDrag] = useState(null) // { id, from, startY, dy }
  const lastTarget = useRef(null)

  const target = drag ? clamp(drag.from + Math.round(drag.dy / ROW), 0, stops.length - 1) : null
  const shown = drag ? move(stops, drag.from, target) : stops

  function start(e, index) {
    e.currentTarget.setPointerCapture(e.pointerId)
    lastTarget.current = index
    setDrag({ id: stops[index].id, from: index, startY: e.clientY, dy: 0 })
  }

  function moveTo(e) {
    if (!drag) return
    const dy = e.clientY - drag.startY
    const next = clamp(drag.from + Math.round(dy / ROW), 0, stops.length - 1)
    if (next !== lastTarget.current) {
      lastTarget.current = next
      tick()
    }
    setDrag((d) => ({ ...d, dy }))
  }

  function end() {
    if (!drag) return
    if (target !== drag.from) onChange(move(stops, drag.from, target).map((s) => s.id))
    setDrag(null)
  }

  // Clavier : la poignée a le focus, ↑ ↓ déplacent l'étape d'un cran.
  function onKeyDown(e, index) {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    if (!delta) return
    e.preventDefault()
    const to = clamp(index + delta, 0, stops.length - 1)
    if (to !== index) onChange(move(stops, index, to).map((s) => s.id))
  }

  return (
    <ol className="select-none" aria-label="Ordre des étapes">
      {shown.map((stop, i) => {
        const dragging = drag?.id === stop.id
        // La ligne tenue suit le doigt ; les autres ont déjà pris leur nouvelle place.
        const offset = dragging ? drag.dy - (target - drag.from) * ROW : 0
        const category = getCategory(stop.category)
        const index = stops.findIndex((s) => s.id === stop.id)
        return (
          <li
            key={stop.id}
            style={{ height: ROW, transform: offset ? `translateY(${offset}px)` : undefined }}
            className={cn(
              'relative flex items-center gap-3 px-3 rounded-xl bg-surface',
              dragging ? 'z-10 shadow-[0_8px_24px_rgb(17_20_27/0.18)] scale-[1.02]' : 'transition-transform',
            )}
          >
            <span
              className="h-[26px] w-[26px] shrink-0 rounded-full flex items-center justify-center font-mono text-[12px] font-semibold text-white"
              style={{ backgroundColor: category.color }}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-fg truncate">{stop.name}</span>
              <span className="block text-[13px] text-muted">{stop.time || 'Sans heure'}</span>
            </span>
            <button
              type="button"
              aria-label={`Déplacer « ${stop.name} » (flèches haut et bas)`}
              onPointerDown={(e) => start(e, index)}
              onPointerMove={moveTo}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={(e) => onKeyDown(e, index)}
              className="h-12 w-12 -mr-2 shrink-0 flex items-center justify-center text-muted touch-none cursor-grab active:cursor-grabbing"
            >
              <GripVertical size={22} />
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function move(list, from, to) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
