// Les repères de la carte, en DOM (des marqueurs MapLibre) : nets à tous les
// zooms, cliquables, et dessinés aux couleurs de la frise (cf. ItemBadge).

import { getCategory } from '../../config/categories.js'
import { PAST_COLOR, stayColor, TRANSPORT_COLOR } from '../../config/palette.js'
import { haversineM } from '../../utils/geo.js'

// Pictogrammes Lucide, en SVG brut : les marqueurs sont du DOM, pas du React.
const GLYPHS = {
  bed: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
  flight: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  train: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>',
  bus: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  ferry: '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  other: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
}

function svg(glyph) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[glyph] || GLYPHS.other}</svg>`
}

// Deux points à moins de 15 m (on part de l'hôtel, on y revient) : un seul
// repère, « 1·4 », plutôt que deux pastilles empilées.
const SAME_PLACE_M = 15

/** Regroupe les points de `dayRoute` qui tombent au même endroit. */
export function groupPoints(points) {
  const groups = []
  for (const point of points) {
    const group = groups.find((g) => haversineM(g.at, point) < SAME_PLACE_M)
    if (group) group.points.push(point)
    else groups.push({ at: point, points: [point] })
  }
  return groups
}

/** Forme, couleur et contenu du repère d'un groupe de points. */
export function describeGroup(group, { colorIndexByStay = {}, past = null } = {}) {
  const stops = group.points.filter((p) => p.kind === 'stop')
  const lead = stops[0] || group.points[0]
  const keys = group.points.map((p) => p.itemKey).filter(Boolean)
  const isPast = !!past && keys.length > 0 && keys.every((k) => past.has(k))
  const name = group.points.map((p) => p.name).filter(Boolean).join(' · ')

  if (lead.kind === 'stop') {
    const label = stops.map((s) => s.number).join('·')
    return { keys, name, shape: 'circle', color: isPast ? PAST_COLOR : getCategory(lead.category).color, label }
  }
  if (lead.kind === 'transport') {
    return { keys, name, shape: 'circle', color: isPast ? PAST_COLOR : TRANSPORT_COLOR.hex, glyph: lead.mode }
  }
  // Hébergement de la journée, ou celui du soir (`home`).
  return { keys, name, shape: 'square', color: isPast ? PAST_COLOR : stayColor(colorIndexByStay[lead.stayId]).hex, glyph: 'bed' }
}

/**
 * Crée le DOM d'un repère : une ancre (que MapLibre positionne) et la
 * pastille. `handlers` : `{ onSelect(keys), onHover(keys | null) }`.
 */
export function createMarkerElement(desc, handlers) {
  const anchor = document.createElement('div')
  anchor.className = 'trip-marker-anchor'
  const pin = document.createElement('button')
  pin.type = 'button'
  anchor.appendChild(pin)
  pin.addEventListener('click', (e) => {
    e.stopPropagation()
    handlers.onSelect?.(pin.__keys)
  })
  pin.addEventListener('mouseenter', () => handlers.onHover?.(pin.__keys))
  pin.addEventListener('mouseleave', () => handlers.onHover?.(null))
  updateMarkerElement(anchor, desc, false)
  return anchor
}

export function updateMarkerElement(anchor, desc, active) {
  const pin = anchor.firstChild
  pin.__keys = desc.keys
  pin.className = `trip-marker trip-marker--${desc.shape}${active ? ' is-active' : ''}`
  pin.style.backgroundColor = desc.color
  pin.setAttribute('aria-label', desc.name || 'Lieu')
  const content = desc.label ?? svg(desc.glyph)
  if (pin.__content !== content) {
    pin.__content = content
    if (desc.label != null) pin.textContent = desc.label
    else pin.innerHTML = content
  }
  anchor.style.zIndex = active ? '3' : desc.shape === 'square' ? '1' : '2'
}
