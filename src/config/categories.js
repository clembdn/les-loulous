import {
  Home, ShoppingCart, Car, Utensils, PartyPopper, Plane, Heart,
  Repeat, ShoppingBag, MoreHorizontal,
  Briefcase, Gift, TrendingUp,
} from 'lucide-react'

// Each category exposes pre-baked Tailwind class strings so the bundler picks them up.
// `hex` is used for inline SVG/chart usage where dynamic classes don't work.
export const CATEGORIES = [
  // ─── Expenses ───────────────────────────────────────────────
  { id: 'housing',       label: 'Logement',     type: 'expense', icon: Home,           hex: '#F59E0B', bgClass: 'bg-amber-500/15',   textClass: 'text-amber-400',   dotClass: 'bg-amber-400',   borderClass: 'border-amber-500/30',   ringClass: 'ring-amber-500/30' },
  { id: 'groceries',     label: 'Courses',      type: 'expense', icon: ShoppingCart,   hex: '#84CC16', bgClass: 'bg-lime-500/15',    textClass: 'text-lime-400',    dotClass: 'bg-lime-400',    borderClass: 'border-lime-500/30',    ringClass: 'ring-lime-500/30' },
  { id: 'transport',     label: 'Transport',    type: 'expense', icon: Car,            hex: '#0EA5E9', bgClass: 'bg-sky-500/15',     textClass: 'text-sky-400',     dotClass: 'bg-sky-400',     borderClass: 'border-sky-500/30',     ringClass: 'ring-sky-500/30' },
  { id: 'restaurants',   label: 'Restaurants',  type: 'expense', icon: Utensils,       hex: '#EC4899', bgClass: 'bg-pink-500/15',    textClass: 'text-pink-400',    dotClass: 'bg-pink-400',    borderClass: 'border-pink-500/30',    ringClass: 'ring-pink-500/30' },
  { id: 'leisure',       label: 'Sorties',      type: 'expense', icon: PartyPopper,    hex: '#A855F7', bgClass: 'bg-purple-500/15',  textClass: 'text-purple-400',  dotClass: 'bg-purple-400',  borderClass: 'border-purple-500/30',  ringClass: 'ring-purple-500/30' },
  { id: 'travel',        label: 'Voyage',       type: 'expense', icon: Plane,          hex: '#06B6D4', bgClass: 'bg-cyan-500/15',    textClass: 'text-cyan-400',    dotClass: 'bg-cyan-400',    borderClass: 'border-cyan-500/30',    ringClass: 'ring-cyan-500/30' },
  { id: 'health',        label: 'Santé',        type: 'expense', icon: Heart,          hex: '#EF4444', bgClass: 'bg-red-500/15',     textClass: 'text-red-400',     dotClass: 'bg-red-400',     borderClass: 'border-red-500/30',     ringClass: 'ring-red-500/30' },
  { id: 'subscriptions', label: 'Abonnements',  type: 'expense', icon: Repeat,         hex: '#6366F1', bgClass: 'bg-indigo-500/15',  textClass: 'text-indigo-400',  dotClass: 'bg-indigo-400',  borderClass: 'border-indigo-500/30',  ringClass: 'ring-indigo-500/30' },
  { id: 'shopping',      label: 'Shopping',     type: 'expense', icon: ShoppingBag,    hex: '#EAB308', bgClass: 'bg-yellow-500/15',  textClass: 'text-yellow-400',  dotClass: 'bg-yellow-400',  borderClass: 'border-yellow-500/30',  ringClass: 'ring-yellow-500/30' },
  { id: 'other-expense', label: 'Autre',        type: 'expense', icon: MoreHorizontal, hex: '#94A3B8', bgClass: 'bg-slate-500/15',   textClass: 'text-slate-400',   dotClass: 'bg-slate-400',   borderClass: 'border-slate-500/30',   ringClass: 'ring-slate-500/30' },

  // ─── Income ─────────────────────────────────────────────────
  { id: 'salary',        label: 'Salaire',      type: 'income',  icon: Briefcase,      hex: '#10B981', bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-400', dotClass: 'bg-emerald-400', borderClass: 'border-emerald-500/30', ringClass: 'ring-emerald-500/30' },
  { id: 'bonus',         label: 'Prime',        type: 'income',  icon: Gift,           hex: '#14B8A6', bgClass: 'bg-teal-500/15',    textClass: 'text-teal-400',    dotClass: 'bg-teal-400',    borderClass: 'border-teal-500/30',    ringClass: 'ring-teal-500/30' },
  { id: 'other-income',  label: 'Autre',        type: 'income',  icon: TrendingUp,     hex: '#A8A29E', bgClass: 'bg-stone-500/15',   textClass: 'text-stone-400',   dotClass: 'bg-stone-400',   borderClass: 'border-stone-500/30',   ringClass: 'ring-stone-500/30' },
]

export const CATEGORIES_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.type === 'expense')
export const INCOME_CATEGORIES = CATEGORIES.filter((c) => c.type === 'income')

const FALLBACK = {
  id: 'unknown',
  label: 'Sans catégorie',
  type: 'expense',
  icon: MoreHorizontal,
  hex: '#64748B',
  bgClass: 'bg-white/5',
  textClass: 'text-white/50',
  dotClass: 'bg-white/30',
  borderClass: 'border-white/10',
  ringClass: 'ring-white/10',
}

export function getCategory(id) {
  return CATEGORIES_BY_ID[id] || FALLBACK
}

export function getCategoriesByType(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function getDefaultCategoryId(type) {
  return type === 'income' ? 'other-income' : 'other-expense'
}

export function isValidCategoryId(id) {
  return !!CATEGORIES_BY_ID[id]
}
