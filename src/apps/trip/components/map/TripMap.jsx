import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils.js'
import { ROUTE_COLOR, TRANSPORT_COLOR } from '../../config/palette.js'
import { dayRoute } from '../../utils/route.js'
import { legKey, routeLines } from '../../utils/legs.js'
import { guessCategory } from '../../utils/categoryGuess.js'
import { hasCoords } from '../../utils/geo.js'
import { getCategory } from '../../config/categories.js'
import MiniMap from './MiniMap.jsx'
import { canUseWebGL, loadMaplibre, prefersReducedMotion } from './loadMaplibre.js'
import { createMarkerElement, describeGroup, groupPoints, updateMarkerElement } from './markers.js'

const STYLE_URL = '/trip-map/style.json'
const DEFAULT_PADDING = { top: 40, bottom: 40, left: 40, right: 40 }
const SINGLE_ZOOM = 14.5
const FOCUS_ZOOM = 15.5
// Les lieux d'intérêt du style (cf. scripts/trip-map-style.mjs), cliquables.
const POI_LAYERS = ['poi_r1', 'poi_r7', 'poi_transit']
const NO_IDEAS = []

/**
 * La vraie carte d'une journée : fond OpenFreeMap (style « Lagon », cf.
 * scripts/trip-map-style.mjs), repères aux couleurs de la frise, tracé entre
 * les lieux. MapLibre n'est chargé qu'ici, à la demande.
 *
 * Hors-ligne, le style est dans l'app et les tuiles dans le cache (préchargées
 * avant le départ, cf. services/mapTiles.js) ; une tuile manquante laisse un
 * fond uni, les repères et le tracé restent. Sans WebGL, ou tant que la carte
 * se charge, la mini-carte SVG tient la place.
 *
 *  · `interactive` : on peut la déplacer et zoomer. Sinon elle est figée et
 *    `onPress` (« voir le déroulé ») la rend entièrement cliquable ;
 *  · `cooperative` (avec `interactive`) : sur téléphone, deux doigts pour
 *    déplacer la carte, un doigt fait défiler la page (carte posée dans une
 *    page qui défile, cf. récap) ;
 *  · `dots` : les étapes en points sans numéro (tout un voyage, cf. récap) ;
 *  · `ideas` : des lieux à caser, en repères creux hors du parcours (clé
 *    `idea:<id>` pour `activeKey`, `onSelect` et `onHover`). Ils ne
 *    comptent dans le cadrage que si la journée n'a aucun lieu ;
 *  · `activeKey` : l'élément de frise mis en avant (survol, étape courante) ;
 *  · `focusKey` : la carte vole jusqu'à cet élément (déroulé), au moins au
 *    zoom `focusZoom` ; nul = toute la journée ;
 *  · `dimOthers` : les autres tronçons s'estompent (déroulé) ;
 *  · `pastKeys` : les éléments passés, grisés (écran Aujourd'hui) ;
 *  · `fallbackCenter` : où regarder quand la journée n'a encore aucun lieu ;
 *  · `onPlaceClick(place | null)` : un lieu d'intérêt de la carte touché
 *    (musée, plage, café…), `{ name, lat, lng, category }` — pour l'ajouter ;
 *  · `preview` : ce lieu, marqué en pointillés le temps de décider ;
 *  · `legs` (`useDayView`) : les trajets calculés, tracés par la route au
 *    lieu de la ligne pointillée à vol d'oiseau ;
 *  · `fitKey` (le jour affiché) : si on a soi-même déplacé ou zoomé la
 *    carte, elle ne se recadre plus à chaque lieu ajouté, seulement quand
 *    `fitKey` change.
 */
export default function TripMap({
  items, home = null, legs = null, colorIndexByStay = {}, pastKeys = null, ideas = null, dots = false,
  activeKey = null, focusKey = null, dimOthers = false,
  interactive = false, cooperative = false, onPress = null, pressLabel = 'Ouvrir la carte',
  onSelect = null, onHover = null, onPlaceClick = null, preview = null, fitKey = null,
  padding = DEFAULT_PADDING, fallbackCenter = null, controls = false, focusZoom = FOCUS_ZOOM,
  attribution = 'top-right', className,
}) {
  const baseRoute = useMemo(() => dayRoute(items, { home }), [items, home])
  // Les tracés arrivent après coup : ils redessinent la ligne, pas les repères.
  const route = useMemo(() => withLines(baseRoute, routeLines(legs)), [baseRoute, legs])
  const groups = useMemo(
    () => groupPoints(baseRoute.home ? [...baseRoute.points, baseRoute.home] : baseRoute.points),
    [baseRoute],
  )
  const ideaPoints = useMemo(() => (ideas || NO_IDEAS).filter(hasCoords), [ideas])
  const empty = groups.length === 0 && ideaPoints.length === 0
  const [mode, setMode] = useState(() => (canUseWebGL() ? 'map' : 'fallback'))
  const [ready, setReady] = useState(false)
  const wrapperRef = useRef(null)
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const size = useElementSize(wrapperRef)

  // Les rappels changent à chaque rendu ; les marqueurs DOM lisent toujours les derniers.
  const handlers = useRef({})
  handlers.current = {
    onSelect: (keys) => keys?.length && onSelect?.(keys[0]),
    onHover: (keys) => onHover?.(keys?.[0] ?? null),
    onPlaceClick,
  }
  const latest = useRef({})
  latest.current = { route, ideaPoints, dots, padding, activeKey, focusKey, dimOthers, pastKeys, colorIndexByStay, fallbackCenter, focusZoom, fitKey }
  // Vue réglée à la main (glisser, molette), et pour quel jour.
  const userView = useRef(null)

  const showMap = mode === 'map' && (!empty || fallbackCenter)

  // Création de la carte : une fois par instance, pas à chaque changement de jour.
  useEffect(() => {
    if (!showMap) return undefined
    let cancelled = false
    let map = null
    loadMaplibre().then((maplibregl) => {
      if (cancelled || !containerRef.current) return
      const { route: r, ideaPoints: extra, padding: pad, fallbackCenter: center } = latest.current
      const bounds = boundsOf(r, extra, maplibregl)
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        attributionControl: false,
        interactive,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxZoom: 17.5,
        fadeDuration: 120,
        ...(interactive && cooperative ? {
          cooperativeGestures: true,
          locale: {
            'CooperativeGesturesHandler.MobileHelpText': 'Deux doigts pour déplacer la carte',
            'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl + molette pour zoomer',
            'CooperativeGesturesHandler.MacHelpText': '⌘ + molette pour zoomer',
          },
        } : {}),
        ...(bounds
          ? { bounds, fitBoundsOptions: { padding: pad, maxZoom: SINGLE_ZOOM } }
          : { center: center ? [center.lng, center.lat] : [0, 20], zoom: center ? 11 : 1 }),
      })
      map.__lib = maplibregl
      map.addControl(new maplibregl.AttributionControl({ compact: true }), attribution)
      if (interactive) {
        map.touchZoomRotate.disableRotation()
        if (controls) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      }
      // Seul un geste de l'utilisateur compte, pas nos propres cadrages
      // (le zoom à la molette n'en porte pas la trace côté MapLibre : on
      // écoute donc les gestes eux-mêmes).
      const mark = () => { userView.current = latest.current.fitKey }
      const surface = map.getCanvasContainer()
      for (const type of ['wheel', 'pointerdown', 'touchstart']) surface.addEventListener(type, mark, { passive: true })
      map.on('load', () => {
        if (cancelled) return
        // L'attribution reste en petit (i) : dépliée, elle mangerait le bas
        // d'une carte figée, qui ne la replierait jamais d'elle-même.
        map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
        addRouteLayers(map)
        if (interactive) listenToPlaces(map, handlers)
        setReady(true)
      })
      mapRef.current = map
    }).catch(() => {
      if (!cancelled) setMode('fallback')
    })
    return () => {
      cancelled = true
      markersRef.current.forEach((m) => m.marker.remove())
      markersRef.current = []
      map?.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [showMap, interactive, cooperative, controls, attribution])

  // Les lieux du jour : repères et tracé, puis cadrage sur toute la journée.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const maplibregl = map.__lib
    const { colorIndexByStay: colors, pastKeys: past, activeKey: active, dots: asDots } = latest.current
    markersRef.current.forEach((m) => m.marker.remove())
    markersRef.current = groups.map((group) => {
      const desc = describeGroup(group, { colorIndexByStay: colors, past, dots: asDots })
      const el = createMarkerElement(desc, {
        onSelect: (keys) => handlers.current.onSelect(keys),
        onHover: (keys) => handlers.current.onHover(keys),
      })
      updateMarkerElement(el, desc, !!active && desc.keys.includes(active))
      const marker = new maplibregl.Marker({ element: el }).setLngLat([group.at.lng, group.at.lat]).addTo(map)
      return { marker, el, group }
    })
    refreshRoute(map)
    const { focusKey: focus, fitKey: key } = latest.current
    const keepView = key != null && userView.current === key
    if (!focus && !keepView) fitDay(map, { animate: true })
  }, [ready, groups]) // eslint-disable-line react-hooks/exhaustive-deps

  // Les lieux à caser : des repères creux, sous ceux de la journée.
  const ideaMarkersRef = useRef([])
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return undefined
    const maplibregl = map.__lib
    ideaMarkersRef.current = ideaPoints.map((idea) => {
      const desc = describeIdea(idea)
      const el = createMarkerElement(desc, {
        onSelect: (keys) => handlers.current.onSelect(keys),
        onHover: (keys) => handlers.current.onHover(keys),
      })
      updateIdeaElement(el, desc, latest.current.activeKey === desc.keys[0])
      const marker = new maplibregl.Marker({ element: el }).setLngLat([idea.lng, idea.lat]).addTo(map)
      return { marker, el, desc }
    })
    // Rien que des lieux à caser (l'écran « À caser ») : ce sont eux qu'on cadre.
    const { route: r, fitKey: key } = latest.current
    const keepView = key != null && userView.current === key
    if (!r.points.length && !r.home && !keepView) fitDay(map, { animate: true })
    return () => {
      ideaMarkersRef.current.forEach((m) => m.marker.remove())
      ideaMarkersRef.current = []
    }
  }, [ready, ideaPoints]) // eslint-disable-line react-hooks/exhaustive-deps

  // L'élément mis en avant et le passé : repères et tronçons, sans recadrer.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    for (const { el, group } of markersRef.current) {
      const desc = describeGroup(group, { colorIndexByStay, past: pastKeys, dots })
      updateMarkerElement(el, desc, !!activeKey && desc.keys.includes(activeKey))
    }
    for (const { el, desc } of ideaMarkersRef.current) updateIdeaElement(el, desc, activeKey === desc.keys[0])
    refreshRoute(map)
  }, [ready, activeKey, pastKeys, colorIndexByStay, dimOthers, route]) // eslint-disable-line react-hooks/exhaustive-deps

  // Voler jusqu'à un élément (déroulé), ou revenir à toute la journée.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    if (!focusKey) {
      fitDay(map, { animate: true })
      return
    }
    const point = [...latest.current.route.points, latest.current.route.home].find((p) => p?.itemKey === focusKey)
    if (!point) return
    map.resize()
    const camera = {
      center: [point.lng, point.lat],
      zoom: Math.max(map.getZoom(), latest.current.focusZoom),
      padding: latest.current.padding,
    }
    if (prefersReducedMotion()) map.jumpTo(camera)
    else map.flyTo({ ...camera, duration: 900, essential: true })
  }, [ready, focusKey])

  // Le lieu touché sur la carte, en pointillés le temps de décider.
  const previewRef = useRef(null)
  useEffect(() => {
    const map = mapRef.current
    previewRef.current?.remove()
    previewRef.current = null
    if (!ready || !map || !preview) return
    const el = document.createElement('div')
    el.className = 'trip-marker-anchor'
    el.innerHTML = '<span class="trip-marker trip-marker--circle is-preview" aria-hidden="true">+</span>'
    el.style.zIndex = '4'
    previewRef.current = new map.__lib.Marker({ element: el }).setLngLat([preview.lng, preview.lat]).addTo(map)
  }, [ready, preview])

  // La taille du conteneur change (rotation, colonne qui s'élargit) : MapLibre doit le savoir.
  useEffect(() => {
    if (ready) mapRef.current?.resize()
  }, [ready, size.width, size.height])

  function refreshRoute(map) {
    const source = map.getSource('trip-route')
    if (!source) return
    const { route: r, focusKey: focus, activeKey: active, dimOthers: dim, pastKeys: past } = latest.current
    source.setData(routeData(r, { highlight: focus || active, dim, past }))
  }

  function fitDay(map, { animate }) {
    // La taille peut avoir changé depuis la dernière mesure de MapLibre (son
    // ResizeObserver est asynchrone) : un cadrage sur l'ancienne serait faux.
    map.resize()
    const { route: r, ideaPoints: extra, padding: pad } = latest.current
    const bounds = boundsOf(r, extra, map.__lib)
    if (!bounds) return
    const duration = animate && !prefersReducedMotion() ? 600 : 0
    map.fitBounds(bounds, { padding: pad, maxZoom: SINGLE_ZOOM, duration })
  }

  return (
    <div ref={wrapperRef} className={cn('relative overflow-hidden bg-[#F3F2EE]', className)}>
      {/* Sans WebGL, sans lieu, ou tant que la carte se charge : le dessin du
          parcours, instantané et lisible hors-ligne. */}
      {(!showMap || !ready) && size.width > 0 && (
        <MiniMap
          items={items}
          home={home}
          colorIndexByStay={colorIndexByStay}
          width={Math.round(size.width)}
          height={Math.round(size.height)}
          className="absolute inset-0"
        />
      )}
      {showMap && (
        <div
          aria-hidden={!interactive}
          className={cn('absolute inset-0 transition-opacity duration-300', ready ? 'opacity-100' : 'opacity-0')}
        >
          {/* Le conteneur appartient à MapLibre (il y pose ses classes, dont
              `position: relative`) : React n'y touche pas, et la position
              absolue est en style en ligne pour l'emporter. */}
          <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
      )}
      {onPress && !empty && <PressLayer onPress={onPress} label={pressLabel} />}
    </div>
  )
}

/**
 * Une « frise » d'un seul lieu, pour montrer où il est sur une petite carte
 * (fiche d'une réservation, lieu partagé) : un repère à sa catégorie.
 */
export function placeItems(place, category = 'other') {
  return [{ type: 'stop', key: 'place', time: null, number: 1, stop: { id: 'place', ...place, category } }]
}

/** Idem pour un hébergement : son repère carré, à sa couleur. */
export function stayPlaceItems(stay) {
  return [{ type: 'checkin', key: 'place', time: stay.checkIn?.time || null, stay }]
}

/**
 * Les lieux d'intérêt d'OpenFreeMap deviennent cliquables : un clic rend
 * `{ name, lat, lng, category }` (catégorie devinée d'après sa classe), un
 * clic ailleurs rend `null`. Le curseur le signale au survol.
 */
function listenToPlaces(map, handlers) {
  const layers = () => POI_LAYERS.filter((id) => map.getLayer(id))
  map.on('click', (e) => {
    const [feature] = map.queryRenderedFeatures(e.point, { layers: layers() })
    if (!feature) {
      handlers.current.onPlaceClick?.(null)
      return
    }
    const p = feature.properties || {}
    const name = p['name:fr'] || p['name:latin'] || p.name
    const [lng, lat] = feature.geometry.coordinates
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return
    handlers.current.onPlaceClick?.({ name, lat, lng, category: guessCategory({ osmKey: p.class, osmValue: p.subclass, name }) })
  })
  map.on('mousemove', (e) => {
    if (!handlers.current.onPlaceClick) return
    const hit = map.queryRenderedFeatures(e.point, { layers: layers() }).length > 0
    map.getCanvas().style.cursor = hit ? 'pointer' : ''
  })
}

/** Toute la carte figée devient un bouton (clavier compris). */
function PressLayer({ onPress, label }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="absolute inset-0 z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
    />
  )
}

/** Le cadre de la journée ; à défaut de journée, celui des lieux à caser. */
function boundsOf(route, ideaPoints, maplibregl) {
  const own = route.home ? [...route.points, route.home] : route.points
  const pts = own.length ? own : ideaPoints
  if (!pts.length || !maplibregl) return null
  const bounds = new maplibregl.LngLatBounds()
  for (const p of pts) bounds.extend([p.lng, p.lat])
  // Une route peut faire un détour hors du cadre de ses deux bouts.
  for (const seg of route.segments) seg.line?.forEach((c) => bounds.extend(c))
  return bounds
}

function describeIdea(idea) {
  return { keys: [`idea:${idea.id}`], name: idea.name, color: getCategory(idea.category).color }
}

function updateIdeaElement(anchor, desc, active) {
  const pin = anchor.firstChild
  pin.__keys = desc.keys
  pin.className = `trip-marker trip-marker--idea${active ? ' is-active' : ''}`
  // Le repère naît plein (createMarkerElement) : celui-ci est creux.
  pin.style.backgroundColor = ''
  pin.style.borderColor = desc.color
  pin.style.color = desc.color
  pin.setAttribute('aria-label', `${desc.name} · à caser`)
  if (pin.__content !== '+') {
    pin.__content = '+'
    pin.textContent = '+'
  }
  anchor.style.zIndex = active ? '3' : '0'
}

/** Chaque tronçon libre qui a un trajet calculé reçoit son tracé (`line`). */
function withLines(route, lines) {
  if (!lines.size) return route
  return {
    ...route,
    segments: route.segments.map((seg) => {
      if (seg.booked) return seg
      const line = lines.get(legKey(route.points[seg.from], route.points[seg.to]))
      return line ? { ...seg, line } : seg
    }),
  }
}

/**
 * Les tronçons du jour en GeoJSON : réservés (pointillés bleu nuit), calculés
 * (trait plein lagon, par la route) ou libres (points lagon, à vol d'oiseau).
 */
function routeData(route, { highlight = null, dim = false, past = null } = {}) {
  return {
    type: 'FeatureCollection',
    features: route.segments.map((seg) => {
      const a = route.points[seg.from]
      const b = route.points[seg.to]
      const active = !!highlight && b.itemKey === highlight
      return {
        type: 'Feature',
        properties: {
          booked: seg.booked,
          routed: !!seg.line,
          active,
          faded: (dim && !!highlight && !active) || (!!past && past.has(b.itemKey)),
        },
        geometry: { type: 'LineString', coordinates: seg.line || [[a.lng, a.lat], [b.lng, b.lat]] },
      }
    }),
  }
}

function addRouteLayers(map) {
  map.addSource('trip-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  // Un tracé à vol d'oiseau en pointillés : on n'affirme pas savoir par où
  // passer — c'est le travail de « Itinéraire » (Google Maps).
  map.addLayer({
    id: 'trip-route-free',
    type: 'line',
    source: 'trip-route',
    filter: ['all', ['!', ['get', 'booked']], ['!', ['get', 'routed']]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROUTE_COLOR,
      'line-width': ['case', ['get', 'active'], 5.5, 4.5],
      'line-dasharray': [0.1, 1.9],
      'line-opacity': ['case', ['get', 'faded'], 0.35, 1],
    },
  })
  // Un trajet calculé suit la route : trait plein, liseré blanc pour se
  // détacher des routes du fond.
  map.addLayer({
    id: 'trip-route-routed-casing',
    type: 'line',
    source: 'trip-route',
    filter: ['get', 'routed'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#FFFFFF',
      'line-width': ['case', ['get', 'active'], 8.5, 7],
      'line-opacity': ['case', ['get', 'faded'], 0.35, 0.9],
    },
  })
  map.addLayer({
    id: 'trip-route-routed',
    type: 'line',
    source: 'trip-route',
    filter: ['get', 'routed'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROUTE_COLOR,
      'line-width': ['case', ['get', 'active'], 5.5, 4],
      'line-opacity': ['case', ['get', 'faded'], 0.35, 1],
    },
  })
  map.addLayer({
    id: 'trip-route-booked',
    type: 'line',
    source: 'trip-route',
    filter: ['get', 'booked'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': TRANSPORT_COLOR.hex,
      'line-width': ['case', ['get', 'active'], 3.5, 2.5],
      'line-dasharray': [2, 1.6],
      'line-opacity': ['case', ['get', 'faded'], 0.35, 0.9],
    },
  })
}

/** La taille d'un élément, suivie (ResizeObserver). */
function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (Math.abs(s.width - width) < 1 && Math.abs(s.height - height) < 1 ? s : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

