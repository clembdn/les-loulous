import { Toaster as SharedToaster } from '@/shared/ui/sonner.jsx'

// Le Toaster partagé est codé en dur sombre (palette FinAuzi/MuscAuzi). Cette
// app est en thème clair : on réutilise le composant mais on repasse sur des
// tokens, comme le fait déjà Sheet.jsx pour les modales.
export default function Toaster() {
  return (
    <SharedToaster
      theme="light"
      position="top-center"
      toastOptions={{
        classNames: {
          toast: 'group toast !bg-surface !border !border-border !text-fg !shadow-lift !rounded-xl',
          description: '!text-muted',
          actionButton: '!bg-accent !text-accent-fg',
          cancelButton: '!bg-surface-2 !text-fg',
          success: '!border-emerald-500/40',
          error: '!border-red-500/40',
          info: '!border-sky-500/40',
        },
      }}
    />
  )
}
