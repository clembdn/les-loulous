import { Link } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import { useWorldVisits } from '../../hooks/useWorldVisits.js'
import { WORLD_PATH } from '../../config/navigation.js'
import { plural } from '../../utils/format.js'
import WorldSvg from './WorldSvg.jsx'

/**
 * L'aperçu de la carte du monde, en tête de « Mes voyages » : léger (SVG,
 * sans MapLibre), il s'affiche tout de suite, même hors-ligne. Un toucher
 * ouvre la vraie carte (/trip/monde).
 */
export default function WorldPreview({ className }) {
  const { world, visits, countries, isLoading, failed } = useWorldVisits()
  if (failed) return null
  if (isLoading || !world) return <Skeleton className={cn('h-56 rounded-3xl', className)} />

  const visited = countries.filter((c) => c.visited)
  const planned = countries.length - visited.length
  const cities = new Set(visited.flatMap((c) => c.cities)).size

  return (
    <Link
      to={WORLD_PATH}
      className={cn('group block rounded-3xl bg-surface shadow-sm overflow-hidden transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', className)}
    >
      <WorldSvg world={world} visits={visits} slice className="aspect-[2/1] lg:aspect-[3/1]" />
      <div className="px-4 py-3.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {visited.length > 0 ? (
            <>
              <p className="text-[17px] font-semibold text-fg tabular">
                {plural(visited.length, 'pays', 'pays')}
                {cities > 0 && <span className="font-normal text-muted"> · {plural(cities, 'ville')}</span>}
              </p>
              <p className="text-[13px] text-muted truncate">
                {visited.slice(0, 5).map((c) => c.name).join(', ')}
                {visited.length > 5 && '…'}
                {planned > 0 && ` · ${planned} à venir`}
              </p>
            </>
          ) : (
            <>
              <p className="text-[17px] font-semibold text-fg">Carte du monde</p>
              <p className="text-[13px] text-muted">Allumez les pays déjà visités</p>
            </>
          )}
        </div>
        <span className="shrink-0 h-9 pl-3 pr-2 rounded-full bg-accent/10 text-accent text-[14px] font-semibold inline-flex items-center gap-0.5 group-hover:bg-accent/15 transition">
          {visited.length > 0 ? 'Ouvrir' : <><Plus size={14} /> Ajouter</>} <ChevronRight size={16} />
        </span>
      </div>
    </Link>
  )
}
