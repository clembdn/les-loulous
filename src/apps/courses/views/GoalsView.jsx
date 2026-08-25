import { useState, useEffect } from 'react'
import { Calculator, Check } from 'lucide-react'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { cn } from '@/shared/lib/utils.js'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { formatDateFr } from '@/shared/lib/dates.js'
import { toNumber } from '../utils/quantity.js'
import { computeGoals, ACTIVITY_LEVELS, AIMS } from '../utils/mifflin.js'
import { saveGoals } from '../services/nutritionGoalsService.js'
import { useLatestWeight } from '../hooks/useLatestWeight.js'

// Objectifs personnels. Deux façons d'y arriver :
//   • les estimer (Mifflin-St Jeor) à partir du profil et du dernier poids
//     déjà enregistré dans MuscAuzi — aucune double saisie ;
//   • les écrire directement, si on suit déjà des chiffres donnés ailleurs.
// L'estimation reste une suggestion : elle remplit les champs, ne les verrouille pas.

const FIELDS = [
  { key: 'kcal', label: 'Calories', suffix: 'kcal' },
  { key: 'proteins', label: 'Protéines', suffix: 'g' },
  { key: 'carbs', label: 'Glucides', suffix: 'g' },
  { key: 'fat', label: 'Lipides', suffix: 'g' },
]

export default function GoalsView({ goals }) {
  const { currentUid } = useAuth()
  const weight = useLatestWeight()

  const [values, setValues] = useState({})
  const [profile, setProfile] = useState({ heightCm: '', birthYear: '', sex: 'h', activity: 1.375, aim: 'maintien' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValues(Object.fromEntries(FIELDS.map((f) => [f.key, goals?.[f.key] != null ? String(goals[f.key]) : ''])))
    if (goals?.profile) {
      setProfile({
        heightCm: goals.profile.heightCm != null ? String(goals.profile.heightCm) : '',
        birthYear: goals.profile.birthYear != null ? String(goals.profile.birthYear) : '',
        sex: goals.profile.sex || 'h',
        activity: goals.profile.activity || 1.375,
        aim: goals.profile.aim || 'maintien',
      })
    }
  }, [goals])

  const estimate = computeGoals({
    weightKg: weight?.value,
    heightCm: toNumber(profile.heightCm),
    birthYear: toNumber(profile.birthYear),
    sex: profile.sex,
    activity: profile.activity,
    aim: profile.aim,
  })

  function applyEstimate() {
    if (!estimate) return
    setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(estimate[f.key])])))
  }

  function save() {
    saveGoals(currentUid, {
      ...Object.fromEntries(FIELDS.map((f) => [f.key, toNumber(values[f.key])])),
      mode: 'manual',
      profile: {
        heightCm: toNumber(profile.heightCm),
        birthYear: toNumber(profile.birthYear),
        sex: profile.sex,
        activity: profile.activity,
        aim: profile.aim,
      },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="max-w-xl mx-auto px-4 pb-28 pt-2 space-y-6">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Objectifs quotidiens</h2>
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="block text-[11px] text-faint mb-1">{f.label}</span>
              <div className="relative">
                <Input
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  inputMode="numeric" placeholder="—" className="pr-12 tabular"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint pointer-events-none">{f.suffix}</span>
              </div>
            </label>
          ))}
        </div>
        <Button className="w-full mt-3" onClick={save}>
          {saved ? <><Check size={16} /> Enregistré</> : 'Enregistrer'}
        </Button>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Estimer mes besoins</h2>

        <div className="rounded-xl bg-surface-2 p-3 mb-3">
          {weight ? (
            <p className="text-sm text-fg tabular">
              {weight.value} kg
              <span className="text-xs text-faint"> — pesée du {formatDateFr(weight.date)}, depuis MuscAuzi</span>
            </p>
          ) : (
            <p className="text-sm text-muted">
              Aucun poids enregistré. Saisis-en un dans MuscAuzi pour activer l’estimation.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="block">
            <span className="block text-[11px] text-faint mb-1">Taille</span>
            <div className="relative">
              <Input value={profile.heightCm} onChange={(e) => setProfile((p) => ({ ...p, heightCm: e.target.value }))} inputMode="numeric" placeholder="175" className="pr-10 tabular" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint pointer-events-none">cm</span>
            </div>
          </label>
          <label className="block">
            <span className="block text-[11px] text-faint mb-1">Année de naissance</span>
            <Input value={profile.birthYear} onChange={(e) => setProfile((p) => ({ ...p, birthYear: e.target.value }))} inputMode="numeric" placeholder="1996" className="tabular" />
          </label>
        </div>

        <div className="flex gap-2 mb-3">
          {[{ id: 'h', label: 'Homme' }, { id: 'f', label: 'Femme' }].map((s) => (
            <button
              key={s.id}
              onClick={() => setProfile((p) => ({ ...p, sex: s.id }))}
              className={cn(
                'flex-1 px-3 py-2 rounded-xl text-xs border transition',
                profile.sex === s.id ? 'bg-accent text-accent-fg border-accent' : 'bg-surface-2 text-muted border-border hover:text-fg',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-faint mb-1.5">Activité physique</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {ACTIVITY_LEVELS.map((a) => (
            <button
              key={a.value}
              onClick={() => setProfile((p) => ({ ...p, activity: a.value }))}
              className={cn(
                'px-3 py-2 rounded-xl text-left border transition',
                profile.activity === a.value ? 'bg-accent/10 border-accent text-fg' : 'bg-surface-2 border-border text-muted hover:text-fg',
              )}
            >
              <span className="block text-xs font-medium">{a.label}</span>
              <span className="block text-[10px] text-faint">{a.hint}</span>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-faint mb-1.5">Objectif</p>
        <div className="flex gap-2 mb-3">
          {AIMS.map((a) => (
            <button
              key={a.id}
              onClick={() => setProfile((p) => ({ ...p, aim: a.id }))}
              className={cn(
                'flex-1 px-3 py-2 rounded-xl text-xs border transition',
                profile.aim === a.id ? 'bg-accent text-accent-fg border-accent' : 'bg-surface-2 text-muted border-border hover:text-fg',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        {estimate ? (
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm text-fg tabular mb-1">
              ≈ <strong>{estimate.kcal} kcal</strong> · P {estimate.proteins} g · G {estimate.carbs} g · L {estimate.fat} g
            </p>
            <p className="text-[11px] text-faint mb-3">
              Estimation Mifflin-St Jeor, à ±10 % près. À ajuster selon ce que tu constates.
            </p>
            <Button variant="secondary" className="w-full" onClick={applyEstimate}>
              <Calculator size={16} /> Utiliser cette estimation
            </Button>
          </div>
        ) : (
          <p className="text-xs text-faint">Complète taille, année de naissance et poids pour obtenir une estimation.</p>
        )}
      </section>
    </div>
  )
}
