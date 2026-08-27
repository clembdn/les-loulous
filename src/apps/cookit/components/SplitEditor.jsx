import { useState } from 'react'
import { ChevronDown, Users, RotateCcw } from 'lucide-react'
import { Input } from '@/shared/ui/Input.jsx'
import { cn } from '@/shared/lib/utils.js'
import { AUTHORIZED_UIDS, getPerson } from '@/shared/config/people.js'
import { gramsForShare, splitFromGrams } from '../utils/nutrition.js'
import { unitLabel, toNumber } from '../utils/quantity.js'

// Répartition d'une recette entre les deux personnes, ingrédient par ingrédient.
//
// Un plat « pour 2 » n'est presque jamais mangé à parts égales : 250 g de pâtes,
// c'est 150 g pour l'un et 100 g pour l'autre. Sans ça, le journal de chacun est
// faux de la même erreur, tous les jours.
//
// La saisie se fait en GRAMMES (c'est ce qu'on a en tête), le stockage en
// fractions (c'est ce qui survit à un changement de nombre de portions).
// Modifier une case ajuste l'autre : le total du plat ne change jamais.
//
// Repliée par défaut : dans la majorité des cas le 50/50 convient et il n'y a
// rien à faire.

export default function SplitEditor({ ingredients, onChange }) {
  const [open, setOpen] = useState(false)
  const people = AUTHORIZED_UIDS.map((uid) => ({ uid, person: getPerson(uid) }))

  // Seuls les ingrédients avec une quantité chiffrée sont partageables.
  const rows = ingredients
    .map((ing, index) => ({ ing, index }))
    .filter(({ ing }) => ing.name.trim() && toNumber(ing.quantity) > 0)

  const customCount = rows.filter(({ ing }) => ing.split).length

  function setGrams(index, uid, value) {
    const ing = ingredients[index]
    const quantity = toNumber(ing.quantity)
    onChange(index, splitFromGrams({ ...ing, quantity }, uid, toNumber(value)))
  }

  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-2 transition"
      >
        <Users size={15} className="text-muted shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-fg">Répartition entre nous</span>
          <span className="block text-[11px] text-faint">
            {customCount === 0
              ? 'Parts égales — touche un ingrédient pour l’ajuster'
              : `${customCount} ingrédient${customCount > 1 ? 's' : ''} réparti${customCount > 1 ? 's' : ''} différemment`}
          </span>
        </span>
        <ChevronDown size={16} className={cn('text-faint shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          <div className="flex items-center gap-2 pl-[max(0px,0px)]">
            <span className="flex-1" />
            {people.map(({ uid, person }) => (
              <span key={uid} className="w-[4.5rem] text-center text-[11px] font-medium">
                <span className={person?.textClass}>{person?.label}</span>
              </span>
            ))}
            <span className="w-7" />
          </div>

          {rows.map(({ ing, index }) => {
            const quantity = toNumber(ing.quantity)
            const custom = !!ing.split
            return (
              <div key={index} className="flex items-center gap-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-fg truncate">{ing.name}</span>
                  <span className="block text-[11px] text-faint tabular">
                    {quantity} {unitLabel(ing.unit, quantity) || ''}
                  </span>
                </span>

                {people.map(({ uid }) => (
                  <Input
                    key={uid}
                    value={String(gramsForShare({ ...ing, quantity }, uid) ?? '')}
                    onChange={(e) => setGrams(index, uid, e.target.value)}
                    inputMode="decimal"
                    aria-label={`Part de ${getPerson(uid)?.label} pour ${ing.name}`}
                    className={cn(
                      'w-[4.5rem] h-9 px-2 text-center tabular text-sm',
                      // Le gris clair dit « c'est le défaut, personne n'y a touché ».
                      !custom && 'text-faint',
                    )}
                  />
                ))}

                <button
                  onClick={() => onChange(index, null)}
                  disabled={!custom}
                  aria-label={`Revenir à parts égales pour ${ing.name}`}
                  className="w-7 shrink-0 p-1 text-faint hover:text-fg transition disabled:opacity-0 disabled:pointer-events-none"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            )
          })}

          <p className="text-[11px] text-faint">
            Saisis la part de l’un, celle de l’autre s’ajuste. Le total du plat ne change pas.
          </p>
        </div>
      )}
    </div>
  )
}
