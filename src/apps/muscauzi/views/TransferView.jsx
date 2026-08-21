import { useState } from 'react'
import { Download, Upload, Copy, Check, AlertTriangle, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { Button } from '@/shared/ui/Button.jsx'
import { Card } from '@/shared/ui/Card.jsx'
import { Textarea } from '@/shared/ui/Textarea.jsx'
import { Alert } from '@/shared/ui/Alert.jsx'
import SegmentedTabs from '@/shared/ui/SegmentedTabs.jsx'
import { getPersonLabel } from '@/shared/config/people.js'
import { SETTINGS_SUBS } from '../config/navigation.js'
import { buildExport, parseTransfer, applyImport, rebuildCatalogue } from '../services/transferService.js'

// Transfert entre profils : on exporte depuis le compte où les données ont
// atterri, on se reconnecte au bon, on colle. Sert aussi de sauvegarde.
export default function TransferView({ onNavigate }) {
  const { currentUid } = useAuth()
  const me = getPersonLabel(currentUid)

  return (
    <div className="max-w-xl mx-auto px-4 pt-5 pb-28 lg:pb-10 lg:pt-8 lg:px-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-[0.18em] text-faint">Réglages</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg mt-1">Transfert</h1>
        <p className="text-sm text-muted mt-1">
          Déplacer un programme d’un profil à l’autre, sans tout ressaisir.
        </p>
      </header>

      <SegmentedTabs items={SETTINGS_SUBS} active="transfert" onChange={onNavigate} className="mb-5" />

      <ExportCard uid={currentUid} me={me} />
      <ImportCard uid={currentUid} me={me} />
      <RebuildCard uid={currentUid} />
    </div>
  )
}

function ExportCard({ uid, me }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setBusy(true)
    try {
      const payload = await buildExport(uid)
      setText(JSON.stringify(payload))
    } catch (err) {
      console.error('[MuscAuzi] export failed:', err)
      toast.error('Export impossible')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Export copié')
    } catch {
      // Presse-papier refusé (contexte non sécurisé) : on sélectionne le
      // texte pour que la copie manuelle reste possible.
      document.getElementById('musc-export')?.select()
      toast.error('Copie auto refusée — le texte est sélectionné')
    }
  }

  return (
    <Card className="p-5 mb-4">
      <h2 className="text-sm font-semibold text-fg inline-flex items-center gap-2">
        <Download size={16} className="text-accent" /> Exporter — profil {me}
      </h2>
      <p className="text-xs text-muted mt-1 leading-relaxed">
        Programme, notes, séances et pesées de ce profil, dans un texte à coller ailleurs.
      </p>

      {text ? (
        <>
          <Textarea
            id="musc-export"
            readOnly
            value={text}
            rows={4}
            onFocus={(e) => e.target.select()}
            className="mt-3 text-[11px] font-mono text-muted"
          />
          <div className="flex gap-2 mt-3">
            <Button variant="secondary" className="flex-1" onClick={generate} disabled={busy}>
              Régénérer
            </Button>
            <Button className="flex-1" onClick={copy}>
              {copied ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} />}
              {copied ? 'Copié' : 'Copier'}
            </Button>
          </div>
        </>
      ) : (
        <Button className="w-full mt-3" onClick={generate} disabled={busy}>
          {busy ? 'Lecture…' : 'Générer l’export'}
        </Button>
      )}
    </Card>
  )
}

// Filet de sécurité pour les catalogues vidés du temps où ils étaient communs
// aux deux comptes : le programme a gardé ses exercices, ses séries et son
// ordre, seuls les mouvements ont disparu du catalogue.
function RebuildCard({ uid }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const run = async () => {
    setBusy(true)
    try {
      const r = await rebuildCatalogue(uid, uid)
      setResult(r)
      if (r.recreated === 0) toast.message('Rien à reconstruire — ton catalogue est complet')
      else toast.success(`${r.recreated} exercice${r.recreated > 1 ? 's' : ''} recréé${r.recreated > 1 ? 's' : ''}`)
    } catch (err) {
      console.error('[MuscAuzi] rebuild failed:', err)
      toast.error('Reconstruction impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 mt-4">
      <h2 className="text-sm font-semibold text-fg inline-flex items-center gap-2">
        <Wrench size={16} className="text-accent" /> Reconstruire le catalogue
      </h2>
      <p className="text-xs text-muted mt-1 leading-relaxed">
        Recrée les exercices que ton programme et tes séances utilisent encore mais
        qui ne sont plus dans ton catalogue.
      </p>

      {result && (
        <Alert variant={result.unnamed > 0 ? 'warning' : 'success'} icon={Wrench} className="mt-3">
          {result.recreated === 0
            ? 'Aucun exercice manquant.'
            : <>
                {result.named} retrouvé{result.named > 1 ? 's' : ''} avec leur nom.
                {result.unnamed > 0 && <> {result.unnamed} sans nom connu, créé{result.unnamed > 1 ? 's' : ''} sous un libellé provisoire — à renommer dans Exercices.</>}
              </>}
        </Alert>
      )}

      <Button variant="secondary" className="w-full mt-3" onClick={run} disabled={busy}>
        {busy ? 'Analyse…' : 'Reconstruire'}
      </Button>
    </Card>
  )
}

function ImportCard({ uid, me }) {
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState(null)
  const [busy, setBusy] = useState(false)

  const onPaste = (value) => {
    setRaw(value)
    setParsed(value.trim() ? parseTransfer(value) : null)
  }

  const run = async () => {
    if (!parsed?.payload) return
    setBusy(true)
    try {
      const { applied, skipped } = await applyImport(uid, parsed.payload, uid)
      const bits = [
        applied.programDays > 0 && `${applied.programDays} jours de programme`,
        applied.exercises > 0 && `${applied.exercises} exercices`,
        applied.notes > 0 && `${applied.notes} notes`,
        applied.sessions > 0 && `${applied.sessions} séances`,
        applied.weights > 0 && `${applied.weights} pesées`,
      ].filter(Boolean)
      toast.success(bits.length ? `Importé : ${bits.join(', ')}` : 'Rien de nouveau à importer')
      if (skipped.sessions + skipped.weights + skipped.notes > 0) {
        toast.message('Certains éléments existaient déjà et ont été laissés intacts')
      }
      setRaw(''); setParsed(null)
    } catch (err) {
      console.error('[MuscAuzi] import failed:', err)
      toast.error('Import impossible')
    } finally {
      setBusy(false)
    }
  }

  const s = parsed?.summary

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-fg inline-flex items-center gap-2">
        <Upload size={16} className="text-accent" /> Importer — vers le profil {me}
      </h2>
      <p className="text-xs text-muted mt-1 leading-relaxed">
        Colle ici l’export généré depuis l’autre profil.
      </p>

      <Textarea
        value={raw}
        onChange={(e) => onPaste(e.target.value)}
        rows={4}
        placeholder="Colle l’export ici…"
        className="mt-3 text-[11px] font-mono"
      />

      {parsed?.error && (
        <p className="text-xs text-danger mt-2">{parsed.error}</p>
      )}

      {s && (
        <>
          <ul className="mt-3 space-y-1 text-xs text-muted tabular">
            <li>{s.programDays} jour{s.programDays > 1 ? 's' : ''} de programme</li>
            <li>{s.exercises} exercice{s.exercises > 1 ? 's' : ''} · {s.notes} note{s.notes > 1 ? 's' : ''}</li>
            <li>{s.sessions} séance{s.sessions > 1 ? 's' : ''} · {s.weights} pesée{s.weights > 1 ? 's' : ''}</li>
          </ul>

          <Alert variant="warning" icon={AlertTriangle} className="mt-3">
            Le programme de <span className="text-fg">{me}</span> sera remplacé.
            Les séances et pesées déjà enregistrées ici ne seront pas touchées.
          </Alert>

          <Button className="w-full mt-3" onClick={run} disabled={busy}>
            {busy ? 'Import en cours…' : 'Importer'}
          </Button>
        </>
      )}
    </Card>
  )
}
