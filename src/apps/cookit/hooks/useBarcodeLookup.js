import { useState, useCallback } from 'react'
import { toast } from '@/shared/ui/sonner.jsx'
import { fetchByBarcode, SCAN } from '../services/openFoodFactsService.js'

// Que faire d'un code-barres scanné — la logique est ici et pas dans les écrans,
// pour que la liste des courses et la bibliothèque disent exactement la même
// chose dans les mêmes situations.
//
// Rend { action, food } :
//   'pick' → l'aliment est prêt à être utilisé
//   'edit' → il faut ouvrir la fiche (pré-remplie autant que possible)
//   'none' → rien à faire, l'utilisateur a été prévenu

export function useBarcodeLookup(foods) {
  const [looking, setLooking] = useState(false)

  const lookup = useCallback(async (barcode) => {
    // 1. Déjà dans la bibliothèque : instantané, hors ligne, et surtout déjà
    // corrigé à la main le cas échéant — il prime sur Open Food Facts.
    const known = foods.find((f) => f.barcode === barcode)
    if (known) {
      toast.success(known.name, { description: 'Déjà dans ta bibliothèque' })
      return { action: 'pick', food: known }
    }

    setLooking(true)
    let res
    try {
      res = await fetchByBarcode(barcode)
    } finally {
      setLooking(false)
    }

    switch (res.status) {
      case SCAN.FOUND:
        toast.success(res.food.name, { description: 'Ajouté à ta bibliothèque' })
        return { action: 'pick', food: res.food }

      case SCAN.NO_NUTRITION:
        // Le produit existe mais sans valeurs : on garde nom, marque et photo,
        // ça évite déjà la moitié de la saisie.
        toast.info(res.food.name || `Code-barres ${barcode}`, {
          description: 'Fiche trouvée, mais sans valeurs nutritionnelles',
        })
        return { action: 'edit', food: { ...res.food, per100: { ...res.food.per100, kcal: null } } }

      case SCAN.OFFLINE:
        toast.error('Hors ligne', {
          description: 'Impossible d’interroger Open Food Facts. Tu peux saisir la fiche à la main.',
        })
        return { action: 'edit', food: { barcode, source: 'off', name: '', per100: {} } }

      default:
        toast.info(`Code-barres ${barcode}`, { description: 'Produit inconnu — complète la fiche' })
        return { action: 'edit', food: { barcode, source: 'off', name: '', per100: {} } }
    }
  }, [foods])

  return { looking, lookup }
}
