import { useCurrency } from '../context/CurrencyContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getPersonByUid } from '../config/people.js'
import { Globe, User, Cloud, LogOut } from 'lucide-react'

function Row({ icon: Icon, title, description, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-border-subtle last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-bg-elevated border border-border-subtle text-text-secondary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export default function SettingsView() {
  const { code, setCode } = useCurrency()
  const { currentUser, logout } = useAuth()
  const person = currentUser ? getPersonByUid(currentUser.uid) : null

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-text-secondary">Préférences pour FinAuzi.</p>
      </div>

      <section className="card">
        <Row icon={User} title="Compte" description={currentUser?.email || '—'}>
          <div className="flex items-center gap-2">
            {person && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${person.bg} ${person.text} border ${person.border}`}>
                {person.label}
              </span>
            )}
          </div>
        </Row>
        <Row icon={Globe} title="Devise d'affichage" description="Basculer entre EUR et AUD globalement">
          <div className="inline-flex p-0.5 rounded-lg bg-bg-elevated border border-border-subtle">
            {['EUR', 'AUD'].map((c) => (
              <button
                key={c}
                onClick={() => setCode(c)}
                className={`px-3 h-8 rounded-md text-xs font-semibold transition-colors ${
                  code === c
                    ? 'bg-brand text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </Row>
        <Row icon={Cloud} title="Stockage" description="Données synchronisées via Firebase en temps réel">
          <span className="pill bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">Actif</span>
        </Row>
      </section>

      {/* Logout */}
      <button
        onClick={logout}
        className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-bg-elevated border border-border-subtle text-sm font-medium text-danger/80 hover:text-danger hover:border-danger/30 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </button>
    </div>
  )
}
