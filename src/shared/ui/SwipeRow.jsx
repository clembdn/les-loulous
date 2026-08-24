import { useRef, useState, useCallback } from 'react'
import { cn } from '@/shared/lib/utils.js'
import { tick, confirm as hapticConfirm } from '@/shared/lib/haptics.js'

/**
 * Ligne que l'on fait glisser pour déclencher une action, façon boîte mail.
 *
 * `left` se découvre en tirant vers la DROITE, `right` en tirant vers la
 * GAUCHE — le panneau reste du côté d'où le doigt vient, comme partout ailleurs
 * sur un téléphone.
 *
 * ── Ce qui fait qu'un glissement se sent juste ───────────────────────────────
 *
 * 1. AXE VERROUILLÉ. Tant qu'on n'a pas bougé de 6 px, on ne décide rien. Au
 *    delà, le geste appartient soit à la ligne, soit à la page — jamais aux
 *    deux, sinon la liste tremble à chaque tentative de défilement.
 * 2. ÉLASTIQUE. Passé la largeur du panneau, la ligne continue d'avancer mais
 *    trois fois moins vite. Un mur net donne l'impression d'un bug ; la
 *    résistance dit « tu es au bout » sans rien bloquer.
 * 3. UN SEUL CRAN. La vibration part au franchissement du seuil, dans un sens
 *    comme dans l'autre, et une seule fois : c'est elle qui remplace le
 *    « clic » d'un bouton.
 * 4. LE CLIC EST AVALÉ. Un glissement qui finit sur un bouton ne doit pas
 *    l'actionner en plus.
 *
 * Le glissement ne remplace JAMAIS un contrôle : c'est un raccourci qui double
 * un bouton visible, sans quoi l'action serait hors d'atteinte au clavier.
 */

// Le panneau doit être assez large pour que son étiquette tienne EN ENTIER :
// à 88 px, « Validée » se faisait trancher par la ligne qui glissait par-dessus,
// et le geste annonçait une action dont on ne lisait que la moitié.
const REVEAL = 112     // largeur du panneau découvert
const TRIGGER = 64     // au-delà, relâcher déclenche
const AXIS_LOCK = 6    // distance avant de décider à qui appartient le geste
const RUBBER = 0.32    // résistance au-delà du panneau

const TONES = {
  accent:  'bg-accent text-accent-fg',
  danger:  'bg-danger text-white',
  // `surface-2` était la couleur des champs juste à côté : le panneau ne se
  // distinguait pas du fond et le geste semblait ne rien découvrir.
  neutral: 'bg-fg/10 text-fg',
}

/**
 * Le geste appartient-il au contrôle sous le doigt plutôt qu'à la ligne ?
 *
 * À la SOURIS, oui : glisser dans un champ y sélectionne du texte, et le voler
 * pour faire défiler la ligne rendrait tout champ inéditable au pointeur.
 *
 * Au DOIGT, non. Une ligne de série est presque entièrement faite de champs :
 * les exclure reviendrait à réserver le glissement à la fine bande d'étiquette
 * au-dessus — autant dire à le supprimer. Sur tactile, sélectionner du texte
 * demande de toute façon un appui long, que ce glissement ne croise jamais.
 */
function startsOnControl(event) {
  if (event.pointerType === 'touch') return false
  return !!event.target?.closest?.('input, textarea, select, button, a, [role="slider"]')
}

export default function SwipeRow({
  left = null,
  right = null,
  disabled = false,
  className,
  rowClassName,
  children,
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)

  const origin = useRef(null)   // { x, y } au pointerdown
  const axis = useRef(null)     // 'h' → la ligne prend la main | 'v' → la page
  const dxRef = useRef(0)
  const armed = useRef(null)    // 'left' | 'right' — seuil déjà franchi
  const moved = useRef(false)

  const enabled = !disabled && (left || right)

  const reset = useCallback(() => {
    setDragging(false)
    setDx(0)
    dxRef.current = 0
    origin.current = null
    axis.current = null
    armed.current = null
  }, [])

  const onPointerDown = (e) => {
    if (!enabled || startsOnControl(e)) return
    /**
     * Lignes IMBRIQUÉES : une série glisse à l'intérieur d'un exercice qui
     * glisse lui aussi. Sans arbitre, un même geste déplaçait les deux d'un
     * coup. React remonte l'événement de l'intérieur vers l'extérieur : la
     * ligne la plus intérieure le réclame, et celles qui l'englobent passent
     * leur tour. `stopPropagation` aurait aussi fait taire les autres
     * gestionnaires légitimes du même arbre.
     */
    if (e.nativeEvent.swipeRowClaimed) return
    e.nativeEvent.swipeRowClaimed = true
    origin.current = { x: e.clientX, y: e.clientY }
    axis.current = null
    armed.current = null
    moved.current = false
  }

  const onPointerMove = (e) => {
    if (!origin.current) return
    const ddx = e.clientX - origin.current.x
    const ddy = e.clientY - origin.current.y

    if (!axis.current) {
      if (Math.abs(ddx) < AXIS_LOCK && Math.abs(ddy) < AXIS_LOCK) return
      axis.current = Math.abs(ddx) > Math.abs(ddy) ? 'h' : 'v'
      if (axis.current === 'h') {
        setDragging(true)
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pas de capture : le geste marche quand même */ }
      }
    }
    if (axis.current !== 'h') return

    // Un côté sans action ne s'ouvre pas du tout.
    const allowed = ddx > 0 ? !!left : !!right
    if (!allowed) { dxRef.current = 0; setDx(0); return }

    moved.current = true
    const magnitude = Math.abs(ddx)
    const eased = magnitude <= REVEAL ? magnitude : REVEAL + (magnitude - REVEAL) * RUBBER
    const next = Math.sign(ddx) * eased

    const side = next > 0 ? 'left' : 'right'
    const crossed = eased >= TRIGGER
    if (crossed && armed.current !== side) { armed.current = side; tick() }
    if (!crossed && armed.current) armed.current = null

    dxRef.current = next
    setDx(next)
  }

  const onPointerUp = () => {
    if (!origin.current) return
    const side = armed.current
    const action = side === 'left' ? left : side === 'right' ? right : null
    reset()
    if (action) { hapticConfirm(); action.onAction?.() }
  }

  // Progression 0→1 : le panneau se révèle et son icône grandit avec le geste,
  // pour qu'on voie arriver le déclenchement au lieu de le subir.
  const progress = Math.min(1, Math.abs(dx) / TRIGGER)
  const side = dx > 0 ? 'left' : dx < 0 ? 'right' : null
  const panel = side === 'left' ? left : side === 'right' ? right : null

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {panel && (
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-0 flex items-center gap-2 px-4 pointer-events-none',
            side === 'left' ? 'justify-start' : 'justify-end',
            TONES[panel.tone] || TONES.accent,
          )}
          style={{ opacity: 0.35 + progress * 0.65 }}
        >
          <span
            className="inline-flex items-center gap-2 origin-center"
            style={{ transform: `scale(${0.8 + progress * 0.2})` }}
          >
            {panel.icon && <panel.icon size={16} strokeWidth={2.8} />}
            {panel.label && <span className="text-sm font-semibold">{panel.label}</span>}
          </span>
        </div>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
        onClickCapture={(e) => {
          if (!moved.current) return
          e.preventDefault(); e.stopPropagation(); moved.current = false
        }}
        style={{ transform: `translateX(${dx}px)`, touchAction: 'pan-y' }}
        className={cn(
          'relative bg-surface',
          !dragging && 'transition-transform duration-300 ease-ios',
          rowClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
