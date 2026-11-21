import { Check } from 'lucide-react'
import { Sheet, SheetContent, SheetBody } from '@/shared/ui/sheet.jsx'
import { cn } from '@/shared/lib/utils.js'
import { formatDayFr, fromLocalDateKey } from '@/shared/lib/dates.js'

/**
 * Choisir une autre séance de la boucle pour la date affichée.
 *
 * La boucle propose la séance qui suit la dernière faite ; ce tiroir sert les
 * jours où l'on fait autre chose — machine prise, envie de décaler. La date de
 * la dernière fois accompagne chaque séance : c'est elle qui dit laquelle
 * attend depuis le plus longtemps.
 *
 * Le choix ne s'écrit nulle part tant qu'aucune série n'est saisie : il est
 * tenu par l'écran de séance, et la première saisie l'inscrit dans la séance.
 */
export default function RotationPickerSheet({ open, onOpenChange, slots, current, lastDone, onPick }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        desktopSide="right"
        title="Quelle séance aujourd'hui ?"
        className="bg-surface border-border"
      >
        <SheetBody>
          <div className="space-y-1.5">
            {slots.map((s) => {
              const active = s.slot === current
              const last = lastDone?.[s.slot]
              return (
                <button
                  key={s.slot}
                  onClick={() => { onPick(s.slot); onOpenChange(false) }}
                  aria-pressed={active}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left',
                    'transition active:scale-[0.99]',
                    active ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-border-strong',
                  )}
                >
                  <span className={cn(
                    'h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-sm font-semibold tabular',
                    active ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg',
                  )}>
                    {s.position}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium text-fg truncate">
                      {s.name || `Séance ${s.position}`}
                    </span>
                    <span className="block text-[11px] text-muted mt-0.5">
                      {last ? `Dernière fois : ${formatDayFr(fromLocalDateKey(last))}` : 'Jamais faite'}
                    </span>
                  </span>
                  {active && <Check size={16} className="shrink-0 text-accent" />}
                </button>
              )
            })}
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
