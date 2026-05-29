import { Plane, Home, ShoppingBag } from 'lucide-react'

export const CHECKLIST_SECTIONS = [
  {
    id: 'before',
    label: 'Avant départ',
    short: 'Avant',
    description: 'Démarches à faire en France avant de partir',
    icon: Plane,
    accentClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/20',
    dotClass: 'bg-cyan-400',
  },
  {
    id: 'arrival',
    label: 'À l\'arrivée',
    short: 'Arrivée',
    description: 'À régler une fois arrivés en Australie',
    icon: Home,
    accentClass: 'text-purple-400',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
    dotClass: 'bg-purple-400',
  },
  {
    id: 'luggage',
    label: 'Valise',
    short: 'Valise',
    description: 'Objets, vêtements, papiers à emporter',
    icon: ShoppingBag,
    accentClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    dotClass: 'bg-amber-400',
  },
]

export function getChecklistSection(id) {
  return CHECKLIST_SECTIONS.find((s) => s.id === id) || CHECKLIST_SECTIONS[0]
}

// Initial suggestions seeded once via "Initialiser" button on the empty state.
export const CHECKLIST_SUGGESTIONS = [
  { section: 'before',  label: 'Visa' },
  { section: 'before',  label: 'Billet d\'avion' },
  { section: 'before',  label: 'Assurance' },
  { section: 'before',  label: 'Compte bancaire' },
  { section: 'before',  label: 'Téléphone' },
  { section: 'before',  label: 'Logement temporaire' },
  { section: 'before',  label: 'CV australien' },
  { section: 'arrival', label: 'TFN' },
  { section: 'arrival', label: 'Superannuation' },
]

export const STATUS_META = {
  'todo':         { label: 'À faire',  textClass: 'text-white/40',     ringClass: 'ring-white/15',     fillClass: '' },
  'in-progress':  { label: 'En cours', textClass: 'text-amber-400',    ringClass: 'ring-amber-400/40', fillClass: 'bg-amber-500/30' },
  'done':         { label: 'Fait',     textClass: 'text-emerald-400',  ringClass: 'ring-emerald-400/50', fillClass: 'bg-emerald-500/80' },
}

export const STATUS_ORDER = ['todo', 'in-progress', 'done']

export function getNextStatus(current) {
  const i = STATUS_ORDER.indexOf(current)
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length]
}
