import { useMemo, useRef, useState, useEffect, useId } from 'react'

// Courbe SVG minimaliste, sans dépendance : une série, un axe Y implicite
// (min/max annotés), scrub tactile. Suffit pour une progression de charge ou
// une courbe de poids — pas de grille, pas de librairie de 200 ko.

const PAD_TOP = 14
const PAD_BOTTOM = 22
const PAD_X = 8

// Tangentes monotones (Fritsch–Carlson) : la courbe ne dépasse jamais ses
// points, contrairement à une spline cardinale.
function monotoneTangents(pts) {
  const n = pts.length
  const m = new Array(n).fill(0)
  if (n < 2) return m
  const d = []
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x || 1e-6
    d.push((pts[i + 1].y - pts[i].y) / dx)
  }
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * d[i]
      m[i + 1] = t * b * d[i]
    }
  }
  return m
}

function curvePath(pts) {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`
  const m = monotoneTangents(pts)
  let path = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3
    path += `C${pts[i].x + dx},${pts[i].y + m[i] * dx} ${pts[i + 1].x - dx},${pts[i + 1].y - m[i + 1] * dx} ${pts[i + 1].x},${pts[i + 1].y}`
  }
  return path
}

export default function LineChart({ data, height = 220, formatValue = String, formatLabel = String }) {
  const gradientId = useId().replace(/:/g, '')
  const containerRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [hoverIdx, setHoverIdx] = useState(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const { pts, min, max } = useMemo(() => {
    if (!width || !data?.length) return { pts: [], min: 0, max: 0 }
    const values = data.map((d) => d.value)
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const flat = hi === lo
    const usableH = height - PAD_TOP - PAD_BOTTOM
    const usableW = Math.max(width - PAD_X * 2, 1)
    const step = data.length > 1 ? usableW / (data.length - 1) : 0
    return {
      min: lo,
      max: hi,
      pts: data.map((d, i) => ({
        x: PAD_X + (data.length > 1 ? i * step : usableW / 2),
        // Série plate : la ligne reste au milieu plutôt que collée en haut.
        y: flat
          ? PAD_TOP + usableH / 2
          : PAD_TOP + usableH * (1 - (d.value - lo) / (hi - lo)),
        d,
        i,
      })),
    }
  }, [data, width, height])

  if (!data?.length) return null

  const path = curvePath(pts)
  const areaPath = pts.length > 1
    ? `${path} L${pts[pts.length - 1].x},${height - PAD_BOTTOM} L${pts[0].x},${height - PAD_BOTTOM} Z`
    : ''
  // Au premier rendu la largeur n'est pas encore mesurée : le conteneur doit
  // quand même être monté pour que le ResizeObserver s'y accroche.
  const active = pts.length > 0 ? (pts[hoverIdx] || pts[pts.length - 1]) : null

  const pick = (clientX) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || pts.length === 0) return
    const x = clientX - rect.left
    let best = 0
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i].x - x) < Math.abs(pts[best].x - x)) best = i
    }
    setHoverIdx(best)
  }

  return (
    <div className="select-none">
      <div className="mb-2 min-h-[2.75rem]">
        {active && (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-2xl font-semibold text-fg tabular">{formatValue(active.d.value)}</span>
              <span className="text-xs text-muted">{formatLabel(active.d)}</span>
            </div>
            {/* Les bornes sont annoncées ici plutôt que posées sur le tracé :
                dans le graphe elles tombent pile sur les points extrêmes. */}
            {min !== max && (
              <p className="text-[11px] text-faint tabular mt-0.5">
                min {formatValue(min)} · max {formatValue(max)}
              </p>
            )}
          </>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative touch-pan-y"
        style={{ height }}
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
        onTouchEnd={() => setHoverIdx(null)}
      >
        {active && (
          <>
            <svg width="100%" height={height} className="overflow-visible block">
              <defs>
                <linearGradient id={`grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
                </linearGradient>
              </defs>

              {areaPath && <path d={areaPath} fill={`url(#grad-${gradientId})`} className="chart-area" />}
              <path
                d={path}
                fill="none"
                stroke="rgb(var(--accent))"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                className="chart-line"
              />

              {/* Points visibles quand la série est courte — une progression se
                  compte en séances, pas en milliers de ticks. */}
              {pts.length <= 30 && pts.map((p) => (
                <circle key={p.i} cx={p.x} cy={p.y} r="3" fill="rgb(var(--bg))" stroke="rgb(var(--accent))" strokeWidth="2" />
              ))}

              {hoverIdx != null && (
                <line
                  x1={active.x} y1={PAD_TOP - 6} x2={active.x} y2={height - PAD_BOTTOM}
                  stroke="rgb(var(--fg) / 0.18)" strokeWidth="1"
                />
              )}
              <circle cx={active.x} cy={active.y} r="5" fill="rgb(var(--accent))" stroke="rgb(var(--bg))" strokeWidth="2.5" />
            </svg>

            <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-faint pointer-events-none">
              <span>{formatLabel(data[0])}</span>
              {data.length > 1 && <span>{formatLabel(data[data.length - 1])}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
