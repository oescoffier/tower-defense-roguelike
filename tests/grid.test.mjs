// ============================================================
//  Test headless (Node, sans DOM) : génère un grand nombre de cartes
//  (seeds) et vérifie que chacune reste jouable —
//  - le spawn et la base sont toujours à l'opposé l'un de l'autre
//    (bords opposés) pour les terrestres ;
//  - un chemin sol existe toujours, y compris à l'intérieur d'une
//    silhouette (rond / carré / étoile / bandes) qui ampute la grille ;
//  - le chemin aérien reste toujours assez long ;
//  - la pose de tours ne casse jamais silencieusement le chemin ;
//  - les silhouettes et motifs d'obstacles sont bien tous observés sur
//    l'échantillon (aucun n'est jamais tiré).
// ============================================================
import { Grid } from '../js/grid.js';
import { GRID, CELL } from '../js/config.js';

const N = 400;
let fails = 0;
const terrainCounts = {};
const shapeCounts = {};
let minAirLength = Infinity, maxAirLength = -Infinity, sumAirLength = 0;
let minGroundDist = Infinity, sumGroundDist = 0;
let minOppositeAngle = 180;
const MIN_AIR_LENGTH = 500; // px — distance de vol minimale garantie
const MIN_OPPOSITE_ANGLE = 130; // degrés — spawn/base doivent rester "en face" l'un de l'autre

for (let seed = 1; seed <= N; seed++) {
  let g;
  try {
    g = new Grid(seed);
  } catch (err) {
    fails++;
    console.log(`[ERREUR] seed ${seed} — génération : ${err.message}`);
    continue;
  }

  terrainCounts[g.terrain] = (terrainCounts[g.terrain] || 0) + 1;
  shapeCounts[g.shape] = (shapeCounts[g.shape] || 0) + 1;

  // Le spawn et la base doivent rester à l'opposé l'un de l'autre à travers
  // le centre de la carte (obligatoire pour le sol) : on vérifie l'angle
  // réel plutôt que le bord approximatif, qui peut être trompeur sur une
  // silhouette non convexe (étoile) sans que le placement soit faux pour autant.
  {
    const cx = (GRID.cols - 1) / 2, cy = (GRID.rows - 1) / 2;
    const v1 = { x: g.spawn.x - cx, y: g.spawn.y - cy };
    const v2 = { x: g.base.x - cx, y: g.base.y - cy };
    const len1 = Math.hypot(v1.x, v1.y) || 1e-6, len2 = Math.hypot(v2.x, v2.y) || 1e-6;
    const cosA = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (len1 * len2)));
    const angleDeg = Math.acos(cosA) * 180 / Math.PI;
    minOppositeAngle = Math.min(minOppositeAngle, angleDeg);
    if (angleDeg < MIN_OPPOSITE_ANGLE) {
      fails++; console.log(`[FAIL] seed ${seed}: spawn/base pas assez à l'opposé (angle ${angleDeg.toFixed(0)}°, forme "${g.shape}")`);
    }
  }
  if (!g.inBounds(g.spawn.x, g.spawn.y) || !g.inBounds(g.base.x, g.base.y)) {
    fails++; console.log(`[FAIL] seed ${seed}: spawn/base hors grille`);
  }
  if (g.spawn.x === g.base.x && g.spawn.y === g.base.y) {
    fails++; console.log(`[FAIL] seed ${seed}: spawn === base`);
  }
  if (g.cells[g.idx(g.spawn.x, g.spawn.y)] === CELL.ROCK || g.cells[g.idx(g.base.x, g.base.y)] === CELL.ROCK) {
    fails++; console.log(`[FAIL] seed ${seed}: spawn/base tombe sur de la roche`);
  }
  if (g.dist[g.idx(g.spawn.x, g.spawn.y)] === -1) {
    fails++; console.log(`[FAIL] seed ${seed}: aucun chemin spawn→base (forme "${g.shape}", motif "${g.terrain}")`);
  } else {
    const d = g.dist[g.idx(g.spawn.x, g.spawn.y)];
    minGroundDist = Math.min(minGroundDist, d);
    sumGroundDist += d;
  }

  if (!(g.airLength > 0) || !Number.isFinite(g.airLength)) {
    fails++; console.log(`[FAIL] seed ${seed}: airLength invalide (${g.airLength})`);
  } else {
    const p0 = g.airAt(0, 0), pEnd = g.airAt(0, g.airLength);
    if (![p0.x, p0.y, pEnd.x, pEnd.y].every(Number.isFinite)) {
      fails++; console.log(`[FAIL] seed ${seed}: points du chemin aérien non finis`);
    }
    if (g.airLength < MIN_AIR_LENGTH) {
      fails++; console.log(`[FAIL] seed ${seed}: chemin aérien trop court (${Math.round(g.airLength)}px < ${MIN_AIR_LENGTH}px)`);
    }
    minAirLength = Math.min(minAirLength, g.airLength);
    maxAirLength = Math.max(maxAirLength, g.airLength);
    sumAirLength += g.airLength;
  }

  // Pose de tours aléatoires : ne doit jamais planter, et si canPlace()
  // l'autorise, le chemin doit rester valide après la pose.
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(Math.random() * GRID.cols), y = Math.floor(Math.random() * GRID.rows);
    let res;
    try {
      res = g.canPlace(x, y, []);
    } catch (err) {
      fails++; console.log(`[ERREUR] seed ${seed} canPlace(${x},${y}) — ${err.message}`);
      continue;
    }
    if (res.ok) {
      g.place(x, y, { fake: true });
      if (g.dist[g.idx(g.spawn.x, g.spawn.y)] === -1) {
        fails++; console.log(`[FAIL] seed ${seed}: pose en (${x},${y}) a coupé le chemin alors que canPlace l'autorisait`);
      }
      g.remove(x, y);
    }
  }
}

console.log(`Silhouettes observées sur ${N} seeds :`, shapeCounts);
console.log(`Motifs d'obstacles observés sur ${N} seeds :`, terrainCounts);
console.log(`Longueur du chemin aérien — min ${Math.round(minAirLength)}px, max ${Math.round(maxAirLength)}px, moyenne ${Math.round(sumAirLength / N)}px`);
console.log(`Distance sol spawn→base — min ${minGroundDist} cases, moyenne ${(sumGroundDist / N).toFixed(1)} cases`);
console.log(`Angle spawn/base autour du centre — pire cas ${minOppositeAngle.toFixed(0)}° (180° = parfaitement opposés)`);

if (Object.keys(shapeCounts).length < 6) {
  fails++;
  console.log(`[FAIL] Seulement ${Object.keys(shapeCounts).length}/6 silhouettes observées sur ${N} seeds.`);
}
if (Object.keys(terrainCounts).length < 4) {
  fails++;
  console.log(`[FAIL] Seulement ${Object.keys(terrainCounts).length}/4 motifs d'obstacles observés sur ${N} seeds.`);
}

console.log(fails === 0 ? `\nTOUT EST VERT — ${N} cartes générées, toutes valides.` : `\n${fails} PROBLÈME(S) sur ${N} cartes.`);
process.exit(fails === 0 ? 0 : 1);
