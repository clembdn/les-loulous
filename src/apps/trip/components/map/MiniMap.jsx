import { useId, useMemo } from 'react'
import { BedDouble } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { curvePath, groupCoincident, projectPoints } from '../../utils/geo.js'
import { dayRoute } from '../../utils/route.js'
import { getTransportMode } from '../../config/reservations.js'

const PAD = 26
// Deux pastilles de 20 px plus proches que ça se chevauchent : un seul repère « 1·2 ».
const MERGE_PX = 18

/**
 * La journée dessinée : le tracé et des points numérotés, sans fond de carte.
 *
 * Le plan du métro, pas la vue satellite — zéro requête, zéro tuile, donc
 * lisible hors-ligne et entièrement dans le style de l'app. Niveaux de gris
 * partout, l'accent réservé au tracé. Les trajets réservés (train, vol) sont
 * en pointillés : on ne prétend pas savoir par où passe le TGV.
 */
export default function MiniMap({ items, home = null, width = 340, height = 170, className }) {
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
      return { key: pts[0].key, at: xy[indexes[0]], numbers, first: pts[0] }
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
    <div className={cn('relative bg-surface-2', className)}>
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
            className="stroke-muted"
            strokeWidth="1.6"
            strokeDasharray="3 4"
            strokeLinecap="round"
          />
        ))}
        {drawn.paths.map((d, i) => (
          <path key={`run-${i}`} d={d} fill="none" className="stroke-accent" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {drawn.home && <IconMarker at={drawn.home} icon={BedDouble} tone="accent" />}
        {drawn.markers.map((m) => (
          m.numbers.length
            ? <NumberMarker key={m.key} at={m.at} label={m.numbers.join('·')} />
            : (
              <IconMarker
                key={m.key}
                at={m.at}
                icon={m.first.kind === 'transport' ? getTransportMode(m.first.mode).icon : BedDouble}
              />
            )
        ))}
      </svg>
      {empty && (
        <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-xs text-faint">
          Collez le lien Google Maps d’une étape pour voir le parcours du jour.
        </p>
      )}
    </div>
  )
}

function NumberMarker({ at, label }) {
  const w = label.length > 1 ? 10 + label.length * 6.4 : 20
  return (
    <g>
      <rect
        x={at[0] - w / 2} y={at[1] - 10} width={w} height="20" rx="10"
        className="fill-fg stroke-surface-2" strokeWidth="2.5"
      />
      <text
        x={at[0]} y={at[1] + 3.8}
        textAnchor="middle"
        className="fill-bg font-mono"
        fontSize="10.5"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  )
}

function IconMarker({ at, icon: Icon, tone = 'fg' }) {
  return (
    <g>
      <circle
        cx={at[0]} cy={at[1]} r="10.5"
        className={cn('fill-surface', tone === 'accent' ? 'stroke-accent' : 'stroke-fg')}
        strokeWidth="1.6"
      />
      <Icon
        x={at[0] - 6} y={at[1] - 6} size={12} strokeWidth={2.2}
        className={tone === 'accent' ? 'text-accent' : 'text-fg'}
      />
    </g>
  )
}
