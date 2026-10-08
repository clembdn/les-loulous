import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Eye, Plane } from 'lucide-react'
import AppShell from '@/shared/ui/AppShell.jsx'
import { ThemedToaster } from '@/shared/ui/sonner.jsx'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { useTabRoute } from '@/shared/lib/useTabRoute.js'
import { useToday } from '@/shared/lib/useToday.js'
import { TripDataValue } from '../context/TripDataContext.jsx'
import { TripWeatherProvider } from '../context/TripWeatherContext.jsx'
import { TripUIProvider } from '../context/TripUIContext.jsx'
import { subscribeToPublicAttachments, subscribeToPublicTrip } from '../services/sharesService.js'
import { markSynced } from '../services/offlineService.js'
import Loader from '../components/Loader.jsx'
import TodayView from '../views/TodayView.jsx'
import DaysView from '../views/DaysView.jsx'
import ResasView from '../views/ResasView.jsx'
import DayRunner from '../components/days/DayRunner.jsx'
import { GUEST_TAB_IDS, RUNNER_ID, tripSidebarGroup, tripTabs } from '../config/navigation.js'
import { tripStatus } from '../utils/tripDates.js'
import { guestPath } from '../utils/publicTrip.js'

/**
 * /v/<jeton> — un voyage partagé, en lecture seule, sans compte.
 *
 * Les mêmes écrans que pour le couple (Aujourd'hui, Jours, Résas, le
 * déroulé), nourris par la vitrine du lien au lieu des données du voyage, et
 * sans aucun bouton de modification (`TripUIProvider readOnly`). Rien ne mène
 * au reste des Loulous. Les changements arrivent en direct ; une fois lue, la
 * vitrine reste consultable hors-ligne, captures comprises (cache Firestore).
 */
export default function GuestApp() {
  useAppTheme('light', 'lagoon')
  useNoIndex()
  const { token } = useParams()
  const [state, setState] = useState({ status: 'loading', data: null })
  const [attachments, setAttachments] = useState([])

  useEffect(() => {
    setState({ status: 'loading', data: null })
    setAttachments([])
    // « Disponible hors-ligne » : la vitrine et ses captures confirmées par le serveur.
    const fresh = {}
    let tripId = null
    const sync = (part) => (fromServer) => {
      fresh[part] = fromServer
      if (tripId && fresh.trip && fresh.files) markSynced(tripId)
    }
    const unsubs = [
      subscribeToPublicTrip(
        token,
        (data) => {
          if (data === undefined) {
            // Rien en cache : le serveur va répondre, sauf hors-ligne.
            if (!navigator.onLine) setState({ status: 'offline', data: null })
            return
          }
          tripId = data?.trip.id || null
          setState(data ? { status: 'ready', data } : { status: 'gone', data: null })
        },
        () => setState({ status: 'gone', data: null }),
        sync('trip'),
      ),
      subscribeToPublicAttachments(token, setAttachments, undefined, sync('files')),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [token])

  return (
    <>
      {state.status === 'loading' && <Loader fullScreen />}
      {state.status === 'gone' && (
        <Message title="Ce voyage n’est plus partagé">
          Le lien a été révoqué, ou il est incomplet. Demandez-en un nouveau à qui vous l’a envoyé.
        </Message>
      )}
      {state.status === 'offline' && (
        <Message title="Pas de réseau">
          Ouvrez ce lien une première fois avec une connexion : le voyage restera ensuite lisible hors-ligne.
        </Message>
      )}
      {state.status === 'ready' && <GuestTrip token={token} data={state.data} attachments={attachments} />}
      <ThemedToaster />
    </>
  )
}

function GuestTrip({ token, data, attachments }) {
  const base = guestPath(token)
  const { tab, sub, goTab, goBack } = useTabRoute(base, GUEST_TAB_IDS, 'aujourdhui')
  const { trip } = data

  useEffect(() => {
    document.title = `${trip.title} · Trip Planner`
  }, [trip.title])

  return (
    <TripDataValue
      trip={trip}
      stays={data.stays}
      transports={data.transports}
      days={data.days}
      attachments={attachments}
      isLoading={false}
    >
      <TripWeatherProvider>
        <TripUIProvider goTab={goTab} goBack={goBack} currentSub={sub} basePath={base} readOnly>
          {tab === RUNNER_ID ? (
            <DayRunner key={sub} date={sub} />
          ) : (
            <GuestShell trip={trip} tab={tab} onChange={goTab}>
              {tab === 'aujourdhui' && <TodayView />}
              {tab === 'jours' && <DaysView selectedDate={sub} />}
              {tab === 'resas' && <ResasView selectedKey={sub} />}
            </GuestShell>
          )}
        </TripUIProvider>
      </TripWeatherProvider>
    </TripDataValue>
  )
}

function GuestShell({ trip, tab, onChange, children }) {
  const today = useToday()
  const status = tripStatus(trip, today)
  const tabs = useMemo(() => tripTabs(status, { guest: true }), [status])
  const sections = useMemo(() => [tripSidebarGroup(trip, status, { guest: true })], [trip, status])
  return (
    <AppShell
      title="Trip Planner"
      icon={Plane}
      heading={trip.title}
      portal={false}
      active={tab}
      onChange={onChange}
      sections={sections}
      tabs={tabs}
      sidebarExtra={(
        <p className="mt-4 px-3 flex items-start gap-2 text-[13px] text-muted">
          <Eye size={14} className="mt-0.5 shrink-0" /> Voyage partagé avec vous, en lecture seule.
        </p>
      )}
    >
      {children}
    </AppShell>
  )
}

function Message({ title, children }) {
  useEffect(() => {
    document.title = 'Trip Planner'
  }, [])
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto h-14 w-14 rounded-2xl bg-accent text-accent-fg flex items-center justify-center">
          <Plane size={24} />
        </span>
        <p className="mt-5 text-xl font-semibold tracking-[-0.01em] text-fg">{title}</p>
        <p className="mt-2 text-[15px] text-muted">{children}</p>
      </div>
    </div>
  )
}

// Une vitrine n'a rien à faire dans un moteur de recherche (l'en-tête
// `X-Robots-Tag` de vercel.json le dit aussi, avant même le JavaScript).
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}
