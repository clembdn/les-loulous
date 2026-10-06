import { useId, useMemo } from 'react'
import { BedDouble } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { curvePath, groupCoincident, projectPoints } from '../../utils/geo.js'
import { dayRoute } from '../../utils/route.js'
import { getTransportMode } from '../../config/reservations.js'
import { getCategory } from '../../config/categories.js'
import { ROUTE_COLOR, stayColor, TRANSPORT_COLOR } from '../../config/palette.js'

const PAD = 26
// Deux pastilles de 20 px plus proches que ça se chevauchent : un seul repère « 1·2 ».
const MERGE_PX = 18

/**
 * La journée dessinée : le tracé et des points numérotés, sans fond de carte.
 *
 * Le plan du métro, pas la vue satellite — zéro requête, zéro tuile : c'est
 * ce que montre la carte (TripMap) le temps de se charger, ou à sa place sans
 * WebGL. Mêmes couleurs que la frise : catégorie pour une étape, couleur de
 * séjour pour un hébergement, bleu nuit pour un trajet. Les trajets réservés
 * (train, vol) sont en pointillés : on ne prétend pas savoir par où passe le TGV.
 */
export default function MiniMap({ items, home = null, colorIndexByStay = {}, width = 340, height = 170, className }) {
  const patternId = `grid-${useId().replace(/:/g, '')}`
  const route = useMemo(() => dayRoute(items, { home }), [items, home])

  const drawn = useMemo(() => {
    const all = route.home ? [...route.points, route.home] : route.points
    const projected = projectPoints(all, width, height, PAD)
    const xy = projected.slice(0, route.points.length)

    // Tronçons libres consécutifs → une seule courbe ; tronçons réservés → pointillés.
    const runs = []
    const booked = []
    let run = xy.length ? [0] : []
    for (const seg of route.segments) {
      if (seg.booked) {
        booked.push([xy[seg.from], xy[seg.to]])
        if (run.length > 1) runs.push(run)
        run = [seg.to]
      } else {
        run.push(seg.to)
      }
    }
    if (run.length > 1) runs.push(run)

    const markers = groupCoincident(xy, MERGE_PX).map((indexes) => {
      const pts = indexes.map((i) => route.points[i])
      const numbers = pts.filter((p) => p.kind === 'stop').map((p) => p.number)
      const firstStop = pts.find((p) => p.kind === 'stop')
      return { key: pts[0].key, at: xy[indexes[0]], numbers, first: pts[0], color: firstStop ? getCategory(firstStop.category).color : null }
    })

    return {
      paths: runs.map((r) => curvePath(r.map((i) => xy[i]))),
      booked,
      markers,
      home: route.home ? projected[projected.length - 1] : null,
    }
  }, [route, width, height])

  const stops = route.points.filter((p) => p.kind === 'stop').length
  const empty = route.points.length === 0 && !route.home

  return (
    <div className={cn('relative bg-[#F3F2EE]', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full h-auto"
        role="img"
        aria-label={empty ? 'Aucun lieu localisé ce jour-là' : `Tracé du jour, ${stops} étape${stops > 1 ? 's' : ''}`}
      >
        <defs>
          <pattern id={patternId} width="17" height="17" patternUnits="userSpaceOnUse">
            <circle cx="8.5" cy="8.5" r="0.9" className="fill-border-strong" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill={`url(#${patternId})`} />

        {drawn.booked.map(([a, b], i) => (
          <line
            key={`booked-${i}`}
            x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
            stroke={TRANSPORT_COLOR.hex}
            strokeWidth="1.6"
            strokeDasharray="3 4"
            strokeLinecap="round"
          />
        ))}
        {drawn.paths.map((d, i) => (
          <path key={`run-${i}`} d={d} fill="none" stroke={ROUTE_COLOR} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {drawn.home && <IconMarker at={drawn.home} icon={BedDouble} color={stayColor(colorIndexByStay[route.home.stayId]).hex} square />}
        {drawn.markers.map((m) => (
          m.numbers.length
            ? <NumberMarker key={m.key} at={m.at} label={m.numbers.join('·')} color={m.color} />
            : m.first.kind === 'transport'
              ? <IconMarker key={m.key} at={m.at} icon={getTransportMode(m.first.mode).icon} color={TRANSPORT_COLOR.hex} />
              : <IconMarker key={m.key} at={m.at} icon={BedDouble} color={stayColor(colorIndexByStay[m.first.stayId]).hex} square />
        ))}
      </svg>
      {empty && (
        <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-[13px] text-muted">
          Collez le lien Google Maps d’une étape pour voir le parcours du jour.
        </p>
      )}
    </div>
  )
}

function NumberMarker({ at, label, color }) {
  const w = label.length > 1 ? 12 + label.length * 6.4 : 22
  return (
    <g>
      <rect
        x={at[0] - w / 2} y={at[1] - 11} width={w} height="22" rx="11"
        fill={color || '#0E7490'} stroke="#fff" strokeWidth="2"
      />
      <text
        x={at[0]} y={at[1] + 3.8}
        textAnchor="middle"
        fill="#fff"
        className="font-mono"
        fontSize="11"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  )
}

function IconMarker({ at, icon: Icon, color, square = false }) {
  return (
    <g>
      <rect
        x={at[0] - 11} y={at[1] - 11} width="22" height="22" rx={square ? 6 : 11}
        fill={color} stroke="#fff" strokeWidth="2"
      />
      <Icon x={at[0] - 6} y={at[1] - 6} size={12} strokeWidth={2.4} color="#fff" />
    </g>
  )
}
