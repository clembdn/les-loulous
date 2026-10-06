import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils.js'
import { useTripWeather } from '../../context/TripWeatherContext.jsx'
import { formatTemp, WEATHER_LABELS } from '../../utils/weather.js'

const ICONS = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
}

// Une touche de couleur pour le soleil et la pluie, le reste en gris : la
// météo informe, elle ne doit pas voler la vedette au programme.
const TONES = {
  clear: 'text-amber-500',
  partly: 'text-amber-500',
  drizzle: 'text-sky-600',
  rain: 'text-sky-600',
  storm: 'text-violet-600',
}

function describe(weather) {
  const temps = `${formatTemp(weather.tmax)} / ${formatTemp(weather.tmin)}`
  if (weather.source === 'normal') {
    const rain = weather.rain != null ? `, pluie ${weather.rain} % des jours` : ''
    return `Normale de saison (moyenne sur 5 ans) : ${temps}${rain}`
  }
  const label = WEATHER_LABELS[weather.kind] || 'Prévision'
  const rain = weather.rain != null ? ` · pluie ${weather.rain} %` : ''
  return `${label} · ${temps}${rain}${weather.stale ? ' · prévision non actualisée' : ''}`
}

/**
 * Une petite météo : l'icône et la maximale. Une normale de saison est en
 * grisé et précédée de « ~ » : ce qu'il fait d'habitude, pas une prévision.
 * `detailed` ajoute la minimale (prochaine étape, en grand).
 */
export default function WeatherBadge({ weather, detailed = false, className }) {
  if (!weather) return null
  const normal = weather.source === 'normal'
  const Icon = ICONS[weather.kind] || Cloud
  const label = describe(weather)
  return (
    <span
      title={label}
      className={cn('inline-flex items-center gap-1 tabular whitespace-nowrap', 'text-muted', className)}
    >
      <Icon size={detailed ? 16 : 14} className={cn('shrink-0', !normal && TONES[weather.kind])} aria-hidden="true" />
      <span aria-hidden="true" className={cn(!normal && 'text-fg font-medium')}>{normal ? '~' : ''}{formatTemp(weather.tmax)}</span>
      {detailed && <span aria-hidden="true" className="text-muted">{formatTemp(weather.tmin)}</span>}
      <span className="sr-only">{label}</span>
    </span>
  )
}

/**
 * La météo d'une journée : un lieu en ville, deux un jour de route
 * (« ☀ 24° → ⛅ 19° »). Rien tant qu'aucun lieu n'est localisé.
 */
export function DayWeather({ date, className }) {
  const { dayWeather } = useTripWeather()
  const list = dayWeather(date)
  if (!list.length) return null
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', className)}>
      {list.map((weather, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-muted" aria-hidden="true">→</span>}
          <WeatherBadge weather={weather} />
        </span>
      ))}
    </span>
  )
}
