// ============================================================
//  Test headless (Node, sans DOM) : la table de hachage spatiale
//  (js/spatial.js), qui accélère enemiesInRange/segmentHit/rayHits avec
//  beaucoup de tours et d'ennemis (voir game.enemyHash dans main.js).
//  Propriété critique : ne JAMAIS oublier un vrai positif (mieux vaut
//  renvoyer trop de candidats que pas assez) — un filtre grossier, pas
//  le test exact.
// ============================================================
import { SpatialHash } from '../js/spatial.js';
import { enemiesInRange } from '../js/combat.js';
import { TARGET } from '../js/config.js';

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };

function rand(a, b) { return a + Math.random() * (b - a); }

console.log('\n=== queryCircle : aucun faux négatif (comparé à un scan brutal) ===\n');
{
  const hash = new SpatialHash(88);
  const pts = [];
  for (let i = 0; i < 500; i++) {
    const p = { x: rand(-2000, 2000), y: rand(-2000, 2000), dead: false };
    pts.push(p);
  }
  hash.build(pts);

  let checked = 0, missed = 0;
  for (let t = 0; t < 200; t++) {
    const qx = rand(-2000, 2000), qy = rand(-2000, 2000), r = rand(10, 300);
    const found = new Set(hash.queryCircle(qx, qy, r));
    for (const p of pts) {
      const d = Math.hypot(p.x - qx, p.y - qy);
      checked++;
      if (d <= r && !found.has(p)) missed++;
    }
  }
  if (missed > 0) fail(`queryCircle a raté ${missed}/${checked} points pourtant dans le cercle interrogé`);
  else console.log(`[PASS] queryCircle : ${checked} points vérifiés sur 200 requêtes, aucun faux négatif`);
}

console.log('\n=== querySegment : aucun faux négatif ===\n');
{
  const hash = new SpatialHash(88);
  const pts = [];
  for (let i = 0; i < 500; i++) pts.push({ x: rand(-2000, 2000), y: rand(-2000, 2000), dead: false });
  hash.build(pts);

  const distToSegment = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  };

  let checked = 0, missed = 0;
  for (let t = 0; t < 200; t++) {
    const x1 = rand(-2000, 2000), y1 = rand(-2000, 2000);
    const x2 = x1 + rand(-200, 200), y2 = y1 + rand(-200, 200);
    const pad = 30;
    const found = new Set(hash.querySegment(x1, y1, x2, y2, pad));
    for (const p of pts) {
      checked++;
      if (distToSegment(p.x, p.y, x1, y1, x2, y2) <= pad && !found.has(p)) missed++;
    }
  }
  if (missed > 0) fail(`querySegment a raté ${missed}/${checked} points pourtant à portée du segment`);
  else console.log(`[PASS] querySegment : ${checked} points vérifiés sur 200 requêtes, aucun faux négatif`);
}

console.log('\n=== enemiesInRange : résultat identique avec ou sans enemyHash ===\n');
{
  const enemies = [];
  for (let i = 0; i < 300; i++) {
    enemies.push({
      id: i, x: rand(-1500, 1500), y: rand(-1500, 1500), dead: Math.random() < 0.05,
      air: Math.random() < 0.3
    });
  }
  const hash = new SpatialHash(88);
  hash.build(enemies);

  let mismatches = 0;
  for (let t = 0; t < 100; t++) {
    const qx = rand(-1500, 1500), qy = rand(-1500, 1500), r = rand(20, 400);
    const mask = [TARGET.GROUND, TARGET.AIR, TARGET.BOTH][t % 3];

    const withHash = enemiesInRange({ enemies, enemyHash: hash }, qx, qy, r, mask);
    const withoutHash = enemiesInRange({ enemies, enemyHash: null }, qx, qy, r, mask);

    const a = new Set(withHash), b = new Set(withoutHash);
    if (a.size !== b.size || withHash.some((e) => !b.has(e))) mismatches++;
  }
  if (mismatches > 0) fail(`${mismatches}/100 requêtes divergent entre avec et sans enemyHash`);
  else console.log('[PASS] enemiesInRange renvoie exactement le même ensemble avec ou sans enemyHash (100 requêtes)');
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
