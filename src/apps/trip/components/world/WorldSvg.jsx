import { useMemo } from 'react'
import { cn } from '@/shared/lib/utils.js'
import { frameAround, partPath, project, WORLD_VIEWBOX } from '../../utils/world.js'

// Couleurs de la carte du monde (style « Lagon » des cartes du voyage) :
// mer lagon pâle, terres crème, terres visitées au lagon franc.
export const WORLD_COLORS = {
  sea: '#CFE6EE',
  land: '#F6F4EE',
  border: '#D3D9DB',
  visited: '#0E7490',
  planned: '#7CC4D6',
  selected: '#0B3B4A',
  glow: '#0891B2',
}

/**
 * La carte du monde en SVG : l'aperçu de « Mes voyages » (instantané, sans
 * MapLibre, lisible hors-ligne) et le secours du globe sans WebGL.
 *
 * Terres visitées au lagon franc, prévues au lagon pâle ; un halo par lieu,
 * à la taille du lieu (une île minuscule comme Ouvéa n'a que lui).
 * `fit` : cadrer sur les lieux plutôt que le monde entier. `onSelect(pays)` :
 * terres cliquables. `slice` : remplir un cadre plus large que 2:1 en rognant
 * le haut et le bas (l'aperçu, sur ordinateur).
 */
export default function WorldSvg({ world, visits, selected = null, onSelect = null, fit = true, slice = false, className }) {
  const landPaths = useMemo(
    () => (world ? world.parts.map((p) => ({ key: p.key, country: p.country, d: partPath(p.rings) })) : []),
    [world],
  )
  const points = visits?.points || []
  const projected = useMemo(() => points.map((p) => ({ ...p, xy: project(p.lng, p.lat) })), [points])
  const viewBox = useMemo(() => {
    if (!fit) return WORLD_VIEWBOX
    const xy = projected.map((p) => p.xy)
    for (const { part } of visits?.lit.values() || []) xy.push(project(part.center.lng, part.center.lat))
    return frameAround(xy)
  }, [fit, projected, visits])
  // Taille d'un halo : son rayon réel, mais jamais moins qu'un point lisible.
  const kmToUnits = 100 / 6371
  const minR = viewBox[2] / 90

  return (
    <svg
      viewBox={viewBox.join(' ')}
      preserveAspectRatio={slice ? 'xMidYMid slice' : 'xMidYMid meet'}
      className={cn('block w-full', className)}
      style={{ background: `linear-gradient(180deg, #DDEFF4, ${WORLD_COLORS.sea})` }}
      onClick={onSelect ? () => onSelect(null) : undefined}
      aria-hidden={!onSelect}
    >
      <defs>
        <radialGradient id="world-glow">
          <stop offset="0%" stopColor={WORLD_COLORS.glow} stopOpacity="0.55" />
          <stop offset="60%" stopColor={WORLD_COLORS.glow} stopOpacity="0.22" />
          <stop offset="100%" stopColor={WORLD_COLORS.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      {landPaths.map(({ key, country, d }) => {
        const lit = visits?.lit.get(key)
        const fill = selected && country === selected && lit
          ? WORLD_COLORS.selected
          : lit ? (lit.visited ? WORLD_COLORS.visited : WORLD_COLORS.planned) : WORLD_COLORS.land
        return (
          <path
            key={key}
            d={d}
            fill={fill}
            fillRule="evenodd"
            stroke={lit ? '#FFFFFF' : WORLD_COLORS.border}
            strokeWidth={lit ? 0.9 : 0.5}
            vectorEffect="non-scaling-stroke"
            className={cn(onSelect && lit && 'cursor-pointer')}
            onClick={onSelect && lit ? (e) => { e.stopPropagation(); onSelect(country) } : undefined}
          />
        )
      })}
      {projected.map((p) => (
        <circle
          key={`g${p.lat},${p.lng}`}
          cx={p.xy[0]}
          cy={p.xy[1]}
          r={Math.max(minR * 1.6, p.radiusKm * kmToUnits * 1.6)}
          fill="url(#world-glow)"
          className="pointer-events-none"
        />
      ))}
      {projected.map((p) => (
        <circle
          key={`d${p.lat},${p.lng}`}
          cx={p.xy[0]}
          cy={p.xy[1]}
          r={minR * 0.42}
          fill={p.visited ? WORLD_COLORS.selected : '#FFFFFF'}
          stroke="#FFFFFF"
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
          className={cn(onSelect ? 'cursor-pointer' : 'pointer-events-none')}
          onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(p.country) } : undefined}
        />
      ))}
    </svg>
  )
}
