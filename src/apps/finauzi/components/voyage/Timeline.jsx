import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Plus, MapPin } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAppData } from '../../context/AppDataContext.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { seedTimelineSuggestions } from '../../services/timelineService.js'
import { toast } from '@/shared/ui/sonner.jsx'
import TimelineAddModal from './TimelineAddModal.jsx'
import { cn } from '@/shared/lib/utils.js'

// ─── Layout constants ────────────────────────────────────────────────────
const DAY_MS = 86_400_000
const LEAD_DAYS = 7         // initial view starts this many days before today
const PX_PER_DAY_H = 5      // horizontal density (desktop) — px per real day
const PX_PER_DAY_V = 3       // vertical density (mobile) — tighter so scroll stays short
const START_PAD_H = 80       // horizontal: padding before first item so cards don't clip
const END_PAD_H = 80
const START_PAD_V = 40       // vertical: smaller padding (narrower viewport)
const END_PAD_V = 40
const TRACK_HEIGHT_H = 340   // desktop panel height
const MAX_HEIGHT_V = '68vh'  // mobile scrollable region

export default function Timeline() {
  const { timeline, isTimelineLoading } = useAppData()
  const { currentUser } = useAuth()
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)

  const items = useMemo(
    () => [...timeline].sort((a, b) => a.date.localeCompare(b.date)),
    [timeline],
  )

  // Écriture optimiste : l'UI est mise à jour par le cache local, fonctionne hors-ligne.
  function onSeed() {
    seedTimelineSuggestions(currentUser?.uid)
      .catch((err) => toast.error(err.message || 'Erreur d\'initialisation'))
    toast.success('Timeline initialisée')
  }

  const openAdd = () => { setEditing(null); setAdding(true) }
  const openEdit = (item) => { setEditing(item); setAdding(true) }
  const closeModal = () => { setAdding(false); setEditing(null) }

  if (isTimelineLoading) {
    return (
      <div className="py-12 flex justify-center">
        <span className="h-5 w-5 border-2 border-white/15 border-t-white/80 rounded-full animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return <EmptyState onSeed={onSeed} onAddManually={openAdd} />
  }

  return (
    <>
      {/* Mobile — vertical orientation, in-page width */}
      <div className="lg:hidden">
        <TimelineCanvas items={items} orientation="vertical" onEdit={openEdit} />
        <AddButton onAdd={openAdd} className="mt-3 w-full" />
      </div>

      {/* Desktop — horizontal orientation, fits within the page container; horizontal scroll happens inside the canvas */}
      <div className="hidden lg:block">
        <TimelineCanvas items={items} orientation="horizontal" onEdit={openEdit} />
        <div className="mt-4 flex justify-end">
          <AddButton onAdd={openAdd} />
        </div>
      </div>

      <TimelineAddModal
        open={adding}
        onClose={closeModal}
        existing={editing}
        currentUid={currentUser?.uid}
      />
    </>
  )
}

// ─── Shared canvas ──────────────────────────────────────────────────────
// Renders the same component in two orientations. All positioning is
// day-proportional: every pixel along the track maps to a real day,
// so the "today" marker naturally lands between two events at the
// correct ratio (e.g. May 23 sits at 8/15 between May 15 and May 30).

function TimelineCanvas({ items, orientation, onEdit }) {
  const isH = orientation === 'horizontal'
  const scrollRef = useRef(null)
  const initialized = useRef(false)
  const startPad = isH ? START_PAD_H : START_PAD_V
  const endPad = isH ? END_PAD_H : END_PAD_V

  const pxPerDay = isH ? PX_PER_DAY_H : PX_PER_DAY_V
  const layout = useMemo(() => computeLayout(items, pxPerDay), [items, pxPerDay])

  // Place "today − 7 days" at the leading edge of the scrollable viewport on mount.
  useLayoutEffect(() => {
    if (initialized.current || !scrollRef.current || layout.totalPx === 0) return
    const target = layout.initialScroll + startPad
    if (isH) scrollRef.current.scrollLeft = target
    else scrollRef.current.scrollTop = target
    initialized.current = true
  }, [isH, layout.initialScroll, layout.totalPx, startPad])

  const innerStyle = isH
    ? { width: layout.totalPx + startPad + endPad, height: TRACK_HEIGHT_H }
    : { height: layout.totalPx + startPad + endPad, width: '100%' }

  const offsetPos = (p) => p + startPad

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent">
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />

      <div
        ref={scrollRef}
        className={cn(
          'relative',
          isH ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto overflow-x-hidden',
        )}
        style={isH ? undefined : { maxHeight: MAX_HEIGHT_V }}
      >
        <div className="relative" style={innerStyle}>
          {/* Background track */}
          <div
            className={cn(
              'absolute rounded-full bg-white/[0.07]',
              isH
                ? 'top-1/2 left-0 right-0 h-[3px] -translate-y-1/2'
                : 'left-1/2 top-0 bottom-0 w-[3px] -translate-x-1/2',
            )}
          />

          {/* Past portion */}
          <div
            className={cn(
              'absolute rounded-full',
              isH
                ? 'top-1/2 left-0 h-[3px] -translate-y-1/2'
                : 'left-1/2 top-0 w-[3px] -translate-x-1/2',
            )}
            style={{
              [isH ? 'width' : 'height']: offsetPos(layout.todayPos),
              background: isH
                ? 'linear-gradient(90deg, rgba(34,211,238,0.85), rgba(16,185,129,0.85))'
                : 'linear-gradient(180deg, rgba(34,211,238,0.85), rgba(16,185,129,0.85))',
              boxShadow: '0 0 22px rgba(34,211,238,0.35)',
            }}
          />

          {/* Today marker — proportional to days, not snapped to events */}
          <TodayMarker orientation={orientation} pos={offsetPos(layout.todayPos)} />

          {/* Event milestones */}
          {layout.positioned.map((item, idx) => (
            <MilestoneNode
              key={item.id}
              item={item}
              orientation={orientation}
              side={idx % 2 === 0 ? 'a' : 'b'}
              pos={offsetPos(item.pos)}
              onEdit={onEdit}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function computeLayout(items, pxPerDay) {
  if (items.length === 0) {
    return { positioned: [], todayPos: 0, totalPx: 0, initialScroll: 0 }
  }
  const todayMs = startOfDay(new Date())
  const itemMs = items.map((it) => parseISO(it.date).getTime())
  const firstMs = Math.min(...itemMs)
  const lastMs = Math.max(...itemMs)

  // Content always covers from (oldest of: first event, today − 7d) to (newest of: last event, today + 7d).
  // This guarantees there's always something to scroll back to if older events exist.
  const startMs = Math.min(firstMs, todayMs - LEAD_DAYS * DAY_MS)
  const endMs = Math.max(lastMs, todayMs + LEAD_DAYS * DAY_MS)

  const posFor = (ms) => ((ms - startMs) / DAY_MS) * pxPerDay

  const positioned = items.map((it, i) => ({
    ...it,
    ts: itemMs[i],
    pos: posFor(itemMs[i]),
    isPast: itemMs[i] < todayMs,
  }))

  return {
    positioned,
    todayPos: posFor(todayMs),
    totalPx: posFor(endMs),
    initialScroll: Math.max(0, posFor(todayMs - LEAD_DAYS * DAY_MS)),
  }
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function TodayMarker({ orientation, pos }) {
  const isH = orientation === 'horizontal'
  return (
    <div
      className={cn(
        'absolute z-30',
        isH ? 'top-1/2 -translate-y-1/2 -translate-x-1/2' : 'left-1/2 -translate-x-1/2 -translate-y-1/2',
      )}
      style={isH ? { left: pos } : { top: pos }}
    >
      <span className="absolute inset-0 -m-2 rounded-full bg-emerald-400/30 animate-ping" aria-hidden />
      <span className="relative block h-5 w-5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/25 shadow-[0_0_22px_rgba(52,211,153,0.7)]" />
      <span
        className={cn(
          'absolute text-[10px] uppercase tracking-[0.18em] font-bold text-emerald-400 whitespace-nowrap',
          isH ? 'top-7 left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2 left-8',
        )}
      >
        Aujourd'hui
      </span>
    </div>
  )
}

function MilestoneNode({ item, orientation, side, pos, onEdit }) {
  const isH = orientation === 'horizontal'
  // side 'a' = primary side (above for horizontal, left for vertical)
  // side 'b' = opposite side. Alternating idx parity gives the zigzag.

  return (
    <button
      type="button"
      onClick={() => onEdit(item)}
      className={cn(
        'absolute group focus:outline-none z-10',
        isH ? 'top-1/2 -translate-y-1/2 -translate-x-1/2' : 'left-1/2 -translate-x-1/2 -translate-y-1/2',
      )}
      style={isH ? { left: pos } : { top: pos }}
    >
      {/* Connector */}
      <span
        className={cn(
          'absolute transition',
          isH
            ? `left-1/2 -translate-x-1/2 w-px ${side === 'a' ? 'bottom-3 h-14' : 'top-3 h-14'}`
            : `top-1/2 -translate-y-1/2 h-px ${side === 'a' ? 'right-3 w-10' : 'left-3 w-10'}`,
          item.isPast ? 'bg-cyan-400/40' : 'bg-white/15',
        )}
        aria-hidden
      />

      {/* Dot */}
      <span
        className={cn(
          'relative block h-4 w-4 rounded-full ring-4 transition group-hover:scale-125',
          item.isPast
            ? 'bg-cyan-400 ring-cyan-400/25 shadow-[0_0_14px_rgba(34,211,238,0.6)]'
            : 'bg-[#11151C] border border-white/30 ring-white/[0.04]',
        )}
      />

      {/* Card */}
      <div
        className={cn(
          'absolute rounded-xl text-left transition border bg-[#0F141B]/95 backdrop-blur-sm',
          isH
            ? `left-1/2 -translate-x-1/2 w-44 px-3.5 py-2.5 ${side === 'a' ? 'bottom-[4.25rem]' : 'top-[4.25rem]'}`
            : `top-1/2 -translate-y-1/2 w-32 px-3 py-2.5 ${side === 'a' ? 'right-[3.25rem]' : 'left-[3.25rem]'}`,
          item.isPast
            ? 'border-cyan-500/25 group-hover:border-cyan-400/60 group-hover:shadow-[0_8px_30px_rgba(34,211,238,0.18)]'
            : 'border-white/10 group-hover:border-white/30 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]',
        )}
      >
        <p
          className={cn(
            'flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] font-semibold capitalize mb-0.5',
            item.isPast ? 'text-cyan-400/90' : 'text-white/40',
          )}
        >
          <MapPin size={9} strokeWidth={2.4} />
          {formatDayShort(item.date)}
        </p>
        <p
          className={cn(
            'text-sm font-semibold leading-snug',
            item.isPast ? 'text-white/85' : 'text-white',
          )}
        >
          {item.label}
        </p>
        {item.description && (
          <p className="text-[11px] text-white/40 mt-1 line-clamp-2 leading-snug">
            {item.description}
          </p>
        )}
      </div>
    </button>
  )
}

function AddButton({ onAdd, className }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition',
        className,
      )}
    >
      <Plus size={13} strokeWidth={2.4} />
      Ajouter un jalon
    </button>
  )
}

function formatDayShort(iso) {
  try {
    return format(parseISO(iso), 'd MMM yyyy', { locale: fr })
  } catch {
    return iso
  }
}

function EmptyState({ onSeed, onAddManually }) {
  return (
    <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-8 text-center">
      <div className="h-12 w-12 mx-auto rounded-full bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-4">
        <Sparkles size={20} strokeWidth={2} />
      </div>
      <p className="text-sm font-medium text-white mb-1">Aucun jalon pour l'instant</p>
      <p className="text-xs text-white/40 mb-6 max-w-sm mx-auto">
        Pose les grandes étapes de l'année : visa, vol, école, road trip, retour…
        Tu pourras tout modifier ensuite.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-sm mx-auto">
        <button
          type="button"
          onClick={onSeed}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition"
        >
          <Sparkles size={14} />
          Initialiser avec les suggestions
        </button>
        <button
          type="button"
          onClick={onAddManually}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm font-medium hover:bg-white/[0.06] transition"
        >
          <Plus size={14} />
          Ajouter un jalon
        </button>
      </div>
    </div>
  )
}
