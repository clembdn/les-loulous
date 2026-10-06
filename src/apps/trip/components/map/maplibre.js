// Point d'entrée paresseux de MapLibre : la bibliothèque (~270 Ko gzip) et ses
// styles ne sont téléchargés qu'à l'affichage d'une première carte, jamais au
// démarrage de l'app (cf. loadMaplibre.js).
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './tripMap.css'

export default maplibregl
