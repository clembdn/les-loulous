import { useMemo } from 'react'
import { ChevronRight, LineChart as LineChartIcon } from 'lucide-react'
import { fromLocalDateKey, formatDateFr } from '@/shared/lib/dates.js'
import { useExercises, useSessions, useLastPerf, useNotes } from '../hooks/useMuscData.js'
import { formatSets } from '../utils/metrics.js'
import { getExerciseType } from '../config/exercises.js'
import { saveNote } from '../services/notesService.js'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import ExerciseDetailView from './ExerciseDetailView.jsx'

export default function ProgressView({ focusedExerciseId, onFocusExercise }) {
  const { exercises, exerciseById, isLoading: exercisesLoading } = useExercises()
  const { sessions, isLoading: sessionsLoading } = useSessions()
  const { lastPerf } = useLastPerf()
  const { notes } = useNotes()
  const { currentUid } = useAuth()
  // Aperçu du MOUVEMENT : la dernière fois qu'il a été fait, toutes
  // occurrences confondues.
  const byExercise = lastPerf.byExercise

  // Ceux qu'on a déjà faits d'abord, du plus récent au plus ancien : c'est là
  // qu'on va regarder en pratique.
  const ordered = useMemo(() => {
    return [...exercises].sort((a, b) => {
      const da = byExercise[a.id]?.date || ''
      const db = byExercise[b.id]?.date || ''
      if (da && db) return db.localeCompare(da)
      if (da) return -1
      if (db) return 1
      return a.name.localeCompare(b.name, 'fr')
    })
  }, [exercises, byExercise])

  const focused = focusedExerciseId ? exerciseById[focusedExerciseId] : null
  if (focused) {
    return (
      <ExerciseDetailView
        exercise={focused}
        sessions={sessions}
        isLoading={sessionsLoading}
        note={notes[focused.id] || ''}
        onSaveNote={(exerciseId, text) => saveNote(currentUid, exerciseId, text, currentUid)}
        onBack={() => onFocusExercise(null)}
      />
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-faint">Progression</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1">Mes exercices</h1>
      </header>

      {exercisesLoading && ordered.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[62px] rounded-xl border border-border bg-surface animate-pulse" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <div className="text-center py-14 px-6 rounded-2xl border border-dashed border-border">
          <LineChartIcon size={28} className="mx-auto text-faint" />
          <p className="text-base font-medium text-fg mt-3">Aucun exercice</p>
          <p className="text-sm text-muted mt-1">Ajoute-les depuis les réglages.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {ordered.map((ex) => {
            const last = byExercise[ex.id]
            return (
              <button
                key={ex.id}
                onClick={() => onFocusExercise(ex.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-surface text-left active:bg-surface-2 transition"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-fg truncate">{ex.name}</span>
                  <span className="block text-xs text-muted mt-0.5 truncate tabular">
                    {last
                      ? `${formatDateFr(fromLocalDateKey(last.date))} · ${formatSets(last.sets)}`
                      : getExerciseType(ex.type).label}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-faint" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
