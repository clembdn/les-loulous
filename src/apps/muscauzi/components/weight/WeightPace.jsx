import { useState } from 'react'
import { Minus, Plus, Target } from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { Button } from '@/shared/ui/Button.jsx'
import { rateStatus, weeklyRate } from '../../utils/weightTrend.js'

/**
 * Le RYTHME du poids face à la cible — le coach de la balance.
 *
 * Une seule question : est-ce que je prends (ou perds) au bon rythme ? Le
 * rythme est la pente des pesées des 14 derniers jours (cf. utils/weightTrend),
 * pas l'écart d'une pesée à l'autre, qui n'est que du bruit. Face à une zone
 * cible réglable, il devient une consigne : continuer, manger un peu plus, ou
 * un peu moins. Des règles, pas de devinette.
 */
const STEP = 0.05
const LIMIT = 1
const DEFAULT_TARGET = { min: 0.3, max: 0.4 }

export function formatRate(value) {
  const rounded = Math.round(value * 100) / 100
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded.toFixed(2).replace('.', ',')}`
}

const VERDICT = {
  within: { label: 'Dans la cible', advice: 'Continue comme ça.', tone: 'accent' },
  below: { label: 'Sous la cible', advice: 'Ajoute un peu à tes repas.', tone: 'muted' },
  above: { label: 'Au-dessus de la cible', advice: 'Réduis un peu tes repas.', tone: 'muted' },
}

export default function WeightPace({ weights, today, target, canEdit, onSaveTarget }) {
  const [editing, setEditing] = useState(false)
  const pace = weeklyRate(weights, today)
  const status = rateStatus(pace?.rate, target)
  const verdict = status ? VERDICT[status] : null

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-faint truncate">Rythme · 14 jours</p>
        {verdict && (
          <span className={cn(
            'shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold',
            verdict.tone === 'accent' ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted',
          )}>
            {verdict.label}
          </span>
        )}
      </div>

      {pace ? (
        <>
          <p className="mt-1 text-2xl font-semibold text-fg tabular tracking-[-0.02em]">
            {formatRate(pace.rate)} <span className="text-sm font-normal text-muted">kg / semaine</span>
          </p>
          {target && <PaceGauge rate={pace.rate} target={target} />}
          {verdict && <p className="text-[13px] text-muted mt-2">{verdict.advice}</p>}
        </>
      ) : (
        <p className="mt-1 text-[13px] text-muted">
          Pas encore assez de pesées : il en faut trois, étalées sur au moins une semaine.
        </p>
      )}

      {editing ? (
        <TargetEditor
          initial={target || DEFAULT_TARGET}
          hasTarget={!!target}
          onCancel={() => setEditing(false)}
          onSave={(next) => { onSaveTarget(next); setEditing(false) }}
        />
      ) : canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 inline-flex items-center gap-1.5 h-9 text-xs font-medium text-accent hover:opacity-80 transition tabular"
        >
          <Target size={13} />
          {target
            ? `Cible ${formatRate(target.min)} à ${formatRate(target.max)} kg/sem · modifier`
            : 'Définir une cible de rythme'}
        </button>
      )}
    </div>
  )
}

/**
 * La zone cible sur une règle, et le rythme actuel comme un repère : on voit
 * d'un coup d'œil si l'on est dedans, et de combien on en sort.
 */
function PaceGauge({ rate, target }) {
  const lo = Math.min(target.min, rate) - 0.25
  const hi = Math.max(target.max, rate) + 0.25
  const at = (v) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div className="relative h-2.5 mt-3 rounded-full bg-surface-2" aria-hidden="true">
      <span
        className="absolute inset-y-0 rounded-full bg-accent/30"
        style={{ left: at(target.min), width: `calc(${at(target.max)} - ${at(target.min)})` }}
      />
      <span
        className="absolute -top-1 -bottom-1 w-1 -ml-0.5 rounded-full bg-fg"
        style={{ left: at(rate) }}
      />
    </div>
  )
}

function TargetEditor({ initial, hasTarget, onCancel, onSave }) {
  const [min, setMin] = useState(initial.min)
  const [max, setMax] = useState(initial.max)
  const clamp = (v) => Math.round(Math.min(LIMIT, Math.max(-LIMIT, v)) * 100) / 100

  return (
    <div className="mt-3 p-3 rounded-xl border border-accent/30 bg-surface-2/40">
      <p className="text-[11px] text-muted mb-2.5">
        Zone cible, en kg par semaine — positive pour prendre, négative pour perdre.
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <RateStepper
          label="min"
          value={min}
          onChange={(v) => { const next = clamp(v); setMin(next); if (next > max) setMax(next) }}
        />
        <RateStepper
          label="max"
          value={max}
          onChange={(v) => { const next = clamp(v); setMax(next); if (next < min) setMin(next) }}
        />
      </div>
      <div className="flex gap-2 mt-3">
        {hasTarget && (
          <Button variant="outline" className="text-xs" onClick={() => onSave(null)}>Retirer</Button>
        )}
        <Button variant="outline" className="flex-1 text-xs" onClick={onCancel}>Annuler</Button>
        <Button className="flex-1 text-xs" onClick={() => onSave({ min, max })}>Enregistrer</Button>
      </div>
    </div>
  )
}

function RateStepper({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="secondary" size="icon" className="h-11 w-11" aria-label={`Baisser le ${label}`} onClick={() => onChange(value - STEP)}>
        <Minus size={15} />
      </Button>
      <span className="w-14 text-center text-sm font-semibold text-fg tabular">
        {formatRate(value)}
        <span className="block text-[10px] font-normal text-faint leading-none">{label}</span>
      </span>
      <Button variant="secondary" size="icon" className="h-11 w-11" aria-label={`Monter le ${label}`} onClick={() => onChange(value + STEP)}>
        <Plus size={15} />
      </Button>
    </div>
  )
}
