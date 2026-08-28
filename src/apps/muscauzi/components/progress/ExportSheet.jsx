import { useState } from 'react'
import { Download, Dumbbell, Scale, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/context/AuthContext.jsx'
import { downloadText } from '@/shared/lib/download.js'
import { toLocalDateKey } from '@/shared/lib/dates.js'
import { Sheet, SheetContent, SheetBody } from '@/shared/ui/sheet.jsx'
import { downloadSetsCsv, downloadWeightsCsv } from '../../utils/exportCsv.js'
import { collectBackup } from '../../services/backupService.js'
import { doneSets, hasCompletedWork } from '../../services/sessionsService.js'

/**
 * Sortir ses données de l'appli.
 *
 * Deux fichiers CSV plutôt qu'un : des séries et des pesées ne sont pas la même
 * chose et n'ont ni les mêmes colonnes ni le même rythme. Les empiler dans un
 * seul tableau aurait obligé à laisser la moitié des cellules vides sur chaque
 * ligne — la première chose qui fait trébucher une lecture automatique.
 *
 * Le grain est la SÉRIE, jamais un total : d'une série on redéduit une séance,
 * un exercice, un mois. L'inverse est impossible.
 *
 * Le JSON, lui, ne se lit pas : il se garde. C'est la copie intégrale des
 * documents, champs hérités compris, celle qu'on rouvrirait si quelque chose
 * tournait mal.
 */
export default function ExportSheet({ open, onOpenChange, sessions, exerciseById, weights }) {
  const { currentUid } = useAuth()
  const [backingUp, setBackingUp] = useState(false)

  // Compté avec la MÊME règle que l'export : seules les séries portant des
  // répétitions produisent une ligne. Un total annoncé plus généreux que le
  // fichier livré ferait douter du fichier.
  const setCount = sessions.reduce(
    (n, s) => n + Object.values(s.entries || {}).reduce((m, e) => m + doneSets(e).length, 0),
    0,
  )
  const sessionCount = sessions.filter((s) => hasCompletedWork(s)).length

  const downloadBackup = async () => {
    setBackingUp(true)
    try {
      const data = await collectBackup(currentUid)
      downloadText(
        `muscauzi-sauvegarde-${toLocalDateKey(new Date())}.json`,
        JSON.stringify(data, null, 2),
        { type: 'application/json;charset=utf-8;' },
      )
      toast.success('Sauvegarde téléchargée')
    } catch (err) {
      console.error('[MuscAuzi] backup failed:', err)
      toast.error('Sauvegarde impossible')
    } finally {
      setBackingUp(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" desktopSide="right" title="Exporter mes performances" className="bg-surface border-border">
        <SheetBody>
          <p className="text-[13px] leading-relaxed text-muted mb-4">
            Fichiers CSV standards — séparateur virgule, décimales au point. Prêts à être relus
            par un tableur ou donnés à analyser.
          </p>

          <div className="space-y-2">
            <Row
              icon={Dumbbell}
              title="Séries détaillées"
              detail={`${setCount} série${setCount > 1 ? 's' : ''} · ${sessionCount} séance${sessionCount > 1 ? 's' : ''}`}
              hint="Une ligne par série : date, séance, exercice, charge, répétitions, volume, 1RM estimé."
              onClick={() => downloadSetsCsv(sessions, exerciseById)}
              disabled={setCount === 0}
            />
            <Row
              icon={Scale}
              title="Pesées"
              detail={`${weights.length} pesée${weights.length > 1 ? 's' : ''}`}
              hint="Une ligne par jour : date et poids."
              onClick={() => downloadWeightsCsv(weights)}
              disabled={weights.length === 0}
            />
            <Row
              icon={Archive}
              title="Sauvegarde complète"
              detail={backingUp ? 'Lecture en cours…' : 'JSON · tout le profil'}
              hint="Catalogue, programme, séances, notes et pesées, tels quels. À garder de côté avant toute grosse modification."
              onClick={downloadBackup}
              disabled={backingUp}
            />
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

function Row({ icon: Icon, title, detail, hint, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border border-border bg-surface text-left
                 transition active:scale-[0.99] hover:border-border-strong
                 disabled:opacity-40 disabled:pointer-events-none"
    >
      <span className="h-9 w-9 shrink-0 rounded-xl bg-surface-2 flex items-center justify-center text-accent">
        <Icon size={16} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-fg">{title}</span>
        <span className="block text-[11px] text-faint tabular mt-0.5">{detail}</span>
        <span className="block text-[11px] text-muted mt-1.5 leading-relaxed">{hint}</span>
      </span>
      <Download size={16} className="shrink-0 text-faint mt-1" />
    </button>
  )
}
