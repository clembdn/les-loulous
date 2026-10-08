import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils.js'
import { canUseWebGL, loadMaplibre, prefersReducedMotion } from '../map/loadMaplibre.js'
import { litGeoJSON, pointsGeoJSON } from '../../utils/world.js'
import WorldSvg, { WORLD_COLORS } from './WorldSvg.jsx'

const STYLE_URL = '/trip-map/style.json'
const EMPTY = { type: 'FeatureCollection', features: [] }

/**
 * La carte du monde en grand : un globe qu'on fait tourner et qu'on zoome
 * (MapLibre, style « Lagon », noms des pays en français), les terres
 * visitées allumées, un halo par lieu. Toucher une terre ou un lieu choisit
 * son pays ; `selected` le met en avant et y vole.
 *
 * Les contours sont simplifiés (1:110m) : nets vus de loin, approximatifs de
 * près. Ils s'effacent donc en zoomant, et les halos prennent le relais —
 * une île comme Ouvéa n'a que le sien. Sans WebGL : la carte SVG.
 */
export default function WorldGlobe({ world, visits, selected, onSelect, className }) {
  const [mode, setMode] = useState(() => (canUseWebGL() ? 'map' : 'fallback'))
  const [ready, setReady] = useState(false)
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const latest = useRef({})
  latest.current = { visits, onSelect, selected }
  const fitted = useRef(false)

  useEffect(() => {
    if (mode !== 'map') return undefined
    let cancelled = false
    let map = null
    loadMaplibre().then((maplibregl) => {
      if (cancelled || !containerRef.current) return
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [15, 25],
        zoom: 1.1,
        minZoom: 0,
        maxZoom: 9,
        attributionControl: false,
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        fadeDuration: 120,
      })
      map.__lib = maplibregl
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.touchZoomRotate.disableRotation()
      map.on('style.load', () => map.setProjection({ type: 'globe' }))
      map.on('load', () => {
        if (cancelled) return
        map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
        addLayers(map)
        const layers = ['world-points-dot', 'world-points-glow', 'world-lit-fill']
        // Un lieu d'abord (plus précis qu'une terre), sinon une terre ; à côté : rien.
        map.on('click', (e) => {
          const hit = map.queryRenderedFeatures(e.point, { layers })[0]
          latest.current.onSelect?.(hit?.properties?.country || null)
        })
        for (const layer of layers) {
          map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
          map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
        }
        setReady(true)
      })
      mapRef.current = map
    }).catch(() => {
      if (!cancelled) setMode('fallback')
    })
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
      fitted.current = false
      setReady(false)
    }
  }, [mode])

  // Les données : terres allumées, lieux. Le premier jeu cadre la vue.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !visits) return
    map.getSource('world-lit')?.setData(litGeoJSON(visits.lit))
    map.getSource('world-points')?.setData(pointsGeoJSON(visits.points))
    if (!fitted.current) {
      fitted.current = true
      initialView(map, visits)
    }
  }, [ready, visits])

  // Le pays choisi : mis en avant, et la carte y vole.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setFilter('world-selected', ['==', ['get', 'country'], selected || ''])
    if (!selected || !visits) return
    const bounds = boundsOf(map.__lib, visits, selected)
    if (bounds) {
      map.fitBounds(bounds, {
        padding: 56,
        maxZoom: 6,
        duration: prefersReducedMotion() ? 0 : 1100,
      })
    }
  }, [ready, selected, visits])

  if (mode === 'fallback') {
    return (
      <div className={cn('flex items-center', className)} style={{ background: WORLD_COLORS.sea }}>
        <WorldSvg world={world} visits={visits} selected={selected} onSelect={onSelect} className="aspect-[2/1]" />
      </div>
    )
  }
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ background: 'radial-gradient(ellipse at 50% 45%, #134E5E 0%, #0B2A35 55%, #071A21 100%)' }}>
      {/* Taille explicite : MapLibre impose `position: relative` à son
          conteneur, qui perdrait toute hauteur en `absolute inset-0`. */}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}

const RAD = Math.PI / 180

/**
 * La vue d'arrivée. Des voyages dans une même région (≤ 35° autour de leur
 * centre) : on la cadre. Éparpillés sur la planète : le globe entier, tourné
 * vers le centre de gravité des lieux — un cadre « englobant » Lisbonne et
 * Auckland ne veut rien dire sur une sphère.
 */
function initialView(map, visits) {
  const pts = visits.points.length
    ? visits.points
    : [...visits.lit.values()].map(({ part }) => part.center)
  if (!pts.length) return
  let x = 0
  let y = 0
  let z = 0
  for (const p of pts) {
    x += Math.cos(p.lat * RAD) * Math.cos(p.lng * RAD)
    y += Math.cos(p.lat * RAD) * Math.sin(p.lng * RAD)
    z += Math.sin(p.lat * RAD)
  }
  const center = {
    lat: Math.atan2(z, Math.hypot(x, y)) / RAD,
    lng: Math.atan2(y, x) / RAD,
  }
  const spread = Math.max(...pts.map((p) => angle(p, center)))
  if (spread <= 35) {
    const bounds = boundsOf(map.__lib, visits)
    if (bounds) map.fitBounds(bounds, { padding: 56, maxZoom: 4, duration: 0 })
    return
  }
  // Le globe entier dans le cadre. MapLibre le grossit comme Mercator selon
  // la latitude du centre : son diamètre vaut 512 × 2^zoom / (π cos lat).
  // Le centre reste dans une bande « naturelle » : des voyages aux quatre
  // coins du monde ne doivent pas montrer le globe par le pôle Nord.
  const lat = Math.max(-25, Math.min(35, center.lat))
  const { clientWidth: w, clientHeight: h } = map.getContainer()
  const zoom = Math.log2((0.84 * Math.min(w, h) * Math.PI * Math.cos(lat * RAD)) / 512)
  map.jumpTo({ center: [center.lng, lat], zoom })
}

function angle(a, b) {
  const cos = Math.sin(a.lat * RAD) * Math.sin(b.lat * RAD)
    + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((a.lng - b.lng) * RAD)
  return Math.acos(Math.min(1, Math.max(-1, cos))) / RAD
}

function boundsOf(maplibregl, visits, country = null) {
  const bounds = new maplibregl.LngLatBounds()
  let any = false
  for (const p of visits.points) {
    if (country && p.country !== country) continue
    bounds.extend([p.lng, p.lat])
    any = true
  }
  for (const { part } of visits.lit.values()) {
    if (country && part.country !== country) continue
    const [minX, minY, maxX, maxY] = part.bbox
    bounds.extend([minX / 100, minY / 100])
    bounds.extend([maxX / 100, maxY / 100])
    any = true
  }
  return any ? bounds : null
}

function addLayers(map) {
  map.addSource('world-lit', { type: 'geojson', data: EMPTY })
  map.addSource('world-points', { type: 'geojson', data: EMPTY })
  // Sous les noms : les étiquettes du fond restent lisibles sur les terres allumées.
  const beforeId = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  // Les contours simplifiés s'effacent en zoomant : de près, ils ne suivent
  // plus les côtes du fond de carte.
  const fade = (from, to) => ['interpolate', ['linear'], ['zoom'], 0, from, 4, from * 0.8, 6.5, to]
  map.addLayer({
    id: 'world-lit-fill',
    type: 'fill',
    source: 'world-lit',
    paint: {
      'fill-color': ['case', ['get', 'visited'], WORLD_COLORS.visited, WORLD_COLORS.planned],
      'fill-opacity': fade(0.72, 0.08),
    },
  }, beforeId)
  map.addLayer({
    id: 'world-selected',
    type: 'line',
    source: 'world-lit',
    filter: ['==', ['get', 'country'], ''],
    layout: { 'line-join': 'round' },
    paint: { 'line-color': WORLD_COLORS.selected, 'line-width': 2.5, 'line-opacity': fade(1, 0.3) },
  }, beforeId)
  // Le halo d'un lieu, à sa taille réelle (km → pixels : ×2 à chaque cran de
  // zoom, d'où l'interpolation exponentielle), jamais plus petit qu'un point
  // qu'on voit. MapLibre n'accepte `zoom` qu'en tête d'une interpolation.
  const haloAt = (z) => ['max', 11, ['*', ['get', 'radiusKm'], 1.4 * (256 / 40075) * 2 ** z]]
  map.addLayer({
    id: 'world-points-glow',
    type: 'circle',
    source: 'world-points',
    paint: {
      'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, haloAt(0), 10, haloAt(10)],
      'circle-color': WORLD_COLORS.glow,
      'circle-opacity': ['case', ['get', 'visited'], 0.35, 0.18],
      'circle-blur': 0.7,
    },
  })
  map.addLayer({
    id: 'world-points-dot',
    type: 'circle',
    source: 'world-points',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 3, 6, 5],
      'circle-color': ['case', ['get', 'visited'], WORLD_COLORS.selected, '#FFFFFF'],
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 1.5,
    },
  })
}
