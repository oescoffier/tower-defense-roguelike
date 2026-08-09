// ============================================================
//  Test headless (Node, sans DOM) : buildWave(wave, groundLanes, airLanes)
//  — le nombre annoncé pour une vague (waveCount(wave)) est un budget PAR
//  VOIE, pas un total à répartir. Un seul motif temporisé est généré pour
//  le sol et un pour l'air, puis chacun est rejoué en entier sur CHAQUE
//  voie (grid.spawns[] / grid.airLanes[], toutes deux sans plafond — voir
//  mapgrowth.test.mjs). Le total réel d'une vague grandit donc avec le
//  nombre de voies ouvertes ; les boss, eux, restent uniques (jamais
//  répliqués par voie).
// ============================================================
import { buildWave, waveSummary } from '../js/waves.js';
import { waveCount, WAVE } from '../js/config.js';

let fails = 0;
const check = (cond, msg) => {
  if (!cond) { fails++; console.log(`[FAIL] ${msg}`); }
  else console.log(`[PASS] ${msg}`);
};

// Vague 7 : ni bossGroundEvery (10) ni bossAirEvery (15), et assez avancée
// pour avoir un pool aérien non vide (airRampStart=2).
const WAVE_NO_BOSS = 7;

console.log('\n=== UNE SEULE VOIE (sol+air) : comportement historique, perLane === total ===\n');
{
  const wd = buildWave(WAVE_NO_BOSS, 1, 1);
  const groundCount = wd.spawns.filter((s) => !s.air).length;
  const airCount = wd.spawns.filter((s) => s.air).length;
  check(wd.groundLanes === 1 && wd.airLanes === 1, `groundLanes=${wd.groundLanes}, airLanes=${wd.airLanes}, attendu 1 et 1`);
  check(wd.perLane === waveCount(WAVE_NO_BOSS), `perLane=${wd.perLane} correspond bien à waveCount(${WAVE_NO_BOSS})=${waveCount(WAVE_NO_BOSS)}`);
  check(groundCount > 0, `au moins un ennemi au sol généré (${groundCount})`);
  console.log(`[INFO] à 1 voie sol / 1 voie air : ${groundCount} ennemis au sol, ${airCount} aériens`);
}

console.log('\n=== PLUSIEURS VOIES AU SOL : le total au sol est multiplié en conséquence ===\n');
{
  const wd1 = buildWave(WAVE_NO_BOSS, 1, 1);
  const wd3 = buildWave(WAVE_NO_BOSS, 3, 1);
  const g1 = wd1.spawns.filter((s) => !s.air).length;
  const g3 = wd3.spawns.filter((s) => !s.air).length;
  check(g3 === g1 * 3, `3 voies au sol → ${g3} ennemis au sol, attendu exactement ${g1} × 3 = ${g1 * 3} (motif identique rejoué sur chaque voie)`);

  const a1 = wd1.spawns.filter((s) => s.air).length;
  const a3 = wd3.spawns.filter((s) => s.air).length;
  check(a3 === a1, `le nombre de voies au SOL ne change rien au nombre d'ennemis AÉRIENS (${a1} vs ${a3})`);
}

console.log('\n=== PLUSIEURS VOIES AÉRIENNES : le total aérien est multiplié en conséquence ===\n');
{
  const wd1 = buildWave(WAVE_NO_BOSS, 1, 1);
  const wd4 = buildWave(WAVE_NO_BOSS, 1, 4);
  const a1 = wd1.spawns.filter((s) => s.air).length;
  const a4 = wd4.spawns.filter((s) => s.air).length;
  check(a4 === a1 * 4, `4 voies aériennes → ${a4} ennemis aériens, attendu exactement ${a1} × 4 = ${a1 * 4}`);

  const g1 = wd1.spawns.filter((s) => !s.air).length;
  const g4 = wd4.spawns.filter((s) => !s.air).length;
  check(g4 === g1, `le nombre de voies AÉRIENNES ne change rien au nombre d'ennemis au SOL (${g1} vs ${g4})`);
}

console.log('\n=== CHAQUE SPAWN PORTE UN INDEX DE VOIE VALIDE ===\n');
{
  const wd = buildWave(WAVE_NO_BOSS, 3, 2);
  let bad = 0;
  for (const s of wd.spawns) {
    if (s.air) { if (!(s.lane >= 0 && s.lane < 2)) bad++; }
    else { if (!(s.lane >= 0 && s.lane < 3)) bad++; }
  }
  check(bad === 0, `tous les spawns ont un index de voie dans les bornes de leur domaine (0 hors bornes sur ${wd.spawns.length})`);
}

console.log('\n=== LES BOSS NE SONT JAMAIS RÉPLIQUÉS PAR VOIE ===\n');
{
  const bossWave = WAVE.bossGroundEvery; // multiple garanti de bossGroundEvery
  const wd1 = buildWave(bossWave, 1, 1);
  const wd5 = buildWave(bossWave, 5, 5);
  const bossCount = (wd) => wd.spawns.filter((s) => s.boss).length;
  check(wd1.hasBoss, `la vague ${bossWave} est bien signalée comme vague boss`);
  check(bossCount(wd1) === bossCount(wd5), `nombre de boss identique à 1 voie (${bossCount(wd1)}) et à 5 voies (${bossCount(wd5)}) — jamais multiplié`);
  check(bossCount(wd5) >= 1, `au moins un boss généré (${bossCount(wd5)})`);
}

console.log('\n=== waveSummary() reflète le total réel (déjà multiplié par voie) ===\n');
{
  const wd = buildWave(WAVE_NO_BOSS, 4, 1);
  const sum = waveSummary(wd);
  const totalFromSummary = sum.reduce((a, s) => a + s.n, 0);
  check(totalFromSummary === wd.spawns.length, `waveSummary() totalise ${totalFromSummary}, attendu ${wd.spawns.length} (== spawns.length, le vrai total)`);
}

console.log(`\n${fails === 0 ? 'TOUT EST VERT.' : `${fails} PROBLÈME(S) DÉTECTÉ(S).`}\n`);
process.exit(fails === 0 ? 0 : 1);
