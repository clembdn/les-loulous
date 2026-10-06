import { BedDouble, MapPin } from 'lucide-react'
import { formatDayFr } from '@/shared/lib/dates.js'
import { ThemedSheet } from '@/shared/ui/ThemedSheet.jsx'
import { TRANSPORT_MODES } from '../../config/reservations.js'
import { STAY_COLORS, TRANSPORT_COLOR } from '../../config/palette.js'
import { getCategory } from '../../config/categories.js'

const LABELS = { flight: 'Vol', other: 'Autre trajet' }

const SUBS = {
  flight: 'Carte d’embarquement',
  train: 'Billet, voiture, place',
  bus: 'Car, navette',
  ferry: 'Traversée',
  car: 'Location : prise, retour',
  other: 'Navette, téléphérique…',
}

/**
 * « + » : que veut-on ajouter ? De grandes tuiles plutôt qu'un formulaire à
 * puces : choisir « Vol » ouvre directement un formulaire de vol, sans
 * avoir à le dire une deuxième fois.
 *
 * `date` : le jour affiché, qui pré-remplit l'étape ou la réservation.
 */
export default function NewItemSheet({ open, date, onClose, onStop, onStay, onTransport }) {
  const tiles = [
    { id: 'stop', label: 'Étape', sub: 'Un lieu, son heure', icon: MapPin, color: getCategory('other').color, onPick: onStop },
    { id: 'stay', label: 'Hébergement', sub: 'Hôtel, Airbnb, camping', icon: BedDouble, color: STAY_COLORS[0].hex, onPick: onStay },
    ...TRANSPORT_MODES.map((m) => ({
      id: m.id, label: LABELS[m.id] || m.short || m.label, sub: SUBS[m.id], icon: m.icon, color: TRANSPORT_COLOR.hex, onPick: () => onTransport(m.id),
    })),
  ]
  return (
    <ThemedSheet
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Ajouter"
      description={date ? `Au ${formatDayFr(date)}` : null}
    >
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { onClose(); t.onPick() }}
              className="min-h-[104px] rounded-2xl bg-surface-2 p-3.5 flex flex-col justify-between text-left transition hover:ring-2 hover:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
            >
              <span className="h-10 w-10 rounded-xl text-white flex items-center justify-center" style={{ backgroundColor: t.color }}>
                <Icon size={20} />
              </span>
              <span>
                <span className="block text-[16px] font-semibold text-fg">{t.label}</span>
                <span className="block text-[12px] text-muted">{t.sub}</span>
              </span>
            </button>
          )
        })}
      </div>
    </ThemedSheet>
  )
}
