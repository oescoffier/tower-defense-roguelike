// ============================================================
//  Test headless (Node, sans DOM) : vérifie l'anti-stunlock — un
//  ennemi étourdi en continu pendant 5 secondes d'affilée doit voir son
//  étourdissement coupé et devenir immunisé 1 seconde, y compris si des
//  tours retentent de l'étourdir pendant cette fenêtre. Vérifie aussi
//  qu'une interruption du stun remet le compteur à zéro (ce n'est pas du
//  cumulatif sur toute la partie, seulement "d'affilée"), et que toutes
//  les sources de stun du moteur (explode(), pulsation SÉISME) passent
//  bien par ce point de passage unique.
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { Grid } from '../js/grid.js';
import { Enemy } from '../js/enemies.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DT = 1 / 30;
const grid = new Grid(1);

let fails = 0;
const fail = (msg) => { fails++; console.log(`[FAIL] ${msg}`); };
const pass = (msg) => console.log(`[PASS] ${msg}`);

function makeGame() {
  return { time: 0, vfx: { ring() {} } };
}

console.log('\n=== ANTI-STUNLOCK ===\n');

// ---- 1. Un stun réappliqué en continu doit finir par se couper tout seul ----
{
  const game = makeGame();
  const e = new Enemy('grunt', grid, {});
  let cutTime = null;

  for (let t = 0; t < 5.5; t += DT) {
    game.time = t;
    e.applyStun(DT * 2, game); // réappliqué chaque tick : ne s'éteindrait jamais naturellement
    if (cutTime === null && e.stunImmuneUntil > 0) cutTime = t;
    e.update(DT, game);
  }

  if (cutTime === null) fail("un stun réappliqué en continu pendant 5.5s n'a jamais déclenché l'anti-stunlock");
  else if (cutTime < 4.9 || cutTime > 5.2) fail(`l'anti-stunlock s'est déclenché à t=${cutTime.toFixed(2)}s, attendu ~5s`);
  else pass(`stun continu coupé après ~5s (à t=${cutTime.toFixed(2)}s)`);
}

// ---- 2. Pendant la seconde d'immunité, l'ennemi n'est plus étourdi, même
//         si on retente de le stun ----
{
  const game = makeGame();
  const e = new Enemy('grunt', grid, {});

  for (let t = 0; t < 5.3 && e.stunImmuneUntil === 0; t += DT) {
    game.time = t;
    e.applyStun(DT * 2, game);
    e.update(DT, game);
  }
  if (e.stunImmuneUntil === 0) {
    fail('test 2 : anti-stunlock jamais déclenché, impossible de tester la fenêtre d\'immunité');
  } else {
    // Se place au milieu de la fenêtre d'immunité réelle, quel que soit
    // l'instant exact où elle a démarré.
    game.time = e.stunImmuneUntil - 0.5;
    e.applyStun(2, game); // une tour retente un gros stun : doit être ignoré
    e.update(DT, game);

    if (game.time < e.stunUntil) fail("l'ennemi est toujours étourdi pendant sa fenêtre d'immunité — le nouveau stun n'a pas été ignoré");
    else pass('un nouveau stun est bien ignoré pendant la fenêtre d\'immunité');
  }
}

// ---- 3. Une fois l'immunité expirée, le stun refonctionne normalement ----
{
  const game = makeGame();
  const e = new Enemy('grunt', grid, {});

  for (let t = 0; t < 5.3 && e.stunImmuneUntil === 0; t += DT) {
    game.time = t;
    e.applyStun(DT * 2, game);
    e.update(DT, game);
  }
  if (e.stunImmuneUntil === 0) {
    fail('test 3 : anti-stunlock jamais déclenché, impossible de tester l\'expiration de l\'immunité');
  } else {
    game.time = e.stunImmuneUntil + 0.3; // clairement après la fin de la fenêtre
    e.applyStun(1, game);

    if (!(game.time < e.stunUntil)) fail("le stun ne refonctionne pas après l'expiration de l'immunité");
    else pass('le stun refonctionne normalement une fois l\'immunité expirée');
  }
}

// ---- 4. Une interruption du stun remet le compteur à zéro : ce n'est pas
//         un cumul sur toute la partie, seulement du stun D'AFFILÉE ----
{
  const game = makeGame();
  const e = new Enemy('grunt', grid, {});

  // 4 secondes de stun continu (sous le seuil de 5s)...
  for (let t = 0; t < 4; t += DT) {
    game.time = t;
    e.applyStun(DT * 2, game);
    e.update(DT, game);
  }
  // ...une pause sans stun...
  for (let t = 4; t < 4.5; t += DT) {
    game.time = t;
    e.update(DT, game); // pas de applyStun ici : stunUntil expire, la pause casse la série
  }
  // ...puis encore 4 secondes de stun continu : 4+4=8s de stun au total,
  // mais jamais plus de 4s D'AFFILÉE, donc l'anti-stunlock ne doit PAS se déclencher.
  let cutTime = null;
  for (let t = 4.5; t < 8.5; t += DT) {
    game.time = t;
    e.applyStun(DT * 2, game);
    if (cutTime === null && e.stunImmuneUntil > 0) cutTime = t;
    e.update(DT, game);
  }

  if (cutTime !== null) fail(`l'anti-stunlock s'est déclenché malgré la pause (à t=${cutTime.toFixed(2)}s) — le compteur n'a pas été remis à zéro`);
  else pass('une pause dans le stun remet bien le compteur "d\'affilée" à zéro (8s de stun cumulé, jamais déclenché)');
}

// ---- 5. Toutes les sources de stun du moteur passent par applyStun() ----
console.log('\n=== SOURCES DE STUN CENTRALISÉES ===\n');
{
  const files = ['combat.js', 'main.js'].map((f) => readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'));
  const combined = files.join('\n');
  const directWrites = combined.match(/\w+\.stunUntil\s*=/g) || [];
  if (directWrites.length) {
    fail(`écriture directe de stunUntil trouvée hors d'Enemy (contourne l'anti-stunlock) : ${directWrites.join(', ')}`);
  } else {
    pass('combat.js et main.js passent tous par e.applyStun() — aucune écriture directe de stunUntil');
  }
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
