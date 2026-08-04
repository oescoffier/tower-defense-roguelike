// ============================================================
//  Test headless (Node, sans DOM) : génère un grand nombre de cartes
//  (seeds) et vérifie que chacune reste jouable — spawn/base sur des
//  bords distincts, un chemin sol existe toujours, le chemin aérien est
//  valide, et la pose de tours ne casse jamais silencieusement le
//  chemin. Vérifie aussi que les 4 formes et plusieurs paires de bords
//  sont bien observées sur l'échantillon (pas de forme jamais tirée).
// ============================================================
import { Grid } from '../js/grid.js';
import { GRID } from '../js/config.js';

const N = 300;
let fails = 0;
const shapeCounts = {};
const edgePairs = new Set();
let minAirLength = Infinity, maxAirLength = -Infinity, sumAirLength = 0;
const MIN_AIR_LENGTH = 500; // px — distance de vol minimale garantie

for (let seed = 1; seed <= N; seed++) {
  let g;
  try {
    g = new Grid(seed);
  } catch (err) {
    fails++;
    console.log(`[ERREUR] seed ${seed} — génération : ${err.message}`);
    continue;
  }

  shapeCounts[g.shape] = (shapeCounts[g.shape] || 0) + 1;
  edgePairs.add(`${g.spawnEdge}->${g.baseEdge}`);

  if (g.spawnEdge === g.baseEdge) {
    fails++; console.log(`[FAIL] seed ${seed}: spawn et base sur le même bord`);
  }
  if (!g.inBounds(g.spawn.x, g.spawn.y) || !g.inBounds(g.base.x, g.base.y)) {
    fails++; console.log(`[FAIL] seed ${seed}: spawn/base hors grille`);
  }
  if (g.spawn.x === g.base.x && g.spawn.y === g.base.y) {
    fails++; console.log(`[FAIL] seed ${seed}: spawn === base`);
  }
  if (g.dist[g.idx(g.spawn.x, g.spawn.y)] === -1) {
    fails++; console.log(`[FAIL] seed ${seed}: aucun chemin spawn→base (forme "${g.shape}")`);
  }
  if (!(g.airLength > 0) || !Number.isFinite(g.airLength)) {
    fails++; console.log(`[FAIL] seed ${seed}: airLength invalide (${g.airLength})`);
  } else {
    const p0 = g.airAt(0), pEnd = g.airAt(g.airLength);
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

console.log(`Formes observées sur ${N} seeds :`, shapeCounts);
console.log(`Paires de bords spawn→base observées : ${edgePairs.size} / 12 possibles`);
console.log(`Longueur du chemin aérien — min ${Math.round(minAirLength)}px, max ${Math.round(maxAirLength)}px, moyenne ${Math.round(sumAirLength / N)}px`);
if (Object.keys(shapeCounts).length < 4) {
  fails++;
  console.log(`[FAIL] Seulement ${Object.keys(shapeCounts).length}/4 formes observées sur ${N} seeds — une forme ne sort peut-être jamais.`);
}

console.log(fails === 0 ? `\nTOUT EST VERT — ${N} cartes générées, toutes valides.` : `\n${fails} PROBLÈME(S) sur ${N} cartes.`);
process.exit(fails === 0 ? 0 : 1);
