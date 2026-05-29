# Design system « Clément & Lise » — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner une identité premium multi-thèmes à la plateforme : design system par variables CSS (mode + accent par app), typo Geist, primitives shadcn-style, refonte du Hub, et adoption du thème ambre par la coque FinAuzi.

**Architecture:** Tokens sémantiques en variables CSS posées sur `<html>` via `data-theme` (sombre/clair) et `data-accent` (indigo/ambre/vert), mappés en utilitaires Tailwind. Un hook `useAppTheme` applique le thème par zone. Composants partagés token-based → s'adaptent automatiquement.

**Tech Stack:** Vite, React 18, react-router-dom, Tailwind (vars CSS), class-variance-authority, Geist (Google Fonts), lucide-react.

**Vérification :** pas de tests auto ; `npm run build` + smoke test lancés par Clément (`! …`) à la fin.

**Note de périmètre :** la re-thématisation du kit Radix (dialog/popover/sheet/calendar/date-picker) est **différée** avec le polish profond de FinAuzi — ce kit n'est utilisé que dans FinAuzi (sombre) où les `white/opacity` restent corrects. Ce chantier couvre : tokens, typo, primitives, hook de thème, Hub, coque FinAuzi.

---

## Structure des fichiers

**Création :** `src/shared/theme/useAppTheme.js` · `src/shared/ui/{Button,Card,Input,Badge}.jsx`
**Modification :** `tailwind.config.js` · `src/styles.css` · `index.html` · `src/platform/{LoginView,DashboardView,ComingSoonView}.jsx` · `src/platform/apps.config.js` · `src/apps/finauzi/FinauziApp.jsx` · `src/apps/finauzi/components/layout/{Shell,Sidebar,BottomNav}.jsx`

---

## Task 1 : Fondation — tokens, Tailwind, styles, Geist, cva

- [ ] **Step 1 : Installer class-variance-authority**

Run: `npm install class-variance-authority`

- [ ] **Step 2 : Réécrire `src/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  /* défauts avant montage = hub sombre/indigo */
  --bg: 11 14 19; --surface: 22 27 36; --surface-2: 28 34 48;
  --border: 31 38 50; --border-strong: 42 50 66;
  --fg: 245 247 250; --muted: 154 163 178; --faint: 107 114 128;
  --accent: 124 92 252; --accent-fg: 255 255 255;
}

[data-theme="dark"] {
  --bg: 11 14 19; --surface: 22 27 36; --surface-2: 28 34 48;
  --border: 31 38 50; --border-strong: 42 50 66;
  --fg: 245 247 250; --muted: 154 163 178; --faint: 107 114 128;
}
[data-theme="light"] {
  --bg: 250 250 251; --surface: 255 255 255; --surface-2: 244 245 247;
  --border: 228 230 235; --border-strong: 209 213 220;
  --fg: 17 20 27; --muted: 90 98 112; --faint: 140 148 160;
}

[data-accent="indigo"]  { --accent: 124 92 252; --accent-fg: 255 255 255; }
[data-accent="amber"]   { --accent: 245 158 11;  --accent-fg: 23 23 23;  }
[data-accent="emerald"] { --accent: 16 185 129;  --accent-fg: 255 255 255; }

html, body, #root { height: 100%; }

body {
  background-color: rgb(var(--bg));
  color: rgb(var(--fg));
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
  transition: background-color .25s ease, color .25s ease;
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgb(var(--fg) / 0.10); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: rgb(var(--fg) / 0.20); }

.tabular { font-variant-numeric: tabular-nums; }

@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
.fade-in { animation: fade-in 0.3s ease-out; }
.slide-up { animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-in-right { animation: slide-in-right 0.32s cubic-bezier(0.16, 1, 0.3, 1); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}
```

- [ ] **Step 3 : Réécrire `tailwind.config.js`**

```js
import tailwindcssAnimate from 'tailwindcss-animate'

const v = (name) => `rgb(var(${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        bg: v('--bg'),
        surface: v('--surface'),
        'surface-2': v('--surface-2'),
        border: v('--border'),
        'border-strong': v('--border-strong'),
        fg: v('--fg'),
        muted: v('--muted'),
        faint: v('--faint'),
        accent: v('--accent'),
        'accent-fg': v('--accent-fg'),
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
      },
      boxShadow: {
        card: '0 1px 0 rgb(255 255 255 / 0.03) inset, 0 8px 28px -16px rgb(0 0 0 / 0.55)',
        lift: '0 16px 48px -20px rgb(0 0 0 / 0.55)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
```

- [ ] **Step 4 : `index.html` — Geist + corriger le `<body>`**

Remplacer les 2 lignes Inter :
```html
    <link rel="preconnect" href="https://rsms.me/" />
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
```
par :
```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" />
```
Et remplacer la classe du body :
`<body class="bg-bg-base text-text-primary font-sans antialiased">`
→ `<body class="font-sans antialiased">`  *(fond + couleur viennent désormais de `body` dans styles.css)*

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(design): token system (CSS vars), Geist fonts, cva"
```

---

## Task 2 : Hook de thème + application par zone

- [ ] **Step 1 : Créer `src/shared/theme/useAppTheme.js`**

```js
import { useEffect } from 'react'

const BG_RGB = { dark: '11 14 19', light: '250 250 251' }

// Applique le thème (mode + accent) au document : data-theme/data-accent sur <html>,
// color-scheme et <meta theme-color>. La zone suivante écrase ces valeurs à son montage.
export function useAppTheme(theme = 'dark', accent = 'indigo') {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.accent = accent
    root.style.colorScheme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', `rgb(${BG_RGB[theme] || BG_RGB.dark})`)
  }, [theme, accent])
}
```

- [ ] **Step 2 : `src/platform/apps.config.js` — ajouter `theme` par app**

Dans l'entrée `finauzi`, ajouter `theme: 'dark',` ; dans `courses`, ajouter `theme: 'light',`
(juste après la ligne `accent:` de chaque entrée).

- [ ] **Step 3 : `src/apps/finauzi/FinauziApp.jsx` — appliquer le thème ambre**

Ajouter l'import en tête : `import { useAppTheme } from '@/shared/theme/useAppTheme.js'`
et, première ligne du corps de `FinauziApp()` : `useAppTheme('dark', 'amber')`
(avant `const [active, setActive] = useState('dashboard')`).

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "feat(design): useAppTheme hook + per-app theme wiring"
```

---

## Task 3 : Primitives (Button, Card, Input, Badge)

- [ ] **Step 1 : Créer `src/shared/ui/Button.jsx`**

```jsx
import { cva } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils.js'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        accent: 'bg-accent text-accent-fg hover:opacity-90',
        secondary: 'bg-surface-2 text-fg border border-border hover:border-border-strong',
        ghost: 'text-muted hover:text-fg hover:bg-surface-2',
        outline: 'border border-border text-fg hover:bg-surface-2',
      },
      size: { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-12 px-5 text-base' },
    },
    defaultVariants: { variant: 'accent', size: 'md' },
  },
)

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(button({ variant, size }), className)} {...props} />
}
```

- [ ] **Step 2 : Créer `src/shared/ui/Card.jsx`**

```jsx
import { cn } from '@/shared/lib/utils.js'

export function Card({ className, interactive = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface',
        interactive && 'transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift',
        className,
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 3 : Créer `src/shared/ui/Input.jsx`**

```jsx
import { cn } from '@/shared/lib/utils.js'

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full h-11 px-4 rounded-xl bg-surface-2 border border-border text-sm text-fg placeholder:text-faint',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus:border-transparent transition',
        className,
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 4 : Créer `src/shared/ui/Badge.jsx`**

```jsx
import { cn } from '@/shared/lib/utils.js'

export function Badge({ className, variant = 'neutral', ...props }) {
  const styles = variant === 'accent'
    ? 'bg-accent/10 text-accent border-accent/20'
    : 'bg-surface-2 text-muted border-border'
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border', styles, className)}
      {...props}
    />
  )
}
```

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(design): token-based primitives (Button, Card, Input, Badge)"
```

---

## Task 4 : Refonte du Hub (Login + Dashboard + ComingSoon)

- [ ] **Step 1 : Réécrire `src/platform/LoginView.jsx`**

```jsx
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { AUTHORIZED_UIDS, getPerson, getEmailForUid } from '@/shared/config/people.js'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { Button } from '@/shared/ui/Button.jsx'
import { Input } from '@/shared/ui/Input.jsx'
import { cn } from '@/shared/lib/utils.js'

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password': return 'Mot de passe incorrect.'
    case 'auth/user-not-found': return 'Compte introuvable.'
    case 'auth/too-many-requests': return 'Trop de tentatives, réessaie plus tard.'
    case 'auth/network-request-failed': return 'Problème de connexion réseau.'
    default: return 'Connexion impossible, réessaie.'
  }
}

export default function LoginView() {
  useAppTheme('dark', 'indigo')
  const { loginWithEmail, resetPassword, isAuthenticated, isAuthorized } = useAuth()
  const [selectedUid, setSelectedUid] = useState(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  if (isAuthenticated && isAuthorized) return <Navigate to="/" replace />

  const person = selectedUid ? getPerson(selectedUid) : null
  const email = selectedUid ? getEmailForUid(selectedUid) : null

  function selectProfile(uid) { setError(null); setInfo(null); setPassword(''); setSelectedUid(uid) }
  function back() { setSelectedUid(null); setError(null); setInfo(null); setPassword('') }

  async function onSubmit(e) {
    e.preventDefault()
    if (!email) { setError('Email non configuré pour ce profil.'); return }
    setError(null); setInfo(null); setBusy(true)
    try { await loginWithEmail(email, password) }
    catch (err) { setError(mapAuthError(err.code)) }
    finally { setBusy(false) }
  }
  async function onReset() {
    if (!email) { setError('Email non configuré pour ce profil.'); return }
    setError(null)
    try { await resetPassword(email); setInfo('Email de réinitialisation envoyé.') }
    catch (err) { setError(mapAuthError(err.code)) }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[460px] w-[680px] rounded-full bg-accent/10 blur-[130px]" />
      </div>
      <div className="relative w-full max-w-sm fade-in">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-fg">Clément &amp; Lise</h1>
          <p className="text-sm text-muted mt-1.5">Notre espace à deux</p>
        </div>

        {!person ? (
          <div className="slide-up">
            <p className="text-center text-sm text-muted mb-5">Qui es-tu ?</p>
            <div className="grid grid-cols-2 gap-3">
              {AUTHORIZED_UIDS.map((uid) => {
                const p = getPerson(uid)
                return (
                  <button key={uid} onClick={() => selectProfile(uid)}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface border border-border hover:border-border-strong hover:-translate-y-0.5 transition">
                    <span className={cn('h-16 w-16 rounded-full flex items-center justify-center text-2xl font-semibold border-2', p.bgClass, p.textClass, p.borderClass)}>{p.initial}</span>
                    <span className="text-sm font-medium text-fg">{p.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3 slide-up">
            <button type="button" onClick={back} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition mb-2">
              <ArrowLeft size={14} /> Changer d'utilisateur
            </button>
            <div className="flex items-center gap-3 mb-5">
              <span className={cn('h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold border-2', person.bgClass, person.textClass, person.borderClass)}>{person.initial}</span>
              <span className="text-sm text-muted">Connexion en tant que <span className="text-fg font-medium">{person.label}</span></span>
            </div>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" autoFocus required className="pr-11" />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Button type="submit" disabled={busy} className="w-full">{busy ? 'Connexion…' : 'Se connecter'}</Button>
            {error && <p className="text-xs text-danger text-center">{error}</p>}
            {info && <p className="text-xs text-success text-center">{info}</p>}
            <button type="button" onClick={onReset} className="w-full text-xs text-muted hover:text-fg mt-2 transition">Mot de passe oublié ?</button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Réécrire `src/platform/DashboardView.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { getPerson } from '@/shared/config/people.js'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'
import { Badge } from '@/shared/ui/Badge.jsx'
import { APPS } from './apps.config.js'

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export default function DashboardView() {
  useAppTheme('dark', 'indigo')
  const { currentUid, logout } = useAuth()
  const me = getPerson(currentUid)
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[760px] rounded-full bg-accent/10 blur-[150px]" />
      </div>
      <div className="relative max-w-5xl mx-auto w-full px-6 py-10 flex flex-col min-h-screen fade-in">
        <header className="flex items-start justify-between mb-12">
          <div>
            <p className="text-sm text-muted capitalize">{today}</p>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-fg mt-1">{greeting()}{me ? `, ${me.label}` : ''}</h1>
            <p className="text-sm text-faint mt-1">Clément &amp; Lise — Notre espace à deux</p>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-muted hover:text-fg hover:bg-surface-2 transition" title="Se déconnecter">
            <LogOut size={16} /><span className="hidden sm:inline">Déconnexion</span>
          </button>
        </header>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5 auto-rows-fr content-center">
          {APPS.map((app) => <AppCard key={app.id} app={app} />)}
        </div>
      </div>
    </div>
  )
}

function AppCard({ app }) {
  const Icon = app.icon
  const isSoon = app.status === 'soon'
  return (
    <Link to={app.path} data-theme={app.theme} data-accent={app.accent}
      className="group relative flex flex-col justify-between p-7 rounded-3xl border border-border bg-surface min-h-[220px] shadow-card transition hover:-translate-y-1 hover:shadow-lift">
      {isSoon && <Badge className="absolute top-5 right-5">Bientôt</Badge>}
      <span className="h-14 w-14 rounded-2xl flex items-center justify-center bg-accent/10 text-accent border border-accent/20">
        <Icon size={26} strokeWidth={2} />
      </span>
      <div className="mt-6">
        <h2 className="text-xl font-semibold text-fg tracking-[-0.01em]">{app.name}</h2>
        <p className="text-sm text-muted mt-1">{app.description}</p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3 : Réécrire `src/platform/ComingSoonView.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getApp } from './apps.config.js'
import { useAppTheme } from '@/shared/theme/useAppTheme.js'

export default function ComingSoonView({ appId }) {
  const app = getApp(appId)
  useAppTheme(app?.theme || 'light', app?.accent || 'emerald')
  const Icon = app?.icon

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-6 fade-in">
      {Icon && (
        <span className="h-16 w-16 rounded-2xl flex items-center justify-center bg-accent/10 text-accent border border-accent/20">
          <Icon size={30} strokeWidth={2} />
        </span>
      )}
      <div>
        <h1 className="text-xl font-semibold text-fg">{app?.name || 'App'}</h1>
        <p className="text-sm text-muted mt-1">Bientôt disponible.</p>
      </div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg transition">
        <ArrowLeft size={14} /> Nos apps
      </Link>
    </div>
  )
}
```

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "feat(design): premium hub redesign (login, dashboard, coming-soon)"
```

---

## Task 5 : Coque FinAuzi — tokens + accent ambre

Re-thématiser `Shell.jsx`, `Sidebar.jsx`, `BottomNav.jsx` : remplacer les couleurs ad hoc par les tokens, et passer les états actifs à l'accent (ambre). Lire chaque fichier puis appliquer le mapping ci-dessous.

**Mapping de re-thématisation :**
| Avant | Après |
|-------|-------|
| `bg-[#0B0E13]/90`, `/85`, `/92` | `bg-bg/80 backdrop-blur-xl` |
| `border-white/5`, `border-white/10` | `border-border` |
| `text-white` | `text-fg` |
| `text-white/40`, `/60`, `/70` (texte secondaire) | `text-muted` |
| `bg-white/[0.03]`, `hover:bg-white/[0.03]` | `hover:bg-surface-2` |
| `bg-white/[0.06]` **état actif nav** | `bg-accent/10 text-accent` |
| bouton « Nouvelle transaction » `bg-white text-black` | `bg-accent text-accent-fg hover:opacity-90` |

**Spécifique par fichier :**

- [ ] **Step 1 : `Sidebar.jsx`** — item actif (`SidebarItem`, branche `isActive`) → `bg-accent/10 text-accent` ; hover/inactif → `text-muted hover:text-fg hover:bg-surface-2`. Bouton « Nouvelle transaction » → `bg-accent text-accent-fg hover:opacity-90`. Brand/aside surfaces → `bg-bg/80`, `border-border`. Lien « ← Nos apps » → `text-muted hover:text-fg hover:bg-surface-2`. L'avatar (classes `me.bgClass/textClass/borderClass`) reste inchangé (couleur de la personne).

- [ ] **Step 2 : `Shell.jsx`** — barres tablette + mobile : `bg-bg/80 backdrop-blur-xl border-border`. Brand → `text-fg`. Onglets tablette actifs → `bg-accent/10 text-accent` ; inactifs → `text-muted hover:text-fg hover:bg-surface-2`. Liens « Nos apps » → `text-muted hover:text-fg`.

- [ ] **Step 3 : `BottomNav.jsx`** — conteneur `bg-bg/80 backdrop-blur-xl border-border` ; onglet actif → `text-accent` ; inactif → `text-muted hover:text-fg`.

- [ ] **Step 4 : Vérifier qu'aucun `white/[` ne subsiste dans la coque**

Run (lecture seule) : rechercher `white/\[` et `#0B0E13` dans `src/apps/finauzi/components/layout/` → attendu : aucune occurrence.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(design): FinAuzi shell adopts amber theme (tokens + accent)"
```

---

## Task 6 : Build + smoke (Clément)

- [ ] **Step 1 :** `! npm run build` → attendu : build vert. Corriger toute erreur (token manquant, import).
- [ ] **Step 2 :** `! npm run dev` puis vérifier :
  - Login indigo/sombre, halo subtil, Geist visible (formes des « a », « g »).
  - Picker → mot de passe (`Input`/`Button` indigo, afficher/masquer) → dashboard.
  - Dashboard premium : date + bonjour, card FinAuzi **sombre/ambre**, card Courses **claire/verte** (tuile lumineuse).
  - `/finauzi` : coque ambre (Sidebar item actif ambre, bouton « Nouvelle transaction » ambre), retour « Nos apps ».
  - `/courses` : passage **sombre→clair fluide** (transition du fond), thème clair/vert.
  - Modales/toasts FinAuzi toujours lisibles (sombre).

---

## Self-Review — couverture de la spec

- §4 tokens + mapping Tailwind → Task 1 ✓
- §4.3 useAppTheme + application 3 zones → Task 2 (+ hub views Task 4, FinAuzi Task 2) ✓
- §5 Geist → Task 1 (index.html + config) ✓
- §6 primitives (Button/Card/Input/Badge) → Task 3 ✓ · re-thématisation kit Radix → **différée** (note de périmètre) ✓
- §7 motion (transition de fond .25s, fade/slide, reduced-motion) → Task 1 styles ✓
- §8 refonte Hub → Task 4 ✓
- §9 coque FinAuzi ambre → Tasks 2 + 5 ✓

Placeholders : aucun. Cohérence des noms de tokens (`bg/surface/surface-2/border/border-strong/fg/muted/faint/accent/accent-fg`) identique entre styles.css, tailwind.config et tous les composants. `useAppTheme(theme, accent)` appelé de façon cohérente partout.
