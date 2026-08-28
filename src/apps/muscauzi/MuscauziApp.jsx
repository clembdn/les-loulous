import { Suspense, lazy, useCallback, useState } from 'react'
import { Play } from 'lucide-react'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { MuscDataProvider } from './context/MuscDataContext.jsx'
import { DEFAULT_TAB } from './config/navigation.js'
import Shell from './components/layout/Shell.jsx'
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
  return (
    <MuscDataProvider>
      <MuscauziScreens />
    </MuscDataProvider>
  )
}

function MuscauziScreens() {
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

  /**
   * Chaque écran est démonté quand on le quitte.
   *
   * La séance restait montée derrière un `hidden`, pour ne pas perdre
   * l'accordéon ouvert et les champs à moitié remplis. Il n'y a plus ni
   * accordéon ni brouillon à préserver : ce qui est saisi est écrit, et
   * Firestore le rend depuis son cache local en revenant. Rester monté ne
   * gardait plus rien — mais gardait la date du jour figée au montage, et
   * dédoublait les écoutes de l'écran par-dessus lequel on naviguait.
   */
  return (
    <Shell
      active={tab}
      onChange={changeTab}
      sidebarAction={
        tab === 'seance'
          ? null
          : { label: 'La séance du jour', icon: Play, onClick: () => changeTab('seance') }
      }
    >
      <Suspense fallback={<Loader />}>
        {tab === 'seance' && (
          <SessionView
            onOpenExercise={openExercise}
            onOpenWeight={() => changeTab('poids')}
          />
        )}
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
    </Shell>
  )
}
