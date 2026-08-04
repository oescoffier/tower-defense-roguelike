// ============================================================
//  RNG — générateur pseudo-aléatoire seedé (mulberry32)
//  Déterministe : la même seed produit toujours la même séquence.
//  Indispensable pour l'arbre (2156 noeuds régénérés à l'identique
//  à chaque chargement) et pour la composition des vagues.
// ============================================================

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Petit wrapper avec les helpers usuels. */
export class Rng {
  constructor(seed = 1) {
    this.next = mulberry32(seed);
  }
  float(min = 0, max = 1) { return min + this.next() * (max - min); }
  int(min, max) { return Math.floor(this.float(min, max + 1)); }
  bool(p = 0.5) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  /** Tirage pondéré : items = [{w:number, ...}] */
  weighted(items, weightKey = 'w') {
    let total = 0;
    for (const it of items) total += it[weightKey] || 1;
    let r = this.next() * total;
    for (const it of items) {
      r -= (it[weightKey] || 1);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** Variation gaussienne approximée (somme de 3 uniformes). */
  gauss(mean = 0, sd = 1) {
    const u = (this.next() + this.next() + this.next()) / 3;
    return mean + (u - 0.5) * 2 * sd * 1.732;
  }
}

/** Hash déterministe d'une chaîne → entier 32 bits (pour dériver des seeds). */
export function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Aléatoire non-seedé pour les effets visuels (jamais pour la logique).
export const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
