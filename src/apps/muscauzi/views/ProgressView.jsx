import { useMemo, useState } from 'react'
import { LineChart as LineChartIcon, Download, Dumbbell, CalendarRange, PersonStanding } from 'lucide-react'
import { Skeleton } from '@/shared/ui/Skeleton.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { Dialog, DialogContent, DialogBody } from '@/shared/ui/dialog.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { useMediaQuery } from '@/shared/lib/useMediaQuery.js'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { useSessions } from '../hooks/useMuscData.js'
import { useMuscData } from '../context/MuscDataContext.jsx'
import { exerciseHistoryIndex } from '../utils/metrics.js'
import { saveNote } from '../services/notesService.js'
import ExerciseDetailView from './ExerciseDetailView.jsx'
import SessionsProgressView from './SessionsProgressView.jsx'
import ExerciseTable from '../components/progress/ExerciseTable.jsx'
import ExportSheet from '../components/progress/ExportSheet.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import MuscleVolume from '../components/progress/MuscleVolume.jsx'

// Au-delà, le tableau prend toute la largeur et le détail s'ouvre PAR-DESSUS,
// en modale. En dessous, il n'y a pas la place pour une modale confortable :
// on navigue d'un écran à l'autre.
const MODAL_QUERY = '(min-width: 1024px)'

export default function ProgressView({ focusedExerciseId, onFocusExercise }) {
  const { exercises, exerciseById, notes, weights, catalogueReady, today } = useMuscData()
  // L'historique COMPLET, non borné : c'est le seul écran qui en a besoin, et
  // c'est lui qui l'ouvre — pas le contexte au démarrage de l'application.
  const { sessions, isLoading: sessionsLoading } = useSessions()
  const { currentUid } = useAuth()
  const isWide = useMediaQuery(MODAL_QUERY)

  // Deux façons de lire sa progression : mouvement par mouvement, ou séance
  // par séance. La première répond à « est-ce que mon développé monte », la
  // seconde à « est-ce que mes Push valent ceux du mois dernier ».
  const [scope, setScope] = useState('exercices')
  const [exporting, setExporting] = useState(false)

  // UNIQUEMENT les exercices que CE profil a réellement travaillés — lu dans
  // l'historique des séances lui-même.
  const trained = useMemo(() => {
    const index = exerciseHistoryIndex(sessions, 1)
    return exercises.filter((exercise) => index[exercise.id])
  }, [exercises, sessions])

  const focused = focusedExerciseId ? exerciseById[focusedExerciseId] : null
  const saveExerciseNote = (exerciseId, text) => saveNote(currentUid, exerciseId, text, currentUid)

  /**
   * Sur téléphone, ouvrir un exercice REMPLACE la liste : il n'y a pas la
   * place pour les deux. Sur grand écran, le tableau garde toute la largeur et
   * le détail s'ouvre en modale — une colonne latérale lui volait la moitié de
   * la page pour n'afficher qu'un graphe à l'étroit.
   */
  if (focused && !isWide) {
    return (
      <ExerciseDetailView
        exercise={focused}
        sessions={sessions}
        isLoading={sessionsLoading}
        note={notes[focused.id] || ''}
        onSaveNote={saveExerciseNote}
        onBack={() => onFocusExercise(null)}
      />
    )
  }

  const isLoading = (!catalogueReady || sessionsLoading) && trained.length === 0

  return (
    <div className={cn(
      'mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6',
      // La largeur ne s'ouvre que pour le tableau : les autres écrans gardent
      // leur colonne de lecture étroite.
      scope === 'exercices' ? 'max-w-xl lg:max-w-6xl' : 'max-w-xl lg:max-w-2xl',
    )}>
      <PageHeader
        eyebrow="Progression"
        title="Mes progrès"
        subtitle="Ton historique à toi."
        action={
          <Button
            variant="secondary"
            size="icon"
            aria-label="Exporter mes performances"
            onClick={() => setExporting(true)}
          >
            <Download size={16} />
          </Button>
        }
      />

      <SegmentedTabs
        items={SCOPES}
        active={scope}
        onChange={setScope}
        desktopHidden={false}
        className="mb-5 lg:max-w-lg"
      />

      {scope === 'muscles' ? (
        sessionsLoading && sessions.length === 0
          ? <Skeleton className="h-[320px]" />
          : <MuscleVolume sessions={sessions} exerciseById={exerciseById} today={today} />
      ) : scope === 'seances' ? (
        <SessionsProgressView
          sessions={sessions}
          isLoading={sessionsLoading}
          exerciseById={exerciseById}
        />
      ) : isLoading ? (
        <Skeleton className="h-[320px]" />
      ) : trained.length === 0 ? (
        <EmptyExercises />
      ) : (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <ExerciseTable
            exercises={trained}
            sessions={sessions}
            selectedId={focused?.id || null}
            onSelect={onFocusExercise}
          />
        </div>
      )}

      {/* Le détail par-dessus le tableau : la ligne d'où l'on vient reste
          surlignée dessous, donc on ne perd pas le fil en refermant. */}
      <Dialog
        open={isWide && !!focused}
        onOpenChange={(next) => { if (!next) onFocusExercise(null) }}
      >
        <DialogContent
          title={focused?.name}
          // La modale par défaut fait 448 px de large : une courbe et un
          // historique de charges y seraient aussi à l'étroit que dans la
          // colonne qu'on vient de supprimer.
          className="sm:max-w-2xl sm:max-h-[85vh] bg-surface border-border"
        >
          <DialogBody>
            {focused && (
              <ExerciseDetailView
                embedded
                exercise={focused}
                sessions={sessions}
                isLoading={sessionsLoading}
                note={notes[focused.id] || ''}
                onSaveNote={saveExerciseNote}
              />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ExportSheet
        open={exporting}
        onOpenChange={setExporting}
        sessions={sessions}
        exerciseById={exerciseById}
        weights={weights}
      />
    </div>
  )
}

function EmptyExercises() {
  return (
    <div className="text-center py-14 px-6 rounded-2xl border border-dashed border-border">
      <LineChartIcon size={28} className="mx-auto text-faint" />
      <p className="text-base font-medium text-fg mt-3">Aucune courbe pour l'instant</p>
      <p className="text-sm text-muted mt-1">
        Valide tes premières séries : chaque exercice apparaîtra ici.
      </p>
    </div>
  )
}

// Trois façons de lire sa progression, à trois échelles : le mouvement, la
// séance, et le corps. La troisième est la seule qui dise ce qu'on néglige.
const SCOPES = [
  { id: 'exercices', label: 'Exercices', short: 'Exercices', icon: Dumbbell },
  { id: 'seances', label: 'Séances', short: 'Séances', icon: CalendarRange },
  { id: 'muscles', label: 'Muscles', short: 'Muscles', icon: PersonStanding },
]
