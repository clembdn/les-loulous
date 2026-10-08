import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useOnline } from '@/shared/lib/useOnline.js'
import { toast } from '@/shared/ui/sonner.jsx'
import { useTripConfirmed, useTripData } from './TripDataContext.jsx'
import { publishShare, subscribeToShares } from '../services/sharesService.js'
import { contentHash, PUBLIC_MAX_CHARS, publicTripContent } from '../utils/publicTrip.js'

/**
 * Les liens invités du voyage ouvert, et leurs vitrines tenues à jour.
 *
 * Une vitrine est une copie du voyage. Plutôt que de la réécrire dans chaque
 * écriture de l'app (et d'en oublier une un jour), elle est republiée ICI
 * quand le contenu change — par l'appareil qui a le voyage ouvert, c'est-à-
 * dire celui qui vient de le modifier.
 *
 * Seulement sur des données CONFIRMÉES par le serveur (toutes les parties du
 * voyage et les liens, sans écriture en attente) : un téléphone resté
 * hors-ligne une semaine ne doit pas écraser la vitrine avec son cache
 * périmé. Une modification faite hors-ligne part donc vers les invités au
 * retour du réseau, en même temps qu'elle part vers l'autre compte.
 *
 * L'empreinte publiée (`publishedHash`) évite de réécrire pour rien.
 */
const TripSharesContext = createContext(null)

// Laisser retomber une rafale de modifications (glisser une étape, taper un titre).
const PUBLISH_DELAY_MS = 1500

export function TripSharesProvider({ children }) {
  const { currentUid } = useAuth()
  const online = useOnline()
  const { tripId, trip, stays, transports, days, dayKeys, attachments, isLoading } = useTripData()
  const isConfirmed = useTripConfirmed()
  const [shares, setShares] = useState([])
  const [sharesReady, setSharesReady] = useState(false)
  const [sharesConfirmed, setSharesConfirmed] = useState(false)
  // Les liens en cours de publication : une seule à la fois par lien.
  const publishing = useRef(new Set())
  // Une publication terminée relance l'examen : l'écho de son écriture a pu
  // arriver pendant que le lien était encore marqué « en cours ».
  const [settled, setSettled] = useState(0)
  // Un échec (règles pas encore publiées, quota) n'est retenté qu'avec un
  // nouveau contenu ou au retour du réseau : pas d'écriture en boucle.
  const failed = useRef(new Map())
  const tooBig = useRef(false)

  useEffect(() => {
    if (online) failed.current.clear()
  }, [online])

  useEffect(() => subscribeToShares(
    tripId,
    (list) => { setShares(list); setSharesReady(true) },
    () => setSharesReady(true),
    setSharesConfirmed,
  ), [tripId])

  const content = useMemo(
    () => (shares.length ? publicTripContent({ trip, stays, transports, days, dayKeys, attachments }) : null),
    [shares.length, trip, stays, transports, days, dayKeys, attachments],
  )
  const hash = useMemo(() => (content ? contentHash(content) : null), [content])

  useEffect(() => {
    if (!content || !online || isLoading || !isConfirmed || !sharesConfirmed) return undefined
    const stale = shares.filter((s) => s.publishedHash !== hash
      && !publishing.current.has(s.id)
      && failed.current.get(s.id) !== hash)
    if (!stale.length) return undefined

    const timer = setTimeout(() => {
      if (JSON.stringify(content).length > PUBLIC_MAX_CHARS) {
        if (!tooBig.current) toast.error('Voyage trop volumineux pour les liens invités : ils ne sont plus mis à jour')
        tooBig.current = true
        return
      }
      tooBig.current = false
      for (const share of stale) {
        publishing.current.add(share.id)
        publishShare(tripId, share, { content, hash, attachments }, currentUid)
          .catch((err) => {
            failed.current.set(share.id, hash)
            console.warn('[Trip] publication du lien invité impossible :', err)
          })
          .finally(() => {
            publishing.current.delete(share.id)
            setSettled((n) => n + 1)
          })
      }
    }, PUBLISH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [content, hash, shares, online, isLoading, isConfirmed, sharesConfirmed, tripId, attachments, currentUid, settled])

  const value = useMemo(() => ({
    shares,
    isLoading: !sharesReady,
  }), [shares, sharesReady])

  return <TripSharesContext.Provider value={value}>{children}</TripSharesContext.Provider>
}

export function useTripShares() {
  const ctx = useContext(TripSharesContext)
  if (!ctx) throw new Error('useTripShares doit être utilisé sous <TripSharesProvider>')
  return ctx
}
