import { useEffect, useState } from 'react'

/**
 * Le navigateur se croit-il connecté ?
 *
 * Indication seulement : `navigator.onLine` peut être vrai sur un wifi
 * d'hôtel sans internet. Ça suffit pour griser ce qui ne peut PAS marcher
 * hors-ligne (dérouler un lien court, supprimer un voyage entier) ; le reste
 * de l'app ne lit jamais ce drapeau, il écrit dans le cache Firestore et
 * laisse la synchronisation se faire au retour du réseau.
 */
export function useOnline() {
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine !== false,
  )

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return online
}
