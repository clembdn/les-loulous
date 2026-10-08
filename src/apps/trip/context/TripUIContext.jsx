import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTripData } from './TripDataContext.jsx'
import StaySheet from '../components/resas/StaySheet.jsx'
import TransportSheet from '../components/resas/TransportSheet.jsx'
import StopSheet from '../components/days/StopSheet.jsx'
import DaySheet from '../components/days/DaySheet.jsx'
import TripFormSheet from '../components/trips/TripFormSheet.jsx'
import AttachmentViewer from '../components/attachments/AttachmentViewer.jsx'
import NewItemSheet from '../components/resas/NewItemSheet.jsx'
import ShareSheet from '../components/trips/ShareSheet.jsx'
import StopView from '../components/days/StopView.jsx'
import { hasCoords } from '../utils/geo.js'
import { resaKey } from '../utils/reservations.js'
import { RUNNER_ID } from '../config/navigation.js'

/**
 * Les feuilles d'un voyage, montées UNE fois.
 *
 * Un hébergement s'ouvre depuis la bande des nuits, la frise, la carte
 * « Ce soir » ou la liste des réservations ; une étape depuis le téléphone ou
 * l'éditeur desktop. Plutôt que de dupliquer chaque feuille dans chaque écran
 * (et son état dans chaque parent), les écrans demandent ici : « ouvre cet
 * hébergement », « montre ces captures ».
 *
 * La navigation passe aussi par là (`openResa`, `openDay`) : l'URL reste la
 * source de vérité de l'écran affiché (cf. useTabRoute). `basePath` est la
 * racine du voyage : /trip/<id>, ou /v/<jeton> pour un invité.
 *
 * `readOnly` (vue invité) : aucune feuille de modification n'est montée, et
 * les actions qui modifient valent `null` — les écrans cachent leurs
 * boutons. Une étape s'ouvre alors en fiche de lecture (`openStop`).
 */
const TripUIContext = createContext(null)

// `nonce` remonte la feuille à chaque ouverture : son formulaire naît avec
// l'élément à modifier, au lieu d'être recalé après coup (une image avec les
// valeurs de la fois précédente, et des champs internes jamais remis à jour).
const CLOSED = { open: false, item: null, defaults: null, nonce: 0 }

export function TripUIProvider({ goTab, goBack, currentSub, onTripDeleted, basePath, readOnly = false, children }) {
  const { trip, tripId, stays, days, attachmentsByParent } = useTripData()
  const navigate = useNavigate()
  const [stayForm, setStayForm] = useState(CLOSED)
  const [transportForm, setTransportForm] = useState(CLOSED)
  const [stopForm, setStopForm] = useState({ open: false, date: null, stop: null, nonce: 0 })
  const [dayForm, setDayForm] = useState({ open: false, date: null, nonce: 0 })
  const [tripForm, setTripForm] = useState(false)
  const [newItem, setNewItem] = useState({ open: false, date: null })
  const [shareOpen, setShareOpen] = useState(false)
  const [stopView, setStopView] = useState({ open: false, date: null, stop: null })
  const [viewer, setViewer] = useState({ list: [], index: null })

  // Un point du voyage pour orienter la recherche de lieux : « Gare » doit
  // trouver celle de Lisbonne, pas celle de Lyon.
  const near = useMemo(() => {
    const stay = stays.find(hasCoords)
    if (stay) return { lat: stay.lat, lng: stay.lng }
    for (const day of Object.values(days)) {
      const stop = day.stops.find(hasCoords)
      if (stop) return { lat: stop.lat, lng: stop.lng }
    }
    return null
  }, [stays, days])

  const api = useMemo(() => {
    const editStop = (date, stop = null) => setStopForm((f) => ({ open: true, date, stop, nonce: f.nonce + 1 }))
    const nav = {
      readOnly,
      viewAttachments: (list, index = 0) => setViewer({ list, index }),
      // Une étape existante : sa fiche de modification, ou de lecture pour un invité.
      openStop: readOnly
        ? (date, stop) => setStopView({ open: true, date, stop })
        : editStop,
      openResa: (kind, id, options) => goTab('resas', resaKey(kind, id), options),
      // Fermer une fiche, c'est revenir en arrière : « retour » ne doit pas la rouvrir.
      closeResa: () => goBack(`${basePath}/resas`),
      openDay: (date, options) => goTab('jours', date, options),
      openTab: (tab) => goTab(tab),
      // La journée en plein écran sur la carte, éventuellement à partir d'un
      // élément de la frise (la prochaine étape, depuis l'écran Aujourd'hui).
      openRunner: (date, startKey = null) => {
        const path = `${basePath}/${RUNNER_ID}/${encodeURIComponent(date)}`
        navigate(startKey ? `${path}?depart=${encodeURIComponent(startKey)}` : path)
      },
      closeRunner: (date) => goBack(`${basePath}/jours/${encodeURIComponent(date)}`),
      near,
    }
    if (readOnly) {
      return {
        ...nav, editStay: null, editTransport: null, editStop: null, editDay: null, editTrip: null, newItem: null, shareTrip: null,
      }
    }
    return {
      ...nav,
      editStay: (stay = null, defaults = null) => setStayForm((f) => ({ open: true, item: stay, defaults, nonce: f.nonce + 1 })),
      editTransport: (transport = null, defaults = null) => setTransportForm((f) => ({ open: true, item: transport, defaults, nonce: f.nonce + 1 })),
      editStop,
      editDay: (date) => setDayForm((f) => ({ open: true, date, nonce: f.nonce + 1 })),
      editTrip: () => setTripForm(true),
      // « + » : étape, hébergement ou trajet, au jour donné.
      newItem: (date) => setNewItem({ open: true, date }),
      shareTrip: () => setShareOpen(true),
    }
  }, [goTab, goBack, basePath, near, navigate, readOnly])

  // Supprimer la réservation dont on regarde la fiche : retour à la liste,
  // sans laisser « retour » rouvrir une fiche qui n'existe plus.
  const leaveDeletedResa = useCallback((kind, id) => {
    if (currentSub === resaKey(kind, id)) goTab('resas', null, { replace: true })
  }, [currentSub, goTab])

  const stay = stayForm.item
  const transport = transportForm.item

  return (
    <TripUIContext.Provider value={api}>
      {children}

      {readOnly ? (
        <StopView
          open={stopView.open}
          date={stopView.date}
          stop={stopView.stop}
          onClose={() => setStopView((v) => ({ ...v, open: false }))}
        />
      ) : (
        <>
          <StaySheet
            key={`stay-${stayForm.nonce}`}
            open={stayForm.open}
            stay={stay}
            defaults={stayForm.defaults}
            tripId={tripId}
            tripStart={trip.startDate}
            attachments={stay ? attachmentsByParent[stay.id] || [] : []}
            near={near}
            onClose={() => setStayForm((f) => ({ ...f, open: false }))}
            onDeleted={() => leaveDeletedResa('stay', stay.id)}
          />
          <TransportSheet
            key={`transport-${transportForm.nonce}`}
            open={transportForm.open}
            transport={transport}
            defaults={transportForm.defaults}
            tripId={tripId}
            tripStart={trip.startDate}
            attachments={transport ? attachmentsByParent[transport.id] || [] : []}
            near={near}
            onClose={() => setTransportForm((f) => ({ ...f, open: false }))}
            onDeleted={() => leaveDeletedResa('transport', transport.id)}
            onReverse={(t) => api.editTransport(null, { reverseOf: t })}
          />
          <StopSheet
            key={`stop-${stopForm.nonce}`}
            open={stopForm.open}
            date={stopForm.date}
            stop={stopForm.stop}
            near={near}
            onClose={() => setStopForm((f) => ({ ...f, open: false }))}
          />
          <DaySheet
            key={`day-${dayForm.nonce}`}
            open={dayForm.open}
            date={dayForm.date}
            onClose={() => setDayForm((f) => ({ ...f, open: false }))}
          />
          <TripFormSheet open={tripForm} trip={trip} onClose={() => setTripForm(false)} onDeleted={onTripDeleted} />
          <NewItemSheet
            open={newItem.open}
            date={newItem.date}
            onClose={() => setNewItem((n) => ({ ...n, open: false }))}
            onStop={() => api.editStop(newItem.date)}
            onStay={() => api.editStay(null, { date: newItem.date })}
            onTransport={(mode) => api.editTransport(null, { date: newItem.date, mode })}
          />
          <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} />
        </>
      )}
      <AttachmentViewer
        attachments={viewer.list}
        index={viewer.index}
        onClose={() => setViewer((v) => ({ ...v, index: null }))}
      />
    </TripUIContext.Provider>
  )
}

export function useTripUI() {
  const ctx = useContext(TripUIContext)
  if (!ctx) throw new Error('useTripUI doit être utilisé sous <TripUIProvider>')
  return ctx
}
