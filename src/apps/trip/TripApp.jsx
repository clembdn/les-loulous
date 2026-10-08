import { useCallback, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { useTabRoute } from '@/shared/lib/useTabRoute.js'
import { useToday } from '@/shared/lib/useToday.js'
import { Button } from '@/shared/ui/Button.jsx'
import { ThemedToaster } from '@/shared/ui/sonner.jsx'
import { TripsProvider, useTrips } from './context/TripsContext.jsx'
import { TripDataProvider } from './context/TripDataContext.jsx'
import { TripWeatherProvider } from './context/TripWeatherContext.jsx'
import { TripUIProvider, useTripUI } from './context/TripUIContext.jsx'
import { TripSharesProvider } from './context/TripSharesContext.jsx'
import { RouteFiller } from './hooks/useRouteFiller.js'
import Shell from './components/layout/Shell.jsx'
import Loader from './components/Loader.jsx'
import TripFormSheet from './components/trips/TripFormSheet.jsx'
import TripsView from './views/TripsView.jsx'
import ShareInView from './views/ShareInView.jsx'
import TodayView from './views/TodayView.jsx'
import DaysView from './views/DaysView.jsx'
import ResasView from './views/ResasView.jsx'
import DayRunner from './components/days/DayRunner.jsx'
import { DEFAULT_TAB, LIST_ID, LIST_PATH, RUNNER_ID, TAB_IDS, tripPath } from './config/navigation.js'
import { currentTrip, defaultDay } from './utils/tripDates.js'

export default function TripApp() {
  useAppTheme('light', 'lagoon')
  return (
    <TripsProvider>
      <Routes>
        <Route index element={<TripEntry />} />
        <Route path={LIST_ID} element={<TripsScreen />} />
        {/* Un lieu partagé depuis Google Maps (Android, cf. vite.config.js). */}
        <Route path="partage" element={<ShareInView />} />
        <Route path=":tripId/*" element={<TripScreens />} />
      </Routes>
      {/* Monté une fois, hors des écrans : passer de la liste à un voyage
          démonte la coquille, et un toast lancé juste avant (« Voyage
          créé ») partirait avec elle. */}
      <ThemedToaster />
    </TripsProvider>
  )
}

/**
 * /trip — pendant un voyage, l'app s'ouvre directement sur la journée en
 * cours ; sinon sur la liste. En `replace` : cette redirection ne doit pas
 * coûter une pression sur « retour ».
 */
function TripEntry() {
  const { trips, isLoading } = useTrips()
  const today = useToday()
  if (isLoading) return <Loader fullScreen />
  const ongoing = currentTrip(trips, today)
  return <Navigate replace to={ongoing ? tripPath(ongoing.id, 'aujourdhui') : LIST_PATH} />
}

/** Le formulaire de voyage, ouvert en création (`trip` nul) ou en modification. */
function useTripForm() {
  const [open, setOpen] = useState(false)
  // Gardé à la fermeture : la feuille garde son titre pendant qu'elle glisse
  // hors de l'écran au lieu de basculer sur « Nouveau voyage ».
  const [trip, setTrip] = useState(null)
  const openFor = useCallback((t) => { setTrip(t); setOpen(true) }, [])
  const close = useCallback(() => setOpen(false), [])
  return { open, trip, openFor, close }
}

function TripsScreen() {
  const form = useTripForm()
  const create = () => form.openFor(null)
  return (
    <>
      <Shell
        active={LIST_ID}
        onChange={() => {}}
        sidebarAction={{ label: 'Nouveau voyage', icon: Plus, onClick: create }}
      >
        <TripsView onCreate={create} onEdit={form.openFor} />
      </Shell>
      <TripFormSheet open={form.open} trip={form.trip} onClose={form.close} />
    </>
  )
}

function TripScreens() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const { tripById, isLoading } = useTrips()
  const { tab, sub, goTab, goBack } = useTabRoute(`/trip/${tripId}`, TAB_IDS, DEFAULT_TAB)
  const trip = tripById[tripId]

  const onChange = useCallback((id) => {
    if (id === LIST_ID) navigate(LIST_PATH)
    else goTab(id)
  }, [navigate, goTab])

  if (isLoading) return <Loader fullScreen />
  if (!trip) return <TripNotFound />

  return (
    // La clé remonte tout l'arbre en changeant de voyage : aucune donnée de
    // l'ancien ne peut s'afficher sous le titre du nouveau.
    <TripDataProvider key={tripId} trip={trip}>
      <TripWeatherProvider>
        {/* Les liens invités, et leurs vitrines tenues à jour tant que le voyage est ouvert. */}
        <TripSharesProvider>
          {/* Les trajets entre les lieux, calculés une fois et rangés dans les jours. */}
          <RouteFiller />
          <TripUIProvider
            goTab={goTab}
            goBack={goBack}
            currentSub={sub}
            basePath={`/trip/${tripId}`}
            onTripDeleted={() => navigate(LIST_PATH, { replace: true })}
          >
            {tab === RUNNER_ID ? (
              // Le déroulé occupe tout l'écran, sans barres : la carte d'abord.
              // La clé repart de zéro en passant au jour suivant.
              <DayRunner key={sub} date={sub} />
            ) : (
              <TripShell trip={trip} tab={tab} sub={sub} onChange={onChange}>
                {tab === 'aujourdhui' && <TodayView />}
                {tab === 'jours' && <DaysView selectedDate={sub} />}
                {tab === 'resas' && <ResasView selectedKey={sub} />}
              </TripShell>
            )}
          </TripUIProvider>
        </TripSharesProvider>
      </TripWeatherProvider>
    </TripDataProvider>
  )
}

/**
 * La coquille d'un voyage, avec « + » (en haut sur téléphone, dans la
 * sidebar sur ordinateur) : étape, hébergement ou trajet, au jour affiché —
 * celui ouvert dans Jours, aujourd'hui pendant le voyage, sinon le premier.
 */
function TripShell({ trip, tab, sub, onChange, children }) {
  const ui = useTripUI()
  const today = useToday()
  const date = (tab === 'jours' && sub) || defaultDay(trip, today)
  const add = { label: 'Ajouter', icon: Plus, onClick: () => ui.newItem(date) }
  return (
    <Shell trip={trip} active={tab} onChange={onChange} action={add} sidebarAction={add}>
      {children}
    </Shell>
  )
}

// Lien vers un voyage supprimé depuis (par l'autre, ou sur un autre appareil).
function TripNotFound() {
  const navigate = useNavigate()
  return (
    <Shell active={LIST_ID} onChange={() => navigate(LIST_PATH)}>
      <div className="max-w-xl mx-auto px-4 pt-16 text-center">
        <p className="text-base font-semibold text-fg">Ce voyage n’existe plus</p>
        <p className="text-sm text-muted mt-1">Il a peut-être été supprimé depuis un autre appareil.</p>
        <Button className="mt-5" onClick={() => navigate(LIST_PATH, { replace: true })}>Mes voyages</Button>
      </div>
    </Shell>
  )
}
