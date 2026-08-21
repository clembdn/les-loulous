import { useState, useCallback, lazy, Suspense } from 'react'
import { Dumbbell } from 'lucide-react'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import AppShell from '@/shared/ui/AppShell.jsx'
import { Toaster } from '@/shared/ui/sonner.jsx'
import { MUSC_TABS, SIDEBAR_SECTIONS, DEFAULT_TAB, getTab } from './config/navigation.js'
import SessionView from './views/SessionView.jsx'

// Les écrans hors salle sont chargés à la demande : la séance du jour doit
// s'afficher le plus vite possible, téléphone en main.
const ProgressView = lazy(() => import('./views/ProgressView.jsx'))
const TrackingView = lazy(() => import('./views/TrackingView.jsx'))
const ProgramView = lazy(() => import('./views/ProgramView.jsx'))
const CatalogueView = lazy(() => import('./views/CatalogueView.jsx'))

function Loader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <span className="h-7 w-7 border-2 border-fg/15 border-t-accent rounded-full animate-spin" />
    </div>
  )
}

export default function MuscauziApp() {
  useAppTheme('dark', 'red')
  const [tab, setTab] = useState(DEFAULT_TAB)
  // Exercice ouvert dans l'écran Progrès (null = liste des exercices).
  const [focusedExerciseId, setFocusedExerciseId] = useState(null)

  const openExercise = useCallback((exerciseId) => {
    setFocusedExerciseId(exerciseId)
    setTab('progres')
  }, [])

  const changeTab = useCallback((next) => {
    if (next !== 'progres') setFocusedExerciseId(null)
    setTab(next)
  }, [])

  return (
    <>
      <AppShell
        title="MuscAuzi"
        icon={Dumbbell}
        heading={getTab(tab).label}
        active={tab}
        onChange={changeTab}
        sections={SIDEBAR_SECTIONS}
        tabs={MUSC_TABS}
      >
        {/* La séance reste montée : on y revient entre deux séries, elle ne
            doit pas se recharger ni perdre l'accordéon ouvert. */}
        <div className={tab === 'seance' ? '' : 'hidden'}>
          <SessionView
            onOpenExercise={openExercise}
            onOpenWeight={() => changeTab('poids')}
          />
        </div>

        {tab !== 'seance' && (
          <Suspense fallback={<Loader />}>
            {tab === 'progres' && (
              <ProgressView
                focusedExerciseId={focusedExerciseId}
                onFocusExercise={setFocusedExerciseId}
              />
            )}
            {tab === 'poids' && <TrackingView />}
            {tab === 'programme' && <ProgramView onNavigate={changeTab} />}
            {tab === 'catalogue' && <CatalogueView onNavigate={changeTab} />}
          </Suspense>
        )}
      </AppShell>
      <Toaster />
    </>
  )
}
