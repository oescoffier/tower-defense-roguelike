// ============================================================
//  CAMERA — maths pures (aucune dépendance DOM) pour le cadrage de la
//  scène de jeu. Le CADRE (zone visible à l'écran) ne change jamais de
//  taille : à zoom 1 (par défaut), toute la carte y tient, exactement
//  comme avant — c'est le contenu qui rétrécit quand la carte grandit
//  (Grid.grow). Le joueur peut ensuite zoomer AU-DESSUS de ce niveau de
//  base pour regarder une zone de plus près, et se déplacer dedans ;
//  impossible de dézoomer plus loin que la vue d'ensemble.
// ============================================================

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** État caméra par défaut : centré sur la carte, zoom de base. */
export function createCamera(gridW, gridH) {
  return { x: gridW / 2, y: gridH / 2, zoom: MIN_ZOOM };
}

/** Échelle qui fait tenir toute la carte (gridW×gridH) dans le cadre disponible. */
export function baseFit(availW, availH, gridW, gridH, margin = 6) {
  if (availW <= 0 || availH <= 0) return 1;
  return Math.min(1, availW / (gridW + margin), availH / (gridH + margin));
}

function clampAxis(center, mapSize, visibleSize) {
  if (visibleSize >= mapSize) return mapSize / 2;
  const half = visibleSize / 2;
  return Math.min(mapSize - half, Math.max(half, center));
}

/** Ramène camera.x/y dans les bornes valides pour l'échelle totale donnée (jamais de vide hors carte). */
export function clampCamera(camera, gridW, gridH, availW, availH, totalK) {
  camera.x = clampAxis(camera.x, gridW, availW / totalK);
  camera.y = clampAxis(camera.y, gridH, availH / totalK);
  return camera;
}

/**
 * Calcule le scale + translate (en unités MONDE, à appliquer via
 * `transform: scale(k) translate(txpx, typx)`) pour cadrer la caméra dans
 * le cadre disponible. Clampe aussi zoom et position en place.
 */
export function computeStageTransform({ availW, availH, gridW, gridH, camera, margin = 6 }) {
  const baseK = baseFit(availW, availH, gridW, gridH, margin);
  camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom));
  const k = baseK * camera.zoom;
  clampCamera(camera, gridW, gridH, availW, availH, k);
  return { k, baseK, tx: gridW / 2 - camera.x, ty: gridH / 2 - camera.y };
}

/**
 * Zoom centré sur un point du monde (le point sous le curseur reste sous
 * le curseur après le changement de zoom). `newZoom` est clampé à
 * [MIN_ZOOM, MAX_ZOOM].
 */
export function zoomAt(camera, worldX, worldY, newZoom) {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
  const t = 1 - camera.zoom / clamped;
  camera.x += (worldX - camera.x) * t;
  camera.y += (worldY - camera.y) * t;
  camera.zoom = clamped;
  return camera;
}

/** Convertit un glissement écran (px) en déplacement caméra (unités monde) pour le panoramique. */
export function panBy(camera, dxScreenPx, dyScreenPx, totalK) {
  camera.x -= dxScreenPx / totalK;
  camera.y -= dyScreenPx / totalK;
  return camera;
}

/** À appeler quand Grid.grow() décale tout le contenu d'une case : la caméra suit. */
export function shiftCamera(camera, dx, dy) {
  camera.x += dx;
  camera.y += dy;
  return camera;
}
