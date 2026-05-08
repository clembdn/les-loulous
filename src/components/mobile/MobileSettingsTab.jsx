import { useState } from 'react'
import { Shield, Database, RotateCcw, ChevronRight, Pencil, Save, X, LogOut, Cloud, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { getPersonByUid, FINAUZI_PEOPLE, THEME_COLORS, getPersonWithColor } from '../../config/people.js'

export default function MobileSettingsTab({ data }) {
  const { format, settings, setSafetyBuffer } = data
  const { currentUser, logout } = useAuth()
  const person = currentUser ? getPersonWithColor(currentUser.uid, settings?.personColors) : null
  const [editingBuffer, setEditingBuffer] = useState(false)
  const [bufferDraft, setBufferDraft] = useState(settings.safetyBuffer)

  const commitBuffer = () => {
    const num = Number(bufferDraft)
    if (num >= 0) setSafetyBuffer(num)
    setEditingBuffer(false)
  }

  return (
    <div className="">
      <h2 className="text-lg font-semibold mb-1">Paramètres</h2>
      <p className="text-xs text-text-muted mb-6">Configuration FinAuzi</p>

      <div className="space-y-3">
        {/* Account info */}
        <div className="rounded-2xl border border-border-subtle bg-bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${person?.bg || 'bg-brand/10'} border ${person?.border || 'border-brand/20'}`}>
              <User className={`h-5 w-5 ${person?.text || 'text-brand-glow'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                {person?.label || 'Utilisateur'}
                {person && (
                  <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-semibold ${person.bg} ${person.text} border ${person.border}`}>
                    {person.shortLabel}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5 truncate">{currentUser?.email}</p>
            </div>
          </div>
        </div>

        {/* Sync status */}
        <div className="rounded-2xl border border-border-subtle bg-bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Cloud className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Données synchronisées</p>
              <p className="text-[11px] text-text-muted mt-0.5">Espace partagé FinAuzi · Firebase</p>
            </div>
          </div>
        </div>

        {/* Safety buffer */}
        <div className="rounded-2xl border border-border-subtle bg-bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Seuil de sécurité</p>
              <p className="text-[11px] text-text-muted mt-0.5">Montant minimum souhaité</p>
            </div>
            {editingBuffer ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="100"
                  value={bufferDraft}
                  onChange={(e) => setBufferDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitBuffer(); if (e.key === 'Escape') setEditingBuffer(false) }}
                  className="h-9 w-24 rounded-xl bg-bg-elevated border border-brand px-2 text-sm outline-none tabular-nums text-right"
                />
                <button onClick={commitBuffer} className="p-1.5 text-emerald-400 active:scale-95"><Save className="h-4 w-4" /></button>
                <button onClick={() => setEditingBuffer(false)} className="p-1.5 text-text-muted active:scale-95"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <button
                onClick={() => { setBufferDraft(settings.safetyBuffer); setEditingBuffer(true) }}
                className="flex items-center gap-1 text-sm font-semibold tabular-nums text-amber-400 active:scale-95"
              >
                {format(settings.safetyBuffer)}
                <Pencil className="h-3 w-3 text-text-muted" />
              </button>
            )}
          </div>
        </div>

        {/* Person Colors */}
        <div className="rounded-2xl border border-border-subtle bg-bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle/50 bg-bg-elevated/50">
            <p className="text-sm font-medium">Couleurs</p>
            <p className="text-[11px] text-text-muted mt-0.5">Personnaliser les badges</p>
          </div>
          <div className="p-4 space-y-4">
            {FINAUZI_PEOPLE.map((p) => {
              const pColor = getPersonWithColor(p.uid, settings?.personColors)
              return (
                <div key={p.uid} className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${pColor.bg} ${pColor.text} border ${pColor.border}`}>
                    {p.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {Object.values(THEME_COLORS).map(theme => (
                      <button
                        key={theme.color}
                        onClick={() => data.setPersonColors({ ...(settings?.personColors || {}), [p.uid]: theme.color })}
                        className={`h-6 w-6 rounded-full border-2 transition-all ${theme.bg} ${pColor.color === theme.color ? `border-current ${theme.text}` : 'border-transparent opacity-50 hover:opacity-100'}`}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Data info */}
        <div className="rounded-2xl border border-border-subtle bg-bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="h-10 w-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
              <Database className="h-5 w-5 text-brand-glow" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Stockage Firebase</p>
              <p className="text-[11px] text-text-muted mt-0.5">Synchronisation temps réel</p>
            </div>
            <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
          </div>
        </div>

        {/* Logout */}
        <div className="rounded-2xl border border-border-subtle bg-bg-card overflow-hidden">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-5 py-4 active:bg-bg-hover transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
              <LogOut className="h-5 w-5 text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-rose-400">Se déconnecter</p>
              <p className="text-[11px] text-text-muted mt-0.5">Fermer la session</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
