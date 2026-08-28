import { Sheet, SheetContent, SheetBody } from '@/shared/ui/sheet.jsx'
import ExerciseDetailView from '../../views/ExerciseDetailView.jsx'

/**
 * L'historique d'un mouvement, PAR-DESSUS la séance.
 *
 * « Voir la progression » changeait d'onglet. On quittait donc la séance en
 * cours pour consulter une courbe, et il fallait revenir, retrouver son
 * exercice, se rappeler où on en était — pour une question qu'on se pose entre
 * deux séries, en dix secondes : « j'étais à combien le mois dernier ? ».
 *
 * Le contenu est exactement celui de l'écran Progrès, en mode `embedded` : la
 * courbe, les métriques et l'historique daté, sans en-tête ni bouton retour.
 * Une seule définition de « la fiche d'un exercice », affichée à deux endroits.
 */
export default function ExerciseHistorySheet({
  open, onOpenChange, exercise, sessions, notes, onSaveNote,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        desktopSide="right"
        title={exercise?.name || 'Progression'}
        className="max-h-[88vh] sm:max-w-xl bg-surface border-border"
      >
        <SheetBody>
          {exercise && (
            <ExerciseDetailView
              embedded
              exercise={exercise}
              sessions={sessions}
              isLoading={false}
              note={notes[exercise.id] || ''}
              onSaveNote={onSaveNote}
            />
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
