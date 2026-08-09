// ============================================================
//  WAVES — génération procédurale de vagues infinies
// ============================================================

import { ENEMIES, WAVE, waveHpMult, waveCount, waveAirRatio } from './config.js';
import { Rng } from './rng.js';

const GROUND_POOL = ['grunt', 'runner', 'brute', 'swarm', 'healer', 'shielder', 'splitter', 'colossus', 'monolith', 'ram', 'phalanx'];
const AIR_POOL = ['drone', 'wasp', 'bomber', 'hornet', 'meteor'];

/** Poids d'apparition d'un type à une vague donnée. */
function weightFor(id, wave) {
  const def = ENEMIES[id];
  if (wave < def.unlock) return 0;
  const age = wave - def.unlock;
  switch (id) {
    case 'grunt': return Math.max(6, 40 - wave * 0.8);
    case 'runner': return Math.min(26, 8 + age * 1.1);
    case 'brute': return Math.min(24, 6 + age * 1.0);
    case 'swarm': return Math.min(22, 7 + age * 0.8);
    case 'healer': return Math.min(12, 3 + age * 0.5);
    case 'shielder': return Math.min(20, 5 + age * 0.9);
    case 'splitter': return Math.min(18, 4 + age * 0.8);
    case 'colossus': return Math.min(16, 3 + age * 0.6);
    case 'monolith': return Math.min(14, 3 + age * 0.45);
    case 'ram': return Math.min(8, 2 + age * 0.3);
    case 'phalanx': return Math.min(18, 5 + age * 0.7);
    case 'drone': return Math.max(8, 34 - wave * 0.6);
    case 'wasp': return Math.min(28, 9 + age * 1.2);
    case 'bomber': return Math.min(24, 6 + age * 1.0);
    case 'hornet': return Math.min(20, 6 + age * 0.9);
    case 'meteor': return Math.min(14, 3 + age * 0.45);
    default: return 1;
  }
}

/** Construit un seul motif temporisé [{type, at}] totalisant `budget` ennemis, pris dans `pool`. */
function buildPattern(rng, pool, budget, gap) {
  const pattern = [];
  let remaining = budget, t = 0;
  while (remaining > 0 && pool.length) {
    const pick = rng.weighted(pool);
    const def = ENEMIES[pick.id];
    if (def.packSize) {
      // Un essaim arrive en paquet serré
      const n = Math.min(remaining, def.packSize);
      for (let i = 0; i < n; i++) pattern.push({ type: pick.id, at: t + i * 0.09 });
      remaining -= n;
      t += gap * 1.4;
    } else {
      pattern.push({ type: pick.id, at: t });
      remaining--;
      t += gap * rng.float(0.75, 1.25);
    }
  }
  return pattern;
}

/**
 * Construit la liste ordonnée des spawns d'une vague.
 *
 * `waveCount(wave)` (× airRatio pour l'air) est un budget PAR VOIE, pas un
 * total à répartir : un seul motif temporisé est généré pour le sol et un
 * pour l'air, puis chacun est rejoué intégralement sur CHAQUE voie
 * correspondante (`groundLanes` points de spawn au sol, `airLanes` voies
 * aériennes — voir Grid.spawns / Grid.airLanes, tous deux sans plafond et
 * pouvant croître avec Grid.grow()). Plus il y a de voies ouvertes, plus le
 * nombre total d'ennemis d'une vague grandit en conséquence — le nombre
 * "annoncé" reste celui d'UNE SEULE voie.
 *
 * Retourne [{type, at, lane, air}] où `at` est le temps (s) depuis le
 * début de la vague et `lane` l'index dans grid.spawns (sol) ou
 * grid.airLanes (air) d'où l'ennemi doit apparaître.
 */
export function buildWave(wave, groundLanes = 1, airLanes = 1) {
  const rng = new Rng(0x5EED ^ (wave * 2654435761));
  const perLane = waveCount(wave);
  const airRatio = waveAirRatio(wave);
  const airPerLane = Math.round(perLane * airRatio);

  const groundPool = GROUND_POOL
    .map((id) => ({ id, w: weightFor(id, wave) }))
    .filter((o) => o.w > 0);
  const airPool = AIR_POOL
    .map((id) => ({ id, w: weightFor(id, wave) }))
    .filter((o) => o.w > 0);

  const gap = Math.max(WAVE.spawnGapMin, WAVE.spawnGap - wave * 0.012);
  const groundLaneCount = Math.max(1, groundLanes);
  const airLaneCount = airPool.length ? Math.max(1, airLanes) : 0;

  const groundPattern = buildPattern(rng, groundPool, perLane, gap);
  const airPattern = airLaneCount ? buildPattern(rng, airPool, airPerLane, gap) : [];

  // Réplication sur chaque voie — léger décalage temporel (hors voie 0)
  // pour ne pas synchroniser parfaitement toutes les voies image par image.
  const spawns = [];
  for (let lane = 0; lane < groundLaneCount; lane++) {
    const jitter = lane === 0 ? 0 : rng.float(-0.3, 0.3);
    for (const s of groundPattern) spawns.push({ type: s.type, at: Math.max(0, s.at + jitter), lane, air: false });
  }
  for (let lane = 0; lane < airLaneCount; lane++) {
    const jitter = lane === 0 ? 0 : rng.float(-0.3, 0.3);
    for (const s of airPattern) spawns.push({ type: s.type, at: Math.max(0, s.at + jitter), lane, air: true });
  }

  // --- Boss : une seule fois par vague, jamais répliqué par voie ---
  const bossGround = wave % WAVE.bossGroundEvery === 0;
  const bossAir = wave % WAVE.bossAirEvery === 0 && airLaneCount > 0;
  const lastGroundT = groundPattern.length ? groundPattern[groundPattern.length - 1].at : 0;
  const lastAirT = airPattern.length ? airPattern[airPattern.length - 1].at : 0;
  if (bossGround) {
    spawns.push({
      type: 'juggernaut', at: Math.max(1.5, lastGroundT * 0.35), boss: true,
      lane: rng.int(0, groundLaneCount - 1), air: false
    });
  }
  if (bossAir) {
    spawns.push({
      type: 'raptor', at: Math.max(2.5, lastAirT * 0.55), boss: true,
      lane: rng.int(0, airLaneCount - 1), air: true
    });
  }

  spawns.sort((a, b) => a.at - b.at);

  return {
    wave,
    spawns,
    duration: spawns.length ? spawns[spawns.length - 1].at : 0,
    hpMult: waveHpMult(wave),
    speedMult: 1 + WAVE.speedGrowth * (wave - 1),
    airRatio,
    hasBoss: bossGround || bossAir,
    groundLanes: groundLaneCount,
    airLanes: airLaneCount,
    perLane
  };
}

/** Résumé lisible pour le HUD (types dominants et effectifs). */
export function waveSummary(waveData) {
  const counts = {};
  for (const s of waveData.spawns) counts[s.type] = (counts[s.type] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => ({
      type, n,
      name: ENEMIES[type].name,
      air: ENEMIES[type].air,
      color: ENEMIES[type].color,
      boss: !!ENEMIES[type].boss
    }));
}

/** Contrôleur d'une vague en cours. */
export class WaveRunner {
  constructor(waveData) {
    this.data = waveData;
    this.index = 0;
    this.t = 0;
    this.done = false;
  }
  /** Retourne les types à faire apparaître pendant ce pas de temps. */
  update(dt) {
    if (this.done) return null;
    this.t += dt;
    const out = [];
    while (this.index < this.data.spawns.length && this.data.spawns[this.index].at <= this.t) {
      out.push(this.data.spawns[this.index]);
      this.index++;
    }
    if (this.index >= this.data.spawns.length) this.done = true;
    return out.length ? out : null;
  }
  get progress() {
    return this.data.spawns.length ? this.index / this.data.spawns.length : 1;
  }
}
