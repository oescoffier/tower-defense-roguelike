// ============================================================
//  Test headless (Node, sans DOM) : vérifie les maths pures de js/camera.js
//  — le cadre (zone visible) ne bouge jamais, seul le contenu est mis à
//  l'échelle/déplacé. À zoom 1 (par défaut), le comportement doit être
//  identique à l'ancien fitStage() (toute la carte visible, centrée,
//  aucun panoramique possible). Zoomer permet de resserrer la vue et de
//  se déplacer dedans, toujours borné aux limites de la carte.
// ============================================================
import {
  MIN_ZOOM, MAX_ZOOM, createCamera, baseFit,
  computeStageTransform, zoomAt, panBy, shiftCamera
} from '../js/camera.js';

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ============================================================
console.log('\n=== baseFit : ne dépasse jamais 1, prend le plus petit ratio ===\n');
{
  const k1 = baseFit(2000, 2000, 1000, 600); // cadre bien plus grand que la carte
  if (k1 !== 1) fail(`baseFit ne devrait jamais dépasser 1 (obtenu ${k1})`);

  const k2 = baseFit(500, 500, 1000, 600); // cadre plus petit que la carte
  const expected = Math.min(500 / 1006, 500 / 606);
  if (!near(k2, expected)) fail(`baseFit = ${k2}, attendu ${expected}`);

  if (k1 === 1 && near(k2, expected)) console.log(`[PASS] baseFit(2000,2000,1000,600)=${k1}, baseFit(500,500,1000,600)=${k2.toFixed(4)}`);
}

// ============================================================
console.log('\n=== Zoom 1 : comportement identique à l\'ancien fitStage (pas de panoramique) ===\n');
{
  const gridW = 1000, gridH = 600;
  const camera = createCamera(gridW, gridH);
  if (camera.zoom !== MIN_ZOOM) fail(`zoom initial = ${camera.zoom}, attendu ${MIN_ZOOM}`);
  if (camera.x !== gridW / 2 || camera.y !== gridH / 2) fail('caméra initiale pas centrée sur la carte');

  // Cadre plus petit que la carte (cas normal en jeu) : à zoom 1, tx/ty doivent être nuls.
  const { k, baseK, tx, ty } = computeStageTransform({ availW: 500, availH: 400, gridW, gridH, camera });
  if (!near(k, baseK)) fail('k devrait valoir baseK exactement à zoom 1');
  if (!near(tx, 0) || !near(ty, 0)) fail(`tx/ty devraient être (0,0) à zoom 1, obtenu (${tx},${ty})`);
  else console.log(`[PASS] zoom=1 → k=baseK=${k.toFixed(4)}, tx=ty=0 (identique à l'ancien comportement)`);
}

// ============================================================
console.log('\n=== Le zoom ne descend jamais sous MIN_ZOOM (jamais plus petit que la vue d\'ensemble) ===\n');
{
  const camera = createCamera(1000, 600);
  camera.zoom = 0.3; // tentative de dézoomer sous le cadrage de base
  const { k, baseK } = computeStageTransform({ availW: 500, availH: 400, gridW: 1000, gridH: 600, camera });
  if (camera.zoom !== MIN_ZOOM) fail(`zoom clampé à ${camera.zoom}, attendu ${MIN_ZOOM}`);
  if (!near(k, baseK)) fail('k devrait retomber à baseK une fois le zoom clampé');
  else console.log(`[PASS] zoom=0.3 → clampé à ${camera.zoom}`);

  camera.zoom = 99;
  computeStageTransform({ availW: 500, availH: 400, gridW: 1000, gridH: 600, camera });
  if (camera.zoom !== MAX_ZOOM) fail(`zoom clampé à ${camera.zoom}, attendu ${MAX_ZOOM}`);
  else console.log(`[PASS] zoom=99 → clampé à ${MAX_ZOOM}`);
}

// ============================================================
console.log('\n=== La caméra ne montre jamais au-delà des bords de la carte ===\n');
{
  const gridW = 1000, gridH = 600;
  const camera = createCamera(gridW, gridH);
  camera.zoom = 2;
  camera.x = -500; camera.y = -500; // tentative de sortir complètement de la carte
  const { k } = computeStageTransform({ availW: 500, availH: 400, gridW, gridH, camera });
  const visW = 500 / k, visH = 400 / k;
  const problems = [];
  if (camera.x - visW / 2 < -0.01) problems.push('déborde à gauche');
  if (camera.x + visW / 2 > gridW + 0.01) problems.push('déborde à droite');
  if (camera.y - visH / 2 < -0.01) problems.push('déborde en haut');
  if (camera.y + visH / 2 > gridH + 0.01) problems.push('déborde en bas');
  if (problems.length) fail(`caméra hors carte : ${problems.join(', ')} (x=${camera.x}, y=${camera.y})`);
  else console.log(`[PASS] caméra ramenée dans les bornes : x=${camera.x.toFixed(1)}, y=${camera.y.toFixed(1)}`);
}

// ============================================================
console.log('\n=== zoomAt : le point du monde sous le curseur reste sous le curseur ===\n');
{
  const gridW = 2000, gridH = 1200;
  const camera = createCamera(gridW, gridH);
  const availW = 500, availH = 400;
  let { k: kBefore } = computeStageTransform({ availW, availH, gridW, gridH, camera });

  const worldX = 300, worldY = 800; // un point quelconque sous le curseur
  const screenOffsetBefore = { x: (worldX - camera.x) * kBefore, y: (worldY - camera.y) * kBefore };

  zoomAt(camera, worldX, worldY, 2.5);
  const { k: kAfter } = computeStageTransform({ availW, availH, gridW, gridH, camera });
  const screenOffsetAfter = { x: (worldX - camera.x) * kAfter, y: (worldY - camera.y) * kAfter };

  if (!near(screenOffsetBefore.x, screenOffsetAfter.x, 0.5) || !near(screenOffsetBefore.y, screenOffsetAfter.y, 0.5)) {
    fail(`le point sous le curseur a bougé à l'écran : avant (${screenOffsetBefore.x.toFixed(1)},${screenOffsetBefore.y.toFixed(1)}), après (${screenOffsetAfter.x.toFixed(1)},${screenOffsetAfter.y.toFixed(1)})`);
  } else {
    console.log(`[PASS] offset écran avant/après zoom : (${screenOffsetBefore.x.toFixed(1)},${screenOffsetBefore.y.toFixed(1)}) → (${screenOffsetAfter.x.toFixed(1)},${screenOffsetAfter.y.toFixed(1)}), stable`);
  }
}

// ============================================================
console.log('\n=== panBy : convertit un glissement écran en déplacement caméra ===\n');
{
  const camera = createCamera(1000, 600);
  const k = 2; // échelle totale courante
  panBy(camera, 100, -40, k); // glisse la souris de (100,-40) px écran
  // Glisser vers la droite doit reculer la caméra vers la gauche (monde), et inversement.
  if (!near(camera.x, 500 - 50) || !near(camera.y, 300 + 20)) {
    fail(`panBy a produit (${camera.x},${camera.y}), attendu (450,320)`);
  } else {
    console.log(`[PASS] glissement (100,-40)px à k=2 → caméra déplacée de (-50,+20) unités monde`);
  }
}

// ============================================================
console.log('\n=== shiftCamera : suit le contenu quand Grid.grow() décale tout de +1 case ===\n');
{
  const oldGridW = 1000, oldGridH = 600, cell = 44;
  const camera = createCamera(oldGridW, oldGridH); // centrée sur l'ancienne carte
  shiftCamera(camera, cell, cell);
  const newGridW = oldGridW + cell * 2, newGridH = oldGridH + cell * 2;
  if (!near(camera.x, newGridW / 2) || !near(camera.y, newGridH / 2)) {
    fail(`après le décalage, la caméra (${camera.x},${camera.y}) ne pointe plus le centre de la nouvelle carte (${newGridW / 2},${newGridH / 2})`);
  } else {
    console.log('[PASS] une caméra centrée avant extension reste centrée sur la nouvelle carte après extension');
  }
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
