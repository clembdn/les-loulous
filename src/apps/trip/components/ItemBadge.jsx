import { BedDouble } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { getCategory } from '../config/categories.js'
import { getTransportMode } from '../config/reservations.js'
import { PAST_COLOR, stayColor, TRANSPORT_COLOR } from '../config/palette.js'
import { hasCoords } from '../utils/geo.js'

/**
 * La couleur d'un élément de la frise — la même que son repère sur la carte.
 * Étape : sa catégorie ; hébergement : sa couleur de séjour ; trajet : bleu nuit.
 */
export function itemColor(item, colorIndexByStay = {}) {
  if (item.type === 'stop') return getCategory(item.stop.category).color
  if (item.type === 'transport') return TRANSPORT_COLOR.hex
  return stayColor(colorIndexByStay[item.stay.id]).hex
}

/**
 * La pastille d'un élément de la frise : ronde et numérotée pour une étape
 * (le numéro de la carte), carrée avec un lit pour un hébergement, ronde avec
 * le véhicule pour un trajet. Une étape pas encore localisée a un contour en
 * pointillés : elle n'est pas sur la carte. `past` la grise.
 */
export default function ItemBadge({ item, colorIndexByStay, past = false, size = 26, className }) {
  const color = past ? PAST_COLOR : itemColor(item, colorIndexByStay)
  const box = { width: size, height: size }
  const icon = Math.round(size * 0.54)

  if (item.type === 'stop') {
    const located = hasCoords(item.stop)
    return (
      <span
        className={cn('shrink-0 rounded-full flex items-center justify-center font-mono font-semibold tabular', className)}
        style={located
          ? { ...box, backgroundColor: color, color: '#fff', fontSize: size * 0.46 }
          : { ...box, border: `1.5px dashed ${color}`, color, fontSize: size * 0.46 }}
        title={located ? undefined : 'Pas encore localisée : absente de la carte'}
      >
        {item.number}
      </span>
    )
  }

  const Icon = item.type === 'transport' ? getTransportMode(item.transport.mode).icon : BedDouble
  return (
    <span
      aria-hidden="true"
      className={cn('shrink-0 flex items-center justify-center text-white', item.type === 'transport' ? 'rounded-full' : 'rounded-[8px]', className)}
      style={{ ...box, backgroundColor: color }}
    >
      <Icon size={icon} strokeWidth={2.2} />
    </span>
  )
}
