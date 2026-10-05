import { Toaster as SonnerToaster, toast } from 'sonner'

// Dark-themed toaster matching FinAuzi palette. Mounted once at app root.
export function Toaster(props) {
  return (
    <SonnerToaster
      theme="dark"
      position="top-center"
      closeButton={false}
      richColors={false}
      duration={2800}
      toastOptions={{
        classNames: {
          toast:
            'group toast !bg-[#161B24] !border !border-white/10 !text-white !shadow-2xl !rounded-xl',
          description: '!text-white/60',
          actionButton: '!bg-white !text-black',
          cancelButton: '!bg-white/10 !text-white',
          success: '!border-emerald-500/30',
          error: '!border-red-500/30',
          info: '!border-sky-500/30',
        },
      }}
      {...props}
    />
  )
}

// Variante à tokens : suit le thème de l'app au lieu de la palette sombre
// ci-dessus. Pour les apps claires (Cook'It, Trip Planner).
export function ThemedToaster({ theme = 'light', ...props }) {
  return (
    <SonnerToaster
      theme={theme}
      position="top-center"
      closeButton={false}
      richColors={false}
      duration={2800}
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
      {...props}
    />
  )
}

export { toast }
