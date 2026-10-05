import { cn } from '@/shared/lib/utils.js'

// Indicateur de chargement aux couleurs du thème (le Splash de la plateforme
// est blanc sur sombre, invisible sur le fond clair de l'app).
export default function Loader({ fullScreen = false }) {
  return (
    <div className={cn('flex items-center justify-center', fullScreen ? 'min-h-screen' : 'min-h-[60vh]')}>
      <span className="h-7 w-7 border-2 border-fg/15 border-t-accent rounded-full animate-spin" />
    </div>
  )
}
