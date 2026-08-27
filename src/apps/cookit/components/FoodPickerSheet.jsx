import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, ScanBarcode, Plus, Loader2 } from 'lucide-react'
import { Sheet } from './Sheet.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { normalizeName } from '../utils/aisleGuess.js'
import { searchCiqual } from '../data/ciqual.js'
import { searchProducts } from '../services/openFoodFactsService.js'
import { saveFood, recordFoodUsage } from '../services/foodsService.js'
import { useBarcodeLookup } from '../hooks/useBarcodeLookup.js'
import LookupOverlay from './LookupOverlay.jsx'
import BarcodeScanner from './BarcodeScanner.jsx'
import FoodEditSheet from './FoodEditSheet.jsx'

// Sélecteur d'aliment unifié. Trois sources dans un ordre voulu :
//   1. la bibliothèque du couple  → instantané, hors ligne, déjà corrigé
//   2. CIQUAL (aliments bruts)    → local après un import() ; le poulet et le riz
//                                   n'ont pas de code-barres
//   3. Open Food Facts (réseau)   → produits emballés, en dernier car c'est le
//                                   seul qui peut être lent ou muet
// Et toujours, en bas, la sortie de secours : créer la fiche à la main.

const OFF_DEBOUNCE_MS = 400
const MAX_LOCAL = 8

function Row({ food, subtitle, onPick }) {
  return (
    <button
      onClick={() => onPick(food)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-surface-2 transition"
    >
      {food.imageUrl
        ? <img src={food.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover bg-surface-2 shrink-0" />
        : <div className="w-9 h-9 rounded-lg bg-surface-2 shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-fg truncate">{food.name}</span>
        {subtitle && <span className="block text-xs text-faint truncate">{subtitle}</span>}
      </span>
      <span className="text-xs text-muted tabular shrink-0">
        {Math.round(food.per100?.kcal ?? 0)} kcal
      </span>
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-faint">{title}</p>
      {children}
    </div>
  )
}

export default function FoodPickerSheet({ open, foods, onClose, onPick, title = 'Choisir un aliment' }) {
  const { currentUid } = useAuth()
  const [q, setQ] = useState('')
  const [ciqual, setCiqual] = useState([])
  const [off, setOff] = useState([])
  const [offLoading, setOffLoading] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const reqRef = useRef(0)
  const { looking, lookup } = useBarcodeLookup(foods)

  useEffect(() => {
    if (!open) { setQ(''); setCiqual([]); setOff([]) }
  }, [open])

  // Bibliothèque locale : filtrage synchrone, les plus utilisés d'abord.
  const mine = useMemo(() => {
    const needle = normalizeName(q)
    const base = needle
      ? foods.filter((f) => f.nameLower.includes(needle))
      : [...foods]
    return base
      .sort((a, b) => (b.useCount - a.useCount) || a.name.localeCompare(b.name, 'fr'))
      .slice(0, MAX_LOCAL)
  }, [foods, q])

  // CIQUAL : local une fois le chunk chargé, donc pas de debounce.
  useEffect(() => {
    let alive = true
    if (q.trim().length < 2) { setCiqual([]); return undefined }
    searchCiqual(q, 8).then((r) => { if (alive) setCiqual(r) })
    return () => { alive = false }
  }, [q])

  // Open Food Facts : réseau + quota 10 req/min → debounce obligatoire.
  useEffect(() => {
    if (q.trim().length < 2) { setOff([]); setOffLoading(false); return undefined }
    setOffLoading(true)
    const id = reqRef.current + 1
    reqRef.current = id
    const timer = setTimeout(() => {
      searchProducts(q, { limit: 10 }).then((r) => {
        // Une réponse arrivée après une frappe plus récente ne doit rien écraser.
        if (reqRef.current !== id) return
        setOff(r)
        setOffLoading(false)
      })
    }, OFF_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [q])

  // Contrat de ce composant : l'aliment rendu existe TOUJOURS dans la
  // bibliotheque. Un resultat CIQUAL ou Open Food Facts n'est qu'un candidat
  // tant qu'il n'est pas enregistre — sans ca, une recette pointerait vers un
  // aliment introuvable au prochain chargement.
  function pick(food) {
    const known = food.id && foods.some((f) => f.id === food.id)
    // saveFood calcule l'id cote client et le rend sans attendre le reseau.
    const id = known ? food.id : saveFood(food, currentUid)
    // Compter l'usage dans TOUS les cas : ne le faire que pour les aliments deja
    // connus laissait chaque nouvel aliment a useCount 0, donc invisible dans
    // « Frequents » meme apres dix utilisations.
    recordFoodUsage(id, currentUid)
    onPick({ ...food, id })
  }

  const knownIds = useMemo(() => new Set(foods.map((f) => f.id)), [foods])
  const offNew = off.filter((f) => !knownIds.has(f.id))
  const ciqualNew = ciqual.filter((f) => !knownIds.has(f.id))
  const nothing = q.trim().length >= 2 && !offLoading
    && mine.length === 0 && ciqualNew.length === 0 && offNew.length === 0

  async function onScanned(barcode) {
    setScanOpen(false)
    const { action, food } = await lookup(barcode)
    if (action === 'pick') pick(food)
    else if (action === 'edit') setDraft(food)
  }

  return (
    <>
      {/* La Sheet DOIT se fermer pendant le scan. C'est une modale Radix : tant
          qu'elle est montée, le body est en `pointer-events: none` et tout clic
          ailleurs compte comme un clic extérieur. Le scanner étant rendu hors de
          son portal, ses boutons devenaient inertes et le moindre tap refermait
          la modale. */}
      <Sheet open={open && !draft && !scanOpen} onOpenChange={(o) => !o && onClose()} title={title}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Poulet, riz, yaourt…"
                className="pl-9"
                autoFocus
              />
            </div>
            <Button variant="secondary" size="icon" onClick={() => setScanOpen(true)} aria-label="Scanner un code-barres">
              <ScanBarcode size={18} />
            </Button>
          </div>

          <div className="space-y-3 -mx-2">
            {mine.length > 0 && (
              <Section title={q ? 'Mes aliments' : 'Récemment utilisés'}>
                {mine.map((f) => (
                  <Row key={f.id} food={f} subtitle={f.brand} onPick={pick} />
                ))}
              </Section>
            )}

            {ciqualNew.length > 0 && (
              <Section title="Aliments bruts">
                {ciqualNew.map((f) => (
                  <Row key={f.id} food={f} subtitle={f.group} onPick={pick} />
                ))}
              </Section>
            )}

            {(offNew.length > 0 || offLoading) && (
              <Section title="Produits emballés">
                {offLoading && (
                  <p className="flex items-center gap-2 px-3 py-2 text-xs text-faint">
                    <Loader2 size={13} className="animate-spin" /> Recherche…
                  </p>
                )}
                {offNew.map((f) => (
                  <Row key={f.id} food={f} subtitle={f.brand} onPick={pick} />
                ))}
              </Section>
            )}

            {nothing && (
              <p className="px-3 py-2 text-sm text-muted">Aucun résultat pour « {q.trim()} ».</p>
            )}
          </div>

          <Button
            variant="dashed"
            className="w-full"
            onClick={() => setDraft({ name: q.trim(), source: 'manual', per100: {} })}
          >
            <Plus size={16} /> Créer l’aliment à la main
          </Button>
        </div>
      </Sheet>

      <BarcodeScanner open={scanOpen} onDetected={onScanned} onClose={() => setScanOpen(false)} />

      <LookupOverlay open={looking} />

      <FoodEditSheet
        food={draft}
        open={!!draft}
        onClose={() => setDraft(null)}
        onSave={(f) => { setDraft(null); pick(f) }}
      />
    </>
  )
}
