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
//
// ATTENTION au champ focalisé. La première version affichait en permanence la
// valeur DÉRIVÉE (`gramsForShare`), recalculée à chaque frappe. Sur 250 g, le
// champ montrait « 125 », le curseur se posait à la fin, et taper « 150 »
// donnait « 125150 » — écrêté au maximum, 250. Le partenaire tombait à zéro et
// toute frappe suivante repartait de 250 : c'était tout ou rien. D'où le
// brouillon local ci-dessous, et la sélection intégrale au focus.
export default function SplitEditor({ ingredients, onChange }) {
  const [open, setOpen] = useState(false)
  // { index, uid, text } — le champ en cours de saisie, et lui seul.
  const [draft, setDraft] = useState(null)
  const people = AUTHORIZED_UIDS.map((uid) => ({ uid, person: getPerson(uid) }))

  // Seuls les ingrédients avec une quantité chiffrée sont partageables.
  const rows = ingredients
    .map((ing, index) => ({ ing, index }))
    .filter(({ ing }) => ing.name.trim() && toNumber(ing.quantity) > 0)

  const customCount = rows.filter(({ ing }) => ing.split).length

  const isDrafting = (index, uid) => draft?.index === index && draft?.uid === uid

  // Ce qu'affiche un champ : le brouillon s'il est en cours de saisie, sinon la
  // valeur dérivée — c'est ainsi que l'autre case bouge pendant qu'on tape.
  function displayed(index, uid, ing, quantity) {
    if (isDrafting(index, uid)) return draft.text
    const g = gramsForShare({ ...ing, quantity }, uid)
    return g == null ? '' : String(g)
  }

  // Hors bornes → on ne touche pas à la répartition, on le signale.
  function outOfRange(text, quantity) {
    const n = toNumber(text)
    if (text.trim() === '') return false
    return n == null || n < 0 || n > quantity
  }

  function type(index, uid, text, quantity) {
    setDraft({ index, uid, text })
    if (text.trim() === '' || outOfRange(text, quantity)) return
    const ing = ingredients[index]
    onChange(index, splitFromGrams({ ...ing, quantity }, uid, toNumber(text)))
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
          <div className="flex items-center gap-2">
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

                {people.map(({ uid }) => {
                  const text = displayed(index, uid, ing, quantity)
                  const bad = isDrafting(index, uid) && outOfRange(text, quantity)
                  return (
                    <Input
                      key={uid}
                      value={text}
                      // Sélection intégrale : taper REMPLACE la valeur affichée
                      // au lieu de s'y ajouter. C'est ce seul point qui faisait
                      // sauter le champ au maximum.
                      onFocus={(e) => { setDraft({ index, uid, text: e.target.value }); e.target.select() }}
                      onChange={(e) => type(index, uid, e.target.value, quantity)}
                      onBlur={() => setDraft(null)}
                      inputMode="decimal"
                      aria-label={`Part de ${getPerson(uid)?.label} pour ${ing.name}`}
                      aria-invalid={bad || undefined}
                      className={cn(
                        'w-[4.5rem] h-9 px-2 text-center tabular text-sm',
                        // Le gris clair dit « c'est le défaut, personne n'y a touché ».
                        !custom && !isDrafting(index, uid) && 'text-faint',
                        bad && 'border-warning text-warning',
                      )}
                    />
                  )
                })}

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
