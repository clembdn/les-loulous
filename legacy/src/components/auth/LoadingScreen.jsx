import { Plane } from 'lucide-react'

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[350px] bg-brand-dim/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative flex flex-col items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-brand/15 border border-brand/30 flex items-center justify-center">
          <Plane className="h-8 w-8 text-brand-glow animate-pulse" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">FinAuzi</h1>
          <p className="text-sm text-text-muted mt-1">Notre trésorerie pour l'Australie</p>
        </div>
        <div className="mt-4">
          <span className="inline-block h-5 w-5 border-2 border-brand/30 border-t-brand-glow rounded-full animate-spin" />
        </div>
      </div>
    </div>
  )
}
