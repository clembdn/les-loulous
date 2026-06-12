import { useMemo, useRef, useState, useEffect, useId } from 'react'

// Trade Republic-inspired minimalist chart — pure SVG, no chart library.
// - no axes, no grid; smooth monotone curve with a soft gradient fill
// - color = green if last >= first, red otherwise (or `accent` override)
// - past = solid + filled, future = dashed line
// - scrub (mouse or touch): vertical line + dot, point pushed to parent via onHover
// - draw-in animation on mount / data change, pulsing dot on the latest point

const PAD_TOP = 10
const PAD_BOTTOM = 4

// Monotone cubic tangents (Fritsch–Carlson) → the curve never overshoots,
// same look as d3's curveMonotoneX used by Trade Republic-style charts.
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
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  }
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

export default function TradeChart({
  data,
  height = 280,
  accent,
  onHover,
  baselineIndex,
  departureTimestamp,
}) {
  const uid = useId().replace(/:/g, '')
  const containerRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [hoverIdx, setHoverIdx] = useState(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const lineColor = useMemo(() => {
    if (accent) return accent
    if (!data || data.length < 2) return '#9AA3B2'
    return data[data.length - 1].balance >= data[0].balance ? '#22C55E' : '#EF4444'
  }, [data, accent])

  const geom = useMemo(() => {
    if (!data || data.length === 0 || width <= 0) return null
    const t0 = data[0].timestamp
    const t1 = data[data.length - 1].timestamp
    const tSpan = t1 - t0 || 1
    const values = data.map((d) => d.balance)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || Math.abs(max) || 1
    const yMin = min - span * 0.12
    const yMax = max + span * 0.12
    const innerH = height - PAD_TOP - PAD_BOTTOM
    const x = (t) => ((t - t0) / tSpan) * width
    const y = (v) => PAD_TOP + (1 - (v - yMin) / (yMax - yMin)) * innerH

    const pts = data.map((d) => ({ x: x(d.timestamp), y: y(d.balance) }))
    const firstFutureIdx = data.findIndex((d) => d.isFuture)
    const hasFuture = firstFutureIdx >= 0
    // Past curve includes nothing if everything is future; future curve starts
    // one point early so the two segments connect seamlessly.
    const pastPts = hasFuture ? pts.slice(0, firstFutureIdx) : pts
    const futurePts = hasFuture ? pts.slice(Math.max(firstFutureIdx - 1, 0)) : []

    const pastPath = curvePath(pastPts)
    const futurePath = curvePath(futurePts)
    const areaPath = pastPts.length >= 2
      ? `${pastPath}L${pastPts[pastPts.length - 1].x},${height}L${pastPts[0].x},${height}Z`
      : ''

    return { pts, x, y, pastPath, futurePath, areaPath, pastPts, hasFuture }
  }, [data, width, height])

  // Identity of the rendered series — re-keys the paths so the draw-in
  // animation replays when the range / account view changes.
  const seriesKey = useMemo(() => {
    if (!data || data.length === 0) return 'empty'
    return `${data.length}-${data[0].timestamp}-${data[data.length - 1].timestamp}-${data[data.length - 1].balance}`
  }, [data])

  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-white/30 text-xs">
        Pas encore de données.
      </div>
    )
  }

  function indexFromClientX(clientX) {
    if (!geom) return null
    const rect = containerRef.current.getBoundingClientRect()
    const px = clientX - rect.left
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < geom.pts.length; i++) {
      const dist = Math.abs(geom.pts[i].x - px)
      if (dist < bestDist) { bestDist = dist; best = i }
    }
    return best
  }

  function handleMove(e) {
    const idx = indexFromClientX(e.clientX)
    if (idx == null || idx === hoverIdx) return
    setHoverIdx(idx)
    onHover?.(data[idx])
  }

  function handleLeave() {
    setHoverIdx(null)
    onHover?.(null)
  }

  const hover = hoverIdx != null && geom ? geom.pts[hoverIdx] : null
  const lastPast = geom && geom.pastPts.length > 0 ? geom.pastPts[geom.pastPts.length - 1] : null
  const depX = geom
    && typeof departureTimestamp === 'number'
    && departureTimestamp >= data[0].timestamp
    && departureTimestamp <= data[data.length - 1].timestamp
    ? geom.x(departureTimestamp)
    : null

  return (
    <div
      ref={containerRef}
      style={{ height, touchAction: 'pan-y' }}
      className="w-full relative select-none cursor-crosshair"
      onPointerMove={handleMove}
      onPointerDown={handleMove}
      onPointerLeave={handleLeave}
    >
      {geom && (
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Baseline (start-of-range reference) */}
          {typeof baselineIndex === 'number' && data[baselineIndex] && (
            <line
              x1="0" x2={width}
              y1={geom.y(data[baselineIndex].balance)}
              y2={geom.y(data[baselineIndex].balance)}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          )}

          {/* Departure marker */}
          {depX != null && (
            <g>
              <line
                x1={depX} x2={depX} y1={PAD_TOP - 4} y2={height}
                stroke="rgba(34,211,238,0.45)" strokeWidth="1" strokeDasharray="3 3"
              />
              <text
                x={depX - 6} y={PAD_TOP + 4}
                textAnchor="end"
                fill="rgba(34,211,238,0.85)"
                fontSize="10" fontWeight="600"
              >
                Départ
              </text>
            </g>
          )}

          {/* Past — gradient area + solid curve (draw-in animation) */}
          {geom.areaPath && (
            <path key={`a-${seriesKey}`} d={geom.areaPath} fill={`url(#g-${uid})`} className="chart-area" />
          )}
          {geom.pastPath && geom.pastPts.length >= 2 && (
            <path
              key={`p-${seriesKey}`}
              d={geom.pastPath}
              fill="none"
              stroke={lineColor}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              className="chart-line"
            />
          )}

          {/* Future — dashed curve */}
          {geom.hasFuture && geom.futurePath && (
            <path
              key={`f-${seriesKey}`}
              d={geom.futurePath}
              fill="none"
              stroke={lineColor}
              strokeWidth="1.6"
              strokeDasharray="4 4"
              strokeLinecap="round"
              className="chart-area"
            />
          )}

          {/* Live pulse on the latest real point (hidden while scrubbing) */}
          {lastPast && !hover && (
            <g>
              <circle cx={lastPast.x} cy={lastPast.y} r="4" fill={lineColor} className="chart-pulse" />
              <circle cx={lastPast.x} cy={lastPast.y} r="3" fill={lineColor} stroke="#0B0E13" strokeWidth="1.5" />
            </g>
          )}

          {/* Scrubber */}
          {hover && (
            <g>
              <line
                x1={hover.x} x2={hover.x} y1={PAD_TOP - 4} y2={height}
                stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="2 4"
              />
              <circle cx={hover.x} cy={hover.y} r="4" fill={lineColor} stroke="#0B0E13" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
