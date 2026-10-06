import { BedDouble } from 'lucide-react'
import { formatDateFr } from '@/shared/lib/dates.js'
import { getCategory } from '../../config/categories.js'
import { getStayKind, getTransportMode } from '../../config/reservations.js'
import { formatDuration } from '../../utils/format.js'

// Comment on DIT un élément de la frise, partout pareil : dans la frise, en
// grand sur l'écran Aujourd'hui, dans l'aperçu de demain.

/** Titre et sous-titre d'un trajet, selon qu'on le voit partir, arriver, ou les deux. */
export function transportText(item) {
  const t = item.transport
  const mode = getTransportMode(t.mode)
  const ref = t.ref || mode.label
  const from = t.from.name || 'départ'
  const to = t.to.name || 'arrivée'
  if (t.mode === 'car') {
    if (item.phase === 'arrival') return { title: `Retour · ${ref}`, sub: to }
    if (item.phase === 'departure') return { title: `Prise · ${ref}`, sub: `${from} · retour le ${formatDateFr(t.to.date)}` }
    return { title: ref, sub: `${from} → ${to}` }
  }
  if (item.phase === 'departure') {
    return { title: ref, sub: `${from} → ${to} · arrivée le ${formatDateFr(t.to.date)}${t.to.time ? ` à ${t.to.time}` : ''}` }
  }
  if (item.phase === 'arrival') return { title: `Arrivée · ${ref}`, sub: `${from} → ${to}` }
  return { title: ref, sub: `${from} → ${to}${item.endTime ? ` · arrivée ${item.endTime}` : ''}` }
}

/** `{ title, sub, icon }` de n'importe quel élément de la frise. */
export function itemText(item) {
  if (item.type === 'stop') {
    const { stop } = item
    const category = getCategory(stop.category)
    return {
      title: stop.name,
      sub: [category.label, formatDuration(stop.durationMin), stop.address].filter(Boolean).join(' · '),
      icon: category.icon,
    }
  }
  if (item.type === 'transport') {
    return { ...transportText(item), icon: getTransportMode(item.transport.mode).icon }
  }
  const { stay } = item
  return {
    title: `${item.type === 'checkin' ? 'Arrivée' : 'Départ'} · ${stay.name}`,
    sub: [getStayKind(stay.kind).label, stay.address].filter(Boolean).join(' · '),
    icon: BedDouble,
  }
}
