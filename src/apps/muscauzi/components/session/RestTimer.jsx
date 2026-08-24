import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Plus, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { ProgressRing } from '@/shared/ui/Progress.jsx'
import { alarm } from '@/shared/lib/haptics.js'

/**
 * Minuteur de repos, démarré tout seul à la validation d'une série.
 *
 * ── Pourquoi un temps ÉCOULÉ et pas un compte à rebours décrémenté ──────────
 *
 * On repose le téléphone entre deux séries : l'onglet passe en arrière-plan et
 * le navigateur ralentit les timers jusqu'à une fois par minute. Un compteur
 * qui se décrémente aurait dérivé de plusieurs dizaines de secondes. On relit
 * donc l'horloge à chaque image : le `setInterval` ne sert qu'à redéclencher un
 * rendu, jamais à mesurer.
 *
 * Le minuteur ne bloque rien : il flotte au-dessus de la séance, on peut
 * continuer à saisir dessous, et il se ferme d'un geste.
 */
const TICK_MS = 250
const LINGER_MS = 8000   // temps d'affichage une fois le repos écoulé

function mmss(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function RestTimer({ rest, onAdjust, onDismiss }) {
  const [now, setNow] = useState(() => Date.now())
  const rang = useRef(null)

  useEffect(() => {
    if (!rest) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [rest])

  const elapsed = rest ? (now - rest.startedAt) / 1000 : 0
  const remaining = rest ? rest.duration - elapsed : 0
  const isOver = rest && remaining <= 0

  // La sonnerie part une seule fois par repos, et l'encart s'efface ensuite
  // tout seul : rien à fermer à la main quand on a déjà repris la barre.
  useEffect(() => {
    if (!rest || !isOver || rang.current === rest.id) return undefined
    rang.current = rest.id
    alarm()
    const id = setTimeout(() => onDismiss(), LINGER_MS)
    return () => clearTimeout(id)
  }, [rest, isOver, onDismiss])

  if (!rest) return null

  /**
   * Rendu dans `document.body`, pas là où il est écrit.
   *
   * La séance reste montée quand on passe sur Progrès, mais son conteneur est
   * masqué — et `display: none` emporte aussi ses descendants fixes. Le
   * minuteur disparaissait donc dès qu'on allait vérifier une courbe entre
   * deux séries, pour réapparaître au retour. Il compte le repos : il suit
   * partout dans l'app.
   */
  return createPortal(
    <div className="fixed inset-x-0 z-40 px-4 pointer-events-none bottom-[calc(env(safe-area-inset-bottom,0px)+5.25rem)] lg:bottom-6">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'slide-up pointer-events-auto max-w-xl mx-auto flex items-center gap-3 pl-3 pr-2 py-2.5',
          'rounded-2xl border bg-surface/95 backdrop-blur-xl shadow-lift',
          isOver ? 'border-accent' : 'border-border-strong',
        )}
      >
        {/* L'anneau se VIDE : plein au départ, vide à zéro. On lit le temps
            qui reste, pas celui qu'on a déjà passé assis. */}
        <ProgressRing size={38} stroke={3} value={Math.max(0, remaining)} max={rest.duration}>
          <span className="text-[10px] font-semibold text-fg tabular">
            {isOver ? '0:00' : mmss(remaining)}
          </span>
        </ProgressRing>

        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-fg truncate">
            {isOver ? 'Repos terminé' : 'Repos'}
          </span>
          <span className="block text-[11px] text-muted truncate">{rest.label}</span>
        </span>

        {!isOver && (
          <>
            <RestButton label="Trente secondes de moins" onClick={() => onAdjust(-30)}>
              <Minus size={15} />
            </RestButton>
            <RestButton label="Trente secondes de plus" onClick={() => onAdjust(30)}>
              <Plus size={15} />
            </RestButton>
          </>
        )}

        <RestButton label="Fermer le minuteur" onClick={onDismiss}>
          <X size={15} />
        </RestButton>
      </div>
    </div>,
    document.body,
  )
}

function RestButton({ onClick, label, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-muted
                 transition active:scale-90 hover:text-fg hover:bg-surface-2"
    >
      {children}
    </button>
  )
}
