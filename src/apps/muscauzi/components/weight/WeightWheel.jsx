import { useRef, useEffect, useCallback, useState } from 'react'

// Molette verticale « balance mécanique » : on fait défiler une règle graduée,
// le trait central donne la valeur. Pas de champ texte.
//
// Les graduations sont peintes en CSS (deux dégradés répétés) plutôt qu'en DOM :
// 1700 pas de 100 g feraient 1700 nœuds à animer sur un téléphone. Seules les
// étiquettes des kilos entiers sont de vrais éléments.
const MIN_KG = 30
const MAX_KG = 200
const STEP_PX = 8          // un pas = 100 g
const STEPS_PER_KG = 10
const KG_PX = STEP_PX * STEPS_PER_KG

function clamp(v) {
  return Math.min(MAX_KG, Math.max(MIN_KG, v))
}

function valueToOffset(value) {
  return (clamp(value) - MIN_KG) * KG_PX
}

function offsetToValue(offset) {
  const steps = Math.round(offset / STEP_PX)
  return clamp(MIN_KG + steps / STEPS_PER_KG)
}

export default function WeightWheel({ value, onChange, height = 220 }) {
  const scrollerRef = useRef(null)
  const settleTimer = useRef(null)
  const rafId = useRef(0)
  // Une valeur poussée par le parent ne doit pas relancer un scroll pendant
  // que le doigt est encore sur la molette.
  const isScrolling = useRef(false)
  const [ready, setReady] = useState(false)

  // Positionnement initial (et recalage si la valeur change de l'extérieur).
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || isScrolling.current) return
    el.scrollTop = valueToOffset(value)
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    isScrolling.current = true
    if (rafId.current) return
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0
      const next = offsetToValue(el.scrollTop)
      if (next !== value) {
        // Un cran de molette = une petite vibration, comme le curseur d'une balance.
        navigator.vibrate?.(4)
        onChange(next)
      }
    })

    // Fin de défilement : on se cale pile sur la graduation.
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      isScrolling.current = false
      const target = valueToOffset(offsetToValue(el.scrollTop))
      if (Math.abs(el.scrollTop - target) > 0.5) {
        el.scrollTo({ top: target, behavior: 'smooth' })
      }
    }, 140)
  }, [value, onChange])

  useEffect(() => () => {
    clearTimeout(settleTimer.current)
    if (rafId.current) cancelAnimationFrame(rafId.current)
  }, [])

  const labels = []
  for (let kg = MIN_KG; kg <= MAX_KG; kg += 1) {
    labels.push(kg)
  }

  return (
    <div className="relative select-none" style={{ height }}>
      {/* Trait de lecture : c'est lui qui donne la valeur. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex items-center">
        <div className="h-[3px] flex-1 rounded-full bg-accent" />
      </div>
      {/* Estompage haut/bas pour que la règle paraisse tourner sur un cylindre. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 z-10 bg-gradient-to-b from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 z-10 bg-gradient-to-t from-surface to-transparent" />

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto no-scrollbar overscroll-contain touch-pan-y"
        style={{ opacity: ready ? 1 : 0 }}
        role="slider"
        tabIndex={0}
        aria-label="Poids en kilogrammes"
        aria-valuemin={MIN_KG}
        aria-valuemax={MAX_KG}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(1)} kilogrammes`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const next = clamp(value + (e.key === 'ArrowUp' ? 0.1 : -0.1))
            onChange(Math.round(next * 10) / 10)
          }
        }}
      >
        {/* Demi-hauteur de rembourrage en haut et en bas : la première et la
            dernière graduation doivent pouvoir atteindre le trait central. */}
        <div style={{ height: height / 2 }} />
        <div
          className="relative"
          style={{
            height: (MAX_KG - MIN_KG) * KG_PX,
            // Le kilo est listé en premier : les couches CSS s'empilent dans
            // l'ordre, le trait fort doit passer par-dessus celui de 100 g.
            backgroundImage: [
              `repeating-linear-gradient(to bottom, rgb(var(--fg) / 0.45) 0 1px, transparent 1px ${KG_PX}px)`,
              `repeating-linear-gradient(to bottom, rgb(var(--fg) / 0.16) 0 1px, transparent 1px ${STEP_PX}px)`,
            ].join(','),
            backgroundSize: `52px 100%, 28px 100%`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'left top, left top',
          }}
        >
          {labels.map((kg) => (
            <span
              key={kg}
              className="absolute left-[62px] -translate-y-1/2 text-xs text-muted tabular"
              style={{ top: (kg - MIN_KG) * KG_PX }}
            >
              {kg}
            </span>
          ))}
        </div>
        <div style={{ height: height / 2 }} />
      </div>
    </div>
  )
}
