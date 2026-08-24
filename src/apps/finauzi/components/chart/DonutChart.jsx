import { useMemo } from 'react'

// Camembert (troué) — la répartition d'un total en un coup d'œil.
//
// Le trou n'est pas décoratif : il sert de place au chiffre qui compte, et
// comparer des angles depuis un centre vide reste plus honnête qu'un disque
// plein où l'œil compare des surfaces.
//
// Deux règles de lecture, tenues ici :
//   – six parts au maximum, le reste tombe dans « Autre ». Au-delà, les arcs
//     deviennent des traits et les couleurs se confondent.
//   – aucune identité portée par la seule couleur : la légende vit à côté,
//     avec son libellé et son montant (`activeKey` synchronise les deux).
//
// SVG pur, aucune dépendance : `pathLength=100` fait travailler les arcs en
// pourcentages, donc pas une seule trigonométrie à maintenir.

const GAP = 1.2 // écart entre deux parts, en % de la circonférence
const MIN_ARC = 0.6 // une part minuscule reste visible

export default function DonutChart({
  slices,
  total,
  formatValue,
  activeKey = null,
  onActiveKeyChange,
  centerLabel = 'Total',
  thickness = 13,
  className = '',
}) {
  const segments = useMemo(() => {
    if (!(total > 0)) return []
    // Une part unique fait un anneau plein : y creuser un écart donnerait
    // l'impression qu'il manque quelque chose.
    const gap = slices.length > 1 ? GAP : 0
    let offset = 0
    return slices.map((slice) => {
      const pct = (slice.value / total) * 100
      const segment = { ...slice, pct, offset, arc: Math.max(pct - gap, MIN_ARC) }
      offset += pct
      return segment
    })
  }, [slices, total])

  if (segments.length === 0) return null

  const radius = 50 - thickness / 2
  const active = segments.find((s) => s.key === activeKey) || null
  const clear = () => onActiveKeyChange?.(null)

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full -rotate-90 overflow-visible"
        role="img"
        aria-label={`Répartition : ${segments.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(', ')}`}
        onMouseLeave={clear}
      >
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={thickness} />
        {segments.map((segment) => {
          const dimmed = active && active.key !== segment.key
          return (
            <g key={segment.key}>
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={segment.hex}
                strokeWidth={active?.key === segment.key ? thickness + 3 : thickness}
                strokeLinecap="butt"
                pathLength="100"
                strokeDasharray={`${segment.arc} ${100 - segment.arc}`}
                strokeDashoffset={-segment.offset}
                className="transition-all duration-200 ease-out"
                style={{ opacity: dimmed ? 0.25 : 1 }}
              />
              {/* Piste invisible plus épaisse : de quoi viser l'arc au doigt. */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="transparent"
                strokeWidth={thickness + 12}
                pointerEvents="stroke"
                pathLength="100"
                strokeDasharray={`${Math.max(segment.pct, 1.5)} ${100 - Math.max(segment.pct, 1.5)}`}
                strokeDashoffset={-segment.offset}
                className="cursor-pointer"
                onMouseEnter={() => onActiveKeyChange?.(segment.key)}
                onClick={() => onActiveKeyChange?.(active?.key === segment.key ? null : segment.key)}
              />
            </g>
          )
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-6">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/30 truncate max-w-full">
          {active ? active.label : centerLabel}
        </p>
        <p className="text-lg sm:text-xl font-semibold text-white tabular mt-0.5">
          {formatValue(active ? active.value : total)}
        </p>
        {active && (
          <p className="text-[11px] text-white/40 tabular mt-0.5">{Math.round(active.pct)}%</p>
        )}
      </div>
    </div>
  )
}

// Réduit une liste triée à `max` parts, le reste fusionné en « Autre ».
export function collapseSlices(slices, max = 6, otherHex = '#64748B') {
  if (slices.length <= max) return slices
  const kept = slices.slice(0, max - 1)
  const rest = slices.slice(max - 1)
  return [
    ...kept,
    {
      key: '__other__',
      label: `Autre (${rest.length})`,
      value: rest.reduce((sum, s) => sum + s.value, 0),
      hex: otherHex,
    },
  ]
}
