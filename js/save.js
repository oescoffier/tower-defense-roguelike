// ============================================================
//  SAVE — persistance localStorage de la méta-progression.
// ============================================================

const KEY = 'td_roguelike_save_v1';

const DEFAULTS = () => ({
  materials: 0,
  unlocked: [],
  commander: null,
  bestWave: 0,
  totalRuns: 0,
  totalKills: 0,
  totalMaterials: 0,
  lastRun: null,
  onboardingSeen: false,
  tutorialDone: false,
  tutorialRewarded: false,
  loadout: {},          // archetype -> id de variante retenue
  settings: { speed: 1, shake: true, autoWave: false }
});

export class Save {
  constructor() {
    this.data = DEFAULTS();
    this.unlocked = new Set();
    this.load();
  }

  get materials() { return this.data.materials; }
  set materials(v) { this.data.materials = Math.max(0, Math.round(v)); }

  get commander() { return this.data.commander; }
  setCommander(id) { this.data.commander = id; this.persist(); }

  get shakeEnabled() { return this.data.settings.shake !== false; }
  setShakeEnabled(v) { this.data.settings.shake = !!v; this.persist(); }

  get autoWave() { return !!this.data.settings.autoWave; }
  setAutoWave(v) { this.data.settings.autoWave = !!v; this.persist(); }

  /** Variantes retenues pour la prochaine partie, memorisees d'une partie a l'autre. */
  get loadout() { return this.data.loadout || (this.data.loadout = {}); }
  setVariant(archetype, variantId) {
    if (!this.data.loadout) this.data.loadout = {};
    if (variantId) this.data.loadout[archetype] = variantId;
    else delete this.data.loadout[archetype];
    this.persist();
  }

  get onboardingSeen() { return !!this.data.onboardingSeen; }
  markOnboardingSeen() { this.data.onboardingSeen = true; this.persist(); }

  get tutorialDone() { return !!this.data.tutorialDone; }
  /** La récompense de fin d'entraînement n'est versée qu'une seule fois. */
  markTutorialDone() {
    this.data.tutorialDone = true;
    const first = !this.data.tutorialRewarded;
    this.data.tutorialRewarded = true;
    this.persist();
    return first;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...DEFAULTS(), ...parsed };
        this.data.settings = { ...DEFAULTS().settings, ...(parsed.settings || {}) };
      }
    } catch (err) {
      console.warn('Sauvegarde illisible, réinitialisation.', err);
      this.data = DEFAULTS();
    }
    this.unlocked = new Set(this.data.unlocked || []);
  }

  persist() {
    this.data.unlocked = Array.from(this.unlocked);
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('Impossible d\'écrire la sauvegarde.', err);
    }
  }

  unlock(nodeId, cost) {
    if (this.unlocked.has(nodeId)) return false;
    if (this.data.materials < cost) return false;
    this.data.materials -= cost;
    this.unlocked.add(nodeId);
    this.persist();
    return true;
  }

  addMaterials(n) {
    this.data.materials += Math.max(0, Math.round(n));
    this.data.totalMaterials += Math.max(0, Math.round(n));
    this.persist();
  }

  recordRun({ wave, kills, materials, gold, towersBuilt, duration }) {
    this.data.totalRuns++;
    this.data.totalKills += kills;
    this.data.bestWave = Math.max(this.data.bestWave, wave);
    this.data.lastRun = { wave, kills, materials, gold, towersBuilt, duration, at: Date.now() };
    this.persist();
  }

  reset() {
    this.data = DEFAULTS();
    this.unlocked = new Set();
    this.persist();
  }

  /** Export/import texte pour sauvegarder une partie hors du navigateur. */
  exportString() {
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.data))));
  }
  importString(str) {
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
      this.data = { ...DEFAULTS(), ...parsed };
      this.unlocked = new Set(this.data.unlocked || []);
      this.persist();
      return true;
    } catch {
      return false;
    }
  }
}
