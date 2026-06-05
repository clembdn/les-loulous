import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { getPerson } from '@/shared/config/people.js'
import { cn } from '@/shared/lib/utils.js'

const REVEAL = 96    // distance max révélée en glissant
const TRIGGER = 60   // seuil au-delà duquel l'article est coché

// Ligne d'article : glisser vers la gauche pour cocher (mobile/tactile),
// ou cliquer la pastille (desktop / accessibilité). Tap sur le nom = éditer.
export default function ItemRow({ item, onToggle, onEdit }) {
  const person = getPerson(item.createdBy)
  const swipeable = !item.checked

  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef(null)   // { x, y } au pointerdown
  const axis = useRef(null)    // 'h' (on prend la main) | 'v' (on laisse scroller)
  const dxRef = useRef(0)
  const moved = useRef(false)  // un vrai glissement a eu lieu → on avale le click

  function onPointerDown(e) {
    if (!swipeable) return
    start.current = { x: e.clientX, y: e.clientY }
    axis.current = null
    moved.current = false
  }
  function onPointerMove(e) {
    if (!start.current) return
    const ddx = e.clientX - start.current.x
    const ddy = e.clientY - start.current.y
    if (!axis.current) {
      if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return
      axis.current = Math.abs(ddx) > Math.abs(ddy) ? 'h' : 'v'
      if (axis.current === 'h') {
        setDragging(true)
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* noop */ }
      }
    }
    if (axis.current !== 'h') return
    moved.current = true
    const next = Math.max(-REVEAL, Math.min(0, ddx)) // uniquement vers la gauche
    dxRef.current = next
    setDx(next)
  }
  function settle() {
    const validated = dxRef.current <= -TRIGGER
    setDragging(false)
    setDx(0)
    dxRef.current = 0
    start.current = null
    axis.current = null
    if (validated) onToggle(item)
  }
  function cancel() {
    setDragging(false)
    setDx(0)
    dxRef.current = 0
    start.current = null
    axis.current = null
  }

  return (
    <div className="relative overflow-hidden">
      {swipeable && (
        <div className="absolute inset-0 flex items-center justify-end gap-1.5 pr-5 bg-accent text-accent-fg pointer-events-none">
          <Check size={16} strokeWidth={3} />
          <span className="text-sm font-medium">Fait</span>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { if (start.current) settle() }}
        onPointerCancel={cancel}
        onClickCapture={(e) => { if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false } }}
        style={{ transform: `translateX(${dx}px)`, touchAction: 'pan-y' }}
        className={cn('relative flex items-center gap-3 py-2.5 bg-bg', !dragging && 'transition-transform duration-200')}
      >
        <button
          onClick={() => onToggle(item)}
          aria-label={item.checked ? 'Décocher' : 'Cocher'}
          className={cn(
            'h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition',
            item.checked
              ? 'bg-accent border-accent text-accent-fg'
              : 'border-border-strong text-transparent hover:border-accent',
          )}
        >
          <Check size={14} strokeWidth={3} />
        </button>
        <button onClick={() => onEdit(item)} className="flex-1 min-w-0 text-left">
          <div>
            <span className={cn('text-[15px] text-fg', item.checked && 'line-through text-faint')}>
              {item.name}
            </span>
            {item.quantityLabel && <span className="ml-2 text-sm text-muted">{item.quantityLabel}</span>}
          </div>
          {item.note && <p className="text-xs text-faint truncate">{item.note}</p>}
        </button>
        {person && (
          <span
            className={cn('h-2 w-2 rounded-full shrink-0', person.dotClass)}
            title={`Ajouté par ${person.label}`}
          />
        )}
      </div>
    </div>
  )
}
