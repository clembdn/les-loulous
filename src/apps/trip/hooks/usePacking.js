import { useMemo } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { tick } from '@/shared/lib/haptics.js'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripData } from '../context/TripDataContext.jsx'
import {
  addPackingItem, addPackingItems, deletePackingItem, deletePackingItems, restorePackingItems,
  setManyPacked, setPacked, updatePackingItem,
} from '../services/packingService.js'
import { plural } from '../utils/format.js'

/**
 * Les gestes de la valise, sans attendre l'écriture (hors-ligne compris).
 * Ce qui retire ou remet à zéro plusieurs affaires a son « Annuler ».
 */
export function usePackingActions() {
  const { currentUid } = useAuth()
  const { tripId } = useTripData()

  return useMemo(() => {
    const fail = (message) => () => toast.error(message)
    return {
      // Ajouter une affaire : rien à annoncer, elle apparaît dans la liste.
      add: (name, owner = null, category = null) => {
        const { done } = addPackingItem(tripId, { name, owner, category }, currentUid)
        done.catch(fail('Enregistrement impossible'))
      },

      addMany: (inputs, label) => {
        if (!inputs.length) {
          toast('Tout y est déjà.')
          return
        }
        const { ids, done } = addPackingItems(tripId, inputs, currentUid)
        done.catch(fail('Enregistrement impossible'))
        toast.success(`${plural(inputs.length, 'affaire ajoutée', 'affaires ajoutées')}${label ? ` · ${label}` : ''}`, {
          action: { label: 'Annuler', onClick: () => deletePackingItems(tripId, ids).catch(fail('Impossible d’annuler')) },
        })
      },

      toggle: (item) => {
        tick()
        setPacked(tripId, item, !item.checked, currentUid).catch(fail('Enregistrement impossible'))
      },

      update: (item, patch) => {
        updatePackingItem(tripId, item, patch, currentUid).catch(fail('Enregistrement impossible'))
      },

      remove: (item) => {
        deletePackingItem(tripId, item.id).catch(fail('Suppression impossible'))
        toast(`« ${item.name} » retiré`, {
          action: { label: 'Annuler', onClick: () => restorePackingItems(tripId, [item], currentUid).catch(fail('Impossible de le remettre')) },
        })
      },

      // Refaire la valise pour le retour : tout redevient « à mettre ».
      uncheckAll: (items) => {
        const packed = items.filter((it) => it.checked)
        if (!packed.length) return
        setManyPacked(tripId, packed, false, currentUid).catch(fail('Enregistrement impossible'))
        toast(`${plural(packed.length, 'affaire décochée', 'affaires décochées')}`, {
          action: { label: 'Annuler', onClick: () => restorePackingItems(tripId, packed, currentUid).catch(fail('Impossible d’annuler')) },
        })
      },

      removeAll: (items) => {
        if (!items.length) return
        deletePackingItems(tripId, items.map((it) => it.id)).catch(fail('Suppression impossible'))
        toast('Valise vidée', {
          action: { label: 'Annuler', onClick: () => restorePackingItems(tripId, items, currentUid).catch(fail('Impossible d’annuler')) },
        })
      },
    }
  }, [tripId, currentUid])
}
