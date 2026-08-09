// ============================================================
//  WAVES — génération procédurale de vagues infinies
// ============================================================

import { ENEMIES, WAVE, waveHpMult, waveCount, waveAirRatio } from './config.js';
import { Rng } from './rng.js';

const GROUND_POOL = ['grunt', 'runner', 'brute', 'swarm', 'healer', 'shielder', 'splitter', 'colossus'];
const AIR_POOL = ['drone', 'wasp', 'bomber', 'hornet'];

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
    case 'drone': return Math.max(8, 34 - wave * 0.6);
    case 'wasp': return Math.min(28, 9 + age * 1.2);
    case 'bomber': return Math.min(24, 6 + age * 1.0);
    case 'hornet': return Math.min(20, 6 + age * 0.9);
    default: return 1;
  }
}

/**
 * Construit la liste ordonnée des spawns d'une vague.
 * Retourne [{type, at}] où `at` est le temps (s) depuis le début de la vague.
 */
export function buildWave(wave) {
  const rng = new Rng(0x5EED ^ (wave * 2654435761));
  const total = waveCount(wave);
  const airRatio = waveAirRatio(wave);

  const groundPool = GROUND_POOL
    .map((id) => ({ id, w: weightFor(id, wave) }))
    .filter((o) => o.w > 0);
  const airPool = AIR_POOL
    .map((id) => ({ id, w: weightFor(id, wave) }))
    .filter((o) => o.w > 0);

  const spawns = [];
  let t = 0;
  const gap = Math.max(WAVE.spawnGapMin, WAVE.spawnGap - wave * 0.012);

  // --- Boss ---
  const bossGround = wave % WAVE.bossGroundEvery === 0;
  const bossAir = wave % WAVE.bossAirEvery === 0;

  let remaining = total;
  let airBudget = Math.round(total * airRatio);
  if (!airPool.length) airBudget = 0;

  while (remaining > 0) {
    const wantAir = airBudget > 0 && (rng.next() < 0.45 || remaining <= airBudget);
    if (wantAir && airPool.length) {
      const pick = rng.weighted(airPool);
      const adef = ENEMIES[pick.id];
      if (adef.packSize) {
        // Essaim aérien : arrive groupé, comme un essaim au sol.
        const n = Math.min(remaining, adef.packSize);
        for (let i = 0; i < n; i++) {
          spawns.push({ type: pick.id, at: t + i * 0.09 });
        }
        remaining -= n; airBudget -= n;
        t += gap * 1.4;
      } else {
        spawns.push({ type: pick.id, at: t });
        airBudget--; remaining--;
        t += gap * rng.float(0.75, 1.25);
      }
    } else if (groundPool.length) {
      const pick = rng.weighted(groundPool);
      const def = ENEMIES[pick.id];
      if (def.packSize) {
        // Un essaim arrive en paquet serré
        const n = Math.min(remaining, def.packSize);
        for (let i = 0; i < n; i++) {
          spawns.push({ type: pick.id, at: t + i * 0.09 });
        }
        remaining -= n;
        t += gap * 1.4;
      } else {
        spawns.push({ type: pick.id, at: t });
        remaining--;
        t += gap * rng.float(0.75, 1.25);
      }
    } else {
      remaining = 0;
    }
  }

  if (bossGround) spawns.push({ type: 'juggernaut', at: Math.max(1.5, t * 0.35), boss: true });
  if (bossAir) spawns.push({ type: 'raptor', at: Math.max(2.5, t * 0.55), boss: true });

  spawns.sort((a, b) => a.at - b.at);

  return {
    wave,
    spawns,
    duration: spawns.length ? spawns[spawns.length - 1].at : 0,
    hpMult: waveHpMult(wave),
    speedMult: 1 + WAVE.speedGrowth * (wave - 1),
    airRatio,
    hasBoss: bossGround || bossAir
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
