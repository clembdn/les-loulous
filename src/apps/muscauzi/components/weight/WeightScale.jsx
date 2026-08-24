import { useRef, useEffect, useCallback, useState } from 'react'
import { cn } from '@/shared/lib/utils.js'
import { tick } from '@/shared/lib/haptics.js'

// Règle graduée HORIZONTALE, façon balance mécanique : on fait défiler la
// règle sous une aiguille fixe.
//
// Horizontale et non verticale : sur ordinateur, un défileur vertical imbriqué
// dans une page qui défile déjà est impilotable au pavé tactile — le geste
// part dans la page. À l'horizontale le geste est sans ambiguïté, et on ajoute
// le glisser-déposer à la souris pour ne dépendre d'aucun geste à deux doigts.
//
// Les graduations sont peintes en CSS (deux dégradés répétés) : 1700 pas de
// 100 g feraient 1700 nœuds à animer sur un téléphone.
const MIN_KG = 30
const MAX_KG = 200
const STEP_PX = 8          // un pas = 100 g
const STEPS_PER_KG = 10
const KG_PX = STEP_PX * STEPS_PER_KG
const TRACK_H = 56

function clamp(v) {
  return Math.min(MAX_KG, Math.max(MIN_KG, v))
}
function valueToOffset(value) {
  return (clamp(value) - MIN_KG) * KG_PX
}
function offsetToValue(offset) {
  return clamp(MIN_KG + Math.round(offset / STEP_PX) / STEPS_PER_KG)
}

export default function WeightScale({ value, onChange }) {
  const scrollerRef = useRef(null)
  const settleTimer = useRef(null)
  const rafId = useRef(0)
  const isScrolling = useRef(false)
  const drag = useRef(null)
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)

  /**
   * La règle a-t-elle été touchée PAR QUELQU'UN ?
   *
   * Sans cette distinction, la règle annonçait ses propres mouvements comme
   * s'ils venaient de l'utilisateur. Se positionner au montage déclenche un
   * événement de défilement ; si la mise en page n'est pas encore stabilisée,
   * le navigateur borne la position demandée, la valeur relue diffère de celle
   * reçue, et `onChange` partait avec un chiffre que personne n'avait choisi.
   *
   * L'écran au-dessus en concluait « l'utilisateur a réglé la balance » et
   * cessait définitivement d'adopter la dernière pesée venue de Firestore : la
   * molette restait bloquée sur sa valeur de repli. C'est ce qui affichait 70 kg
   * à chaque ouverture.
   *
   * On n'annonce donc un changement que si un geste réel l'a précédé.
   */
  const userDriven = useRef(false)
  const engage = () => { userDriven.current = true }

  // Positionnement initial, et recalage si la valeur change de l'extérieur —
  // mais jamais pendant que l'utilisateur manipule la règle.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || isScrolling.current) return
    el.scrollLeft = valueToOffset(value)
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    // Défilement provoqué par le code (positionnement, recalage) : il ne dit
    // rien de l'intention de l'utilisateur, donc il ne remonte rien.
    if (!userDriven.current) return

    isScrolling.current = true
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0
        const next = offsetToValue(el.scrollLeft)
        if (next !== value) {
          // Un cran = une micro-vibration, comme le curseur d'une balance.
          tick()
          onChange(next)
        }
      })
    }
    // Fin de défilement : on se cale pile sur la graduation. Le recalage est
    // lui-même un défilement du code — d'où la remise à zéro AVANT de le
    // lancer, pour qu'il ne se réannonce pas.
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      isScrolling.current = false
      userDriven.current = false
      const target = valueToOffset(offsetToValue(el.scrollLeft))
      if (Math.abs(el.scrollLeft - target) > 0.5) el.scrollTo({ left: target, behavior: 'smooth' })
    }, 140)
  }, [value, onChange])

  useEffect(() => () => {
    clearTimeout(settleTimer.current)
    if (rafId.current) cancelAnimationFrame(rafId.current)
  }, [])

  // Glisser à la souris : le pavé tactile n'a pas besoin d'un geste horizontal.
  const onPointerDown = (e) => {
    engage()
    // Au doigt, le défilement natif suffit : seul le pointeur a besoin qu'on
    // lui fabrique un glisser-déposer.
    if (e.pointerType === 'touch') return
    const el = scrollerRef.current
    if (!el) return
    drag.current = { x: e.clientX, left: el.scrollLeft }
    setDragging(true)
    el.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const el = scrollerRef.current
    if (!el) return
    el.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
  }
  const endDrag = (e) => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    scrollerRef.current?.releasePointerCapture?.(e.pointerId)
  }

  const nudge = (delta) => onChange(Math.round(clamp(value + delta) * 10) / 10)

  const labels = []
  for (let kg = MIN_KG; kg <= MAX_KG; kg += 1) labels.push(kg)

  return (
    <div className="relative select-none">
      {/* Aiguille de lecture : c'est elle qui donne la valeur. */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 z-10 w-[3px] rounded-full bg-accent"
        style={{ height: TRACK_H }}
      />
      {/* Estompage aux extrémités : la règle paraît tourner sur un cylindre.
          Il couvre TOUTE la hauteur, étiquettes comprises — sinon un nombre se
          fait trancher net au bord au lieu de s'effacer. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-surface via-surface/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-surface via-surface/80 to-transparent" />

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onWheel={engage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          'overflow-x-auto no-scrollbar overscroll-x-contain touch-pan-x',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{ opacity: ready ? 1 : 0 }}
        role="slider"
        tabIndex={0}
        aria-label="Poids en kilogrammes"
        aria-valuemin={MIN_KG}
        aria-valuemax={MAX_KG}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(1)} kilogrammes`}
        onKeyDown={(e) => {
          engage()
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); nudge(-0.1) }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); nudge(0.1) }
          if (e.key === 'PageDown') { e.preventDefault(); nudge(-1) }
          if (e.key === 'PageUp') { e.preventDefault(); nudge(1) }
        }}
      >
        <div className="flex" style={{ height: TRACK_H + 22 }}>
          {/* Demi-largeur de rembourrage : la première et la dernière
              graduation doivent pouvoir atteindre l'aiguille centrale. */}
          <div className="shrink-0 w-1/2" />
          <div
            className="relative shrink-0"
            style={{
              width: (MAX_KG - MIN_KG) * KG_PX,
              height: TRACK_H,
              // Le kilo est peint en premier : les couches CSS s'empilent dans
              // l'ordre, le trait fort doit passer par-dessus celui de 100 g.
              backgroundImage: [
                `repeating-linear-gradient(to right, rgb(var(--fg) / 0.45) 0 1px, transparent 1px ${KG_PX}px)`,
                `repeating-linear-gradient(to right, rgb(var(--fg) / 0.16) 0 1px, transparent 1px ${STEP_PX}px)`,
              ].join(','),
              backgroundSize: `100% ${TRACK_H}px, 100% ${TRACK_H * 0.45}px`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'left top, left top',
            }}
          >
            {labels.map((kg) => (
              <span
                key={kg}
                className="absolute -translate-x-1/2 text-[11px] text-muted tabular"
                style={{ left: (kg - MIN_KG) * KG_PX, top: TRACK_H + 4 }}
              >
                {kg}
              </span>
            ))}
          </div>
          <div className="shrink-0 w-1/2" />
        </div>
      </div>
    </div>
  )
}
