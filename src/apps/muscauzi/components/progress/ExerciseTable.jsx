import { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, Minus, ChevronsUpDown, ChevronRight } from 'lucide-react'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/shared/ui/table.jsx'
import { cn } from '@/shared/lib/utils.js'
import { fromLocalDateKey, formatDateFr } from '@/shared/lib/dates.js'
import { getExerciseType } from '../../config/exercises.js'
import { exerciseHistoryIndex, bestSet, bestScore, formatSets } from '../../utils/metrics.js'

/**
 * Les exercices travaillés, en tableau.
 *
 * La liste d'origine n'affichait qu'un nom et une date, empilés dans une
 * colonne de 576 px : sur un écran large, les deux tiers de la page restaient
 * vides pendant qu'il fallait ouvrir chaque exercice pour comparer quoi que ce
 * soit. Un tableau met les mêmes données côte à côte et devient triable — on
 * répond à « qu'est-ce que je n'ai pas touché depuis un mois » sans ouvrir une
 * seule fiche.
 *
 * Les colonnes secondaires disparaissent sous `sm` : comprimées sur un
 * téléphone, elles ne se liraient plus, et le nom seul suffit à choisir.
 */
const COLUMNS = [
  { id: 'name', label: 'Exercice', sortable: true },
  { id: 'type', label: 'Type', sortable: true, hideBelow: 'sm' },
  { id: 'last', label: 'Dernière fois', sortable: true, align: 'right' },
  { id: 'best', label: 'Meilleure série', sortable: false, align: 'right', hideBelow: 'md' },
  { id: 'count', label: 'Séances', sortable: true, align: 'right', hideBelow: 'sm' },
]

const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell' }

export default function ExerciseTable({ exercises, sessions, selectedId, onSelect }) {
  const [sort, setSort] = useState({ key: 'last', dir: 'desc' })

  const index = useMemo(() => exerciseHistoryIndex(sessions, 2), [sessions])

  const rows = useMemo(() => {
    return exercises
      .filter((exercise) => index[exercise.id])
      .map((exercise) => {
        const item = index[exercise.id]
        const [last, previous] = item.recent
        const best = bestSet(last.sets, exercise)
        return {
          id: exercise.id,
          name: exercise.name,
          type: getExerciseType(exercise.type).label,
          last: last.date,
          best: best ? formatSets([best], exercise) : null,
          count: item.count,
          // Le verdict porte sur la MEILLEURE série, pas sur le total : ajouter
          // une série de plus n'est pas un gain de force.
          trend: previous
            ? compare(bestScore(last.sets, exercise), bestScore(previous.sets, exercise))
            : null,
        }
      })
  }, [exercises, index])

  const sorted = useMemo(() => {
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sort.key === 'count') return (a.count - b.count) * factor
      if (sort.key === 'name' || sort.key === 'type') {
        return a[sort.key].localeCompare(b[sort.key], 'fr') * factor
      }
      // Les clés de date sont `yyyy-mm-dd` : l'ordre alphabétique EST l'ordre
      // chronologique.
      return a.last.localeCompare(b.last) * factor
    })
  }, [rows, sort])

  const toggleSort = (key) => {
    setSort((prev) => (prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      // Un nouveau tri part du sens le plus utile : le plus récent et le plus
      // fréquent d'abord, mais les noms de A à Z.
      : { key, dir: key === 'name' || key === 'type' ? 'asc' : 'desc' }))
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8 px-2" aria-label="Tendance" />
          {COLUMNS.map((column) => (
            <TableHead
              key={column.id}
              className={cn(
                column.align === 'right' && 'text-right',
                column.hideBelow && HIDE[column.hideBelow],
              )}
              aria-sort={sort.key === column.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              {column.sortable ? (
                <button
                  type="button"
                  onClick={() => toggleSort(column.id)}
                  className={cn(
                    'inline-flex items-center gap-1 transition hover:text-fg',
                    column.align === 'right' && 'flex-row-reverse',
                    sort.key === column.id && 'text-fg',
                  )}
                >
                  {column.label}
                  <SortIcon active={sort.key === column.id} dir={sort.dir} />
                </button>
              ) : column.label}
            </TableHead>
          ))}
          <TableHead className="w-6 px-0 lg:hidden" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {sorted.map((row) => (
          <TableRow
            key={row.id}
            selected={row.id === selectedId}
            onClick={() => onSelect(row.id)}
            // La ligne entière est cliquable : viser un lien dans une cellule
            // demande une précision qu'on n'a pas au doigt.
            tabIndex={0}
            role="button"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(row.id) } }}
            className="cursor-pointer hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2"
          >
            <TableCell className="w-8 px-2">
              <Trend trend={row.trend} />
            </TableCell>
            {/* `w-full` fait absorber à cette colonne toute la largeur que les
                autres ne prennent pas — elles sont toutes en `whitespace-nowrap`
                et se dimensionnent sur leur contenu. Le nom n'est PAS tronqué :
                la version précédente le bornait pour pouvoir le couper, ce qui
                effondrait la colonne à son minimum et affichait
                « Développé… » au milieu d'une page vide. Un nom trop long
                passe à la ligne — la ligne grandit, l'information reste. */}
            <TableCell className="w-full font-medium text-fg">{row.name}</TableCell>
            <TableCell className={cn('text-muted text-xs whitespace-nowrap', HIDE.sm)}>{row.type}</TableCell>
            <TableCell className="text-right text-muted text-xs whitespace-nowrap tabular">
              {formatDateFr(fromLocalDateKey(row.last))}
            </TableCell>
            <TableCell className={cn('text-right text-muted text-xs whitespace-nowrap tabular', HIDE.md)}>
              {row.best}
            </TableCell>
            <TableCell className={cn('text-right text-muted text-xs tabular', HIDE.sm)}>{row.count}</TableCell>
            <TableCell className="w-6 px-0 lg:hidden">
              <ChevronRight size={14} className="text-faint" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown size={11} className="text-faint/60" aria-hidden="true" />
  return dir === 'asc'
    ? <ArrowUp size={11} aria-hidden="true" />
    : <ArrowDown size={11} aria-hidden="true" />
}

function Trend({ trend }) {
  if (trend === 'up') return <ArrowUp size={13} strokeWidth={2.8} className="text-accent" aria-label="En progrès" />
  if (trend === 'down') return <ArrowDown size={13} strokeWidth={2.8} className="text-muted" aria-label="En retrait" />
  if (trend === 'same') return <Minus size={13} strokeWidth={2.8} className="text-faint" aria-label="Stable" />
  // Un seul passage : rien à comparer, donc pas de flèche qui mentirait.
  return <span aria-hidden="true" className="block h-1.5 w-1.5 rounded-full bg-border-strong" />
}

function compare(now, before) {
  if (before <= 0) return null
  // Même marge de 1 % qu'ailleurs : un arrondi ne doit pas passer pour un gain.
  if (now > before * 1.01) return 'up'
  if (now < before * 0.99) return 'down'
  return 'same'
}
