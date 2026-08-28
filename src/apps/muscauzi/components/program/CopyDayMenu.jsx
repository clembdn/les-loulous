import { useState } from 'react'
import { ArrowRight, CalendarRange, Copy, Repeat } from 'lucide-react'
import { Sheet, SheetContent, SheetBody } from '@/shared/ui/sheet.jsx'
import { cn } from '@/shared/lib/utils.js'
import { DAY_LABELS, dayLabel } from '@/shared/lib/dates.js'
import { DOWS } from '../../services/programService.js'

const PARITY_LABEL = { even: 'paire', odd: 'impaire' }

/**
 * Recopier une prescription ailleurs.
 *
 * ── Pourquoi cet écran existe ───────────────────────────────────────────────
 *
 * Le programme est dédoublé en semaine paire et semaine impaire. C'est utile
 * quand on alterne réellement — un ou deux exercices qui changent d'une semaine
 * à l'autre. Ça ne l'est pas quand on fait exactement la même chose des deux
 * côtés : il fallait alors ressaisir sept jours entiers, exercice par exercice,
 * série par série, pour obtenir une copie conforme.
 *
 * Trois copies couvrent tous les cas réels :
 *  · le jour affiché vers l'autre parité — un jour qu'on vient de régler ;
 *  · le jour affiché vers un autre jour — deux séances proches dans la semaine ;
 *  · TOUTE la semaine vers l'autre parité — le cas de celui qui ne varie pas :
 *    une fois, et c'est réglé pour l'année. L'autre part de là et retouche ses
 *    deux exercices.
 *
 * Une copie écrase la destination. Elle passe donc par une confirmation dès que
 * cette destination n'est pas vide.
 */
export default function CopyDayMenu({
  open, onOpenChange, parity, dayOfWeek, dayCounts, otherCounts, weekCount, onCopy,
}) {
  const [pickingDay, setPickingDay] = useState(false)
  const other = parity === 'even' ? 'odd' : 'even'

  const close = (next) => {
    setPickingDay(false)
    onOpenChange(next)
  }

  const run = (payload) => {
    setPickingDay(false)
    onOpenChange(false)
    onCopy(payload)
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        side="bottom"
        desktopSide="right"
        title={pickingDay ? 'Copier vers quel jour ?' : `Copier — ${dayLabel(dayOfWeek).toLowerCase()}`}
        className="bg-surface border-border"
      >
        <SheetBody>
          {pickingDay ? (
            <div className="space-y-1.5">
              {DOWS.filter((d) => d !== dayOfWeek).map((d) => (
                <Choice
                  key={d}
                  icon={CalendarRange}
                  title={DAY_LABELS[d % 7]}
                  detail={dayCounts[d] > 0
                    ? `${dayCounts[d]} exercice${dayCounts[d] > 1 ? 's' : ''} — sera remplacé`
                    : 'Repos'}
                  onClick={() => run({ kind: 'day', target: { parity, dayOfWeek: d } })}
                />
              ))}
            </div>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-muted mb-4">
                La copie remplace ce qu'il y a à l'arrivée. Les séances déjà enregistrées ne
                bougent pas — chacune porte sa propre prescription.
              </p>
              <div className="space-y-1.5">
                <Choice
                  icon={Repeat}
                  title={`Vers la semaine ${PARITY_LABEL[other]}`}
                  detail={otherCounts[dayOfWeek] > 0
                    ? `${dayLabel(dayOfWeek).toLowerCase()} y compte ${otherCounts[dayOfWeek]} exercice${otherCounts[dayOfWeek] > 1 ? 's' : ''} — sera remplacé`
                    : `${dayLabel(dayOfWeek).toLowerCase()} y est au repos`}
                  onClick={() => run({ kind: 'day', target: { parity: other, dayOfWeek } })}
                />
                <Choice
                  icon={Copy}
                  title="Vers un autre jour"
                  detail="Même semaine"
                  onClick={() => setPickingDay(true)}
                />
                <Choice
                  icon={CalendarRange}
                  title={`Toute la semaine vers l'${PARITY_LABEL[other]}`}
                  detail={weekCount > 0
                    ? `Les 7 jours de la semaine ${PARITY_LABEL[other]} seront remplacés`
                    : 'Rien à copier — la semaine est vide'}
                  disabled={weekCount === 0}
                  onClick={() => run({ kind: 'week', target: { parity: other } })}
                />
              </div>
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function Choice({ icon: Icon, title, detail, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-surface text-left',
        'transition active:scale-[0.99] hover:border-border-strong',
        'disabled:opacity-40 disabled:pointer-events-none',
      )}
    >
      <span className="h-9 w-9 shrink-0 rounded-xl bg-surface-2 flex items-center justify-center text-accent">
        <Icon size={16} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-fg">{title}</span>
        <span className="block text-[11px] text-muted mt-0.5 leading-relaxed">{detail}</span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-faint" />
    </button>
  )
}
