import { useState, useMemo } from 'react'
import { Search, Check, Library } from 'lucide-react'
import { Sheet, SheetContent, SheetBody, SheetFooter } from '@/shared/ui/sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { EXERCISE_LIBRARY, exerciseKey, LIBRARY_COUNT } from '../../config/exerciseLibrary.js'
import { getExerciseType } from '../../config/exercises.js'

/**
 * Choisir ses exercices dans la bibliothèque plutôt que de les taper.
 *
 * On en coche PLUSIEURS avant de valider : monter son catalogue est un moment
 * unique, où l'on veut poser d'un coup les dix mouvements de son programme.
 * Un ajout par exercice aurait voulu dire rouvrir le panneau dix fois.
 *
 * Ce qui est déjà au catalogue reste visible, estompé et inerte — le faire
 * disparaître donnerait l'impression qu'il manque à la liste, et on le
 * chercherait.
 */
export default function ExerciseLibrarySheet({ open, onOpenChange, existing, onAdd, busy }) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState({})

  const groups = useMemo(() => {
    const needle = exerciseKey(query)
    if (!needle) return EXERCISE_LIBRARY
    return EXERCISE_LIBRARY
      .map((g) => ({ ...g, items: g.items.filter((i) => exerciseKey(i.name).includes(needle)) }))
      .filter((g) => g.items.length > 0)
  }, [query])

  const selected = useMemo(() => Object.values(picked).filter(Boolean), [picked])

  // L'item retenu emporte le GROUPE de la section d'où il vient : la
  // bibliothèque le connaît, et c'est le seul endroit où on l'a sous la main.
  const toggle = (item, group) => {
    const key = exerciseKey(item.name)
    setPicked((prev) => ({ ...prev, [key]: prev[key] ? null : { ...item, group } }))
  }

  // Le panneau se rouvre vierge : une sélection laissée d'une fois sur l'autre
  // se rajouterait sans qu'on l'ait redemandé.
  const close = (next) => {
    if (!next) { setPicked({}); setQuery('') }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="bottom" desktopSide="right" title="Bibliothèque d'exercices" className="max-h-[88vh] bg-surface border-border">
        <div className="px-5 pt-4 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Chercher parmi ${LIBRARY_COUNT} exercices`}
              className="pl-9"
            />
          </div>
        </div>

        <SheetBody className="pt-3">
          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              Aucun exercice ne correspond — tu peux le créer à la main.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.group} className="mb-4 last:mb-0">
                <h3 className="text-[10px] uppercase tracking-[0.16em] text-faint mb-1.5">
                  {group.group}
                </h3>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const key = exerciseKey(item.name)
                    const already = existing.has(key)
                    const isPicked = !!picked[key]
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={already}
                        onClick={() => toggle(item, group.group)}
                        aria-pressed={isPicked}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition',
                          already
                            ? 'opacity-40 cursor-default'
                            : isPicked
                              ? 'bg-accent/10 ring-1 ring-inset ring-accent/30'
                              : 'hover:bg-surface-2',
                        )}
                      >
                        <span className={cn(
                          'h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition',
                          isPicked ? 'bg-accent border-accent text-accent-fg' : 'border-border-strong text-transparent',
                        )}>
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-fg truncate">{item.name}</span>
                          <span className="block text-[11px] text-faint">
                            {getExerciseType(item.type).label}
                            {already && ' · déjà au catalogue'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </SheetBody>

        <SheetFooter>
          <Button
            size="lg"
            className="w-full"
            disabled={selected.length === 0 || busy}
            onClick={() => onAdd(selected)}
          >
            <Library size={16} />
            {busy
              ? 'Ajout…'
              : selected.length === 0
                ? 'Sélectionne des exercices'
                : `Ajouter ${selected.length} exercice${selected.length > 1 ? 's' : ''}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
