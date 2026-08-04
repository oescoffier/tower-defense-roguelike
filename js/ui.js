// ============================================================
//  UI — HUD, panneaux, boutiques, transitions d'écran.
//  Toutes les animations DOM passent par `A` (anime.js du CDN
//  ou le moteur de repli tween.js).
// ============================================================

import { TOWERS, TOWER_ORDER, TARGET, PALETTE, TREE, BRANCHES, materialsForWave } from './config.js';
import { towerCost } from './towers.js';
import tween from './tween.js';

/** anime.js si le CDN a répondu, sinon le moteur maison. */
export const A = (typeof window !== 'undefined' && window.anime) ? window.anime : tween;
export const usingCdn = (typeof window !== 'undefined' && !!window.anime);

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const TARGET_LABEL = {
  [TARGET.NONE]: 'BLOCAGE',
  [TARGET.GROUND]: '<span class="gnd-tag">SOL</span>',
  [TARGET.AIR]: '<span class="air-tag">AIR</span>',
  [TARGET.BOTH]: '<span class="gnd-tag">SOL</span> + <span class="air-tag">AIR</span>'
};

const GLYPHS = { mg: '⌗', sniper: '✛', mortar: '◎', tesla: '⚡', flame: '▲', aa: '✈', sandbag: '▦' };

// ============================================================
//  Transitions d'écran (volets néo-brutalistes)
// ============================================================

let currentScreen = 'screen-boot';

export function showScreen(id, opts = {}) {
  if (id === currentScreen && !opts.force) return Promise.resolve();
  const wipe = $('#wipe');
  const bars = Array.from(wipe.children);

  return new Promise((resolve) => {
    A.set(bars, { scaleY: 0, transformOrigin: 'top' });
    A({
      targets: bars,
      scaleY: [0, 1],
      duration: 260,
      easing: 'easeInQuart',
      delay: A.stagger(38),
      complete: () => {
        $$('.screen').forEach((s) => s.classList.remove('active'));
        const el = document.getElementById(id);
        el.classList.add('active');
        el.scrollTop = 0;
        currentScreen = id;
        if (opts.onSwap) opts.onSwap();

        A.set(bars, { transformOrigin: 'bottom' });
        A({
          targets: bars,
          scaleY: [1, 0],
          duration: 300,
          easing: 'easeOutQuart',
          delay: A.stagger(38, { from: 'last' }),
          complete: () => { animateScreenIn(id); resolve(); }
        });
      }
    });
  });
}

/** Entrée en cascade des panneaux de l'écran affiché. */
export function animateScreenIn(id) {
  const el = document.getElementById(id);
  const panels = Array.from(el.querySelectorAll('.panel, .hud-box, .stage, .branch-btn'));
  if (!panels.length) return;
  A.set(panels, { opacity: 0, translateY: 22 });
  A({
    targets: panels,
    opacity: [0, 1],
    translateY: [22, 0],
    duration: 520,
    delay: A.stagger(34),
    easing: 'easeOutBack'
  });
}

// ============================================================
//  Séquence de démarrage
// ============================================================

const BOOT_LOG = [
  'INITIALISATION DU NOYAU DÉFENSIF...',
  'CHARGEMENT DE LA GRILLE TACTIQUE... <b>OK</b>',
  'CALIBRAGE DES TOURELLES [6 MODÈLES]... <b>OK</b>',
  'ANALYSE DES COULOIRS SOL / AIR... <b>OK</b>',
  'SYNCHRONISATION DE L\'ARBRE [2156 NŒUDS]... <b>OK</b>',
  'MENACE DÉTECTÉE — SECTEUR COMPROMIS'
];

export function runBoot(onDone) {
  const title = $('#boot-title');
  const raw = title.textContent;
  title.innerHTML = raw.split('').map((c) =>
    c === ' ' ? '<span>&nbsp;</span>' : `<span>${c}</span>`).join('');
  const letters = title.querySelectorAll('span');

  const log = $('#boot-log');
  log.innerHTML = BOOT_LOG.map((l) => `<div>&gt; ${l}</div>`).join('');
  const lines = log.querySelectorAll('div');

  A({
    targets: letters,
    opacity: [0, 1],
    translateY: [-70, 0],
    rotate: [() => A.random(-40, 40), 0],
    scale: [0.4, 1],
    duration: 760,
    delay: A.stagger(52),
    easing: 'easeOutElastic'
  });

  A({
    targets: '.boot-bar i',
    width: ['0%', '100%'],
    duration: 2100,
    easing: 'easeInOutQuart'
  });

  A({
    targets: lines,
    opacity: [0, 1],
    translateX: [-16, 0],
    duration: 220,
    delay: A.stagger(280, { start: 420 }),
    easing: 'easeOutQuad'
  });

  // Glitch du titre pendant le chargement
  const glitch = setInterval(() => {
    const l = letters[Math.floor(Math.random() * letters.length)];
    if (!l) return;
    A({ targets: l, translateX: [A.random(-9, 9), 0], duration: 110, easing: 'easeOutQuad' });
  }, 170);

  setTimeout(() => { clearInterval(glitch); onDone(); }, 2500);
}

// ============================================================
//  Menu
// ============================================================

export function renderMenu(save, treeSize) {
  $('#menu-materials').textContent = save.materials;
  $('#menu-best').textContent = save.data.bestWave || '—';
  $('#menu-runs').textContent = save.data.totalRuns;
  $('#menu-kills').textContent = save.data.totalKills;
  $('#menu-nodes').textContent = `${save.unlocked.size} / ${treeSize}`;
  $('#tree-badge').textContent = save.materials;

  const list = $('#menu-towers');
  list.innerHTML = TOWER_ORDER.map((id) => {
    const t = TOWERS[id];
    return `<div class="legend-item" style="border-left-color:${t.accent}">
      <span class="dot" style="background:${t.accent}"></span>
      <span class="nm">${t.name}</span>
      <span class="tg">${TARGET_LABEL[t.targets]}</span>
    </div>`;
  }).join('');
}

/** Compteur qui roule jusqu'à sa valeur. */
export function countUp(el, to, dur = 900, prefix = '') {
  const obj = { v: parseFloat(el.textContent.replace(/[^\d.-]/g, '')) || 0 };
  A({
    targets: obj,
    v: to,
    duration: dur,
    easing: 'easeOutExpo',
    update: () => { el.textContent = prefix + Math.round(obj.v); }
  });
}

// ============================================================
//  HUD de jeu
// ============================================================

export function buildShop(game, onPick) {
  const list = $('#shop-list');
  list.innerHTML = '';
  TOWER_ORDER.forEach((id, i) => {
    const t = TOWERS[id];
    const btn = document.createElement('button');
    btn.className = 'shop-item';
    btn.dataset.tower = id;
    btn.style.borderLeftColor = t.accent;
    btn.innerHTML = `
      <span class="shop-glyph" style="color:${t.accent}">${GLYPHS[id]}</span>
      <span class="shop-info">
        <span class="shop-name">${t.name}</span>
        <span class="shop-tags">${TARGET_LABEL[t.targets]}</span>
      </span>
      <span class="shop-cost" data-cost>${towerCost(id, game.mods)}</span>
      <span class="shop-key">${i + 1}</span>`;
    btn.title = t.desc;
    btn.addEventListener('click', () => onPick(id));
    list.appendChild(btn);
  });
}

export function refreshShop(game) {
  $$('.shop-item').forEach((el) => {
    const id = el.dataset.tower;
    const cost = towerCost(id, game.mods);
    el.querySelector('[data-cost]').textContent = cost;
    el.classList.toggle('poor', game.gold < cost);
    el.classList.toggle('on', game.placing === id);
  });
}

let lastHud = {};

export function refreshHud(game) {
  const set = (sel, val, boxSel, dangerFlash) => {
    const el = $(sel);
    if (lastHud[sel] === val) return;
    const had = lastHud[sel] !== undefined;
    lastHud[sel] = val;
    el.textContent = val;
    if (!had) return;
    A({ targets: el, scale: [1.4, 1], duration: 300, easing: 'easeOutBack' });
    if (boxSel) {
      const box = $(boxSel);
      box.classList.remove('flash', 'flash-danger');
      void box.offsetWidth;
      box.classList.add(dangerFlash ? 'flash-danger' : 'flash');
    }
  };

  set('#hud-wave', game.wave, '#hud-wave-box');
  set('#hud-lives', game.lives, '#hud-lives-box', true);
  set('#hud-gold', game.gold, '#hud-gold-box');
  $('#hud-enemies').textContent = game.enemies.filter((e) => !e.dead).length;
  $('#hud-kills').textContent = game.kills;

  const livesEl = $('#hud-lives');
  livesEl.classList.toggle('danger', game.lives <= 5);
}

export function resetHudCache() { lastHud = {}; }

export function setWaveButton(game) {
  const btn = $('#btn-wave');
  const label = $('#btn-wave-label');
  if (game.waveRunning) {
    btn.disabled = true;
    label.textContent = `VAGUE ${game.wave} EN COURS`;
  } else {
    btn.disabled = false;
    label.textContent = `LANCER LA VAGUE ${game.wave + 1}`;
  }
}

export function renderWaveComp(waveData, summary) {
  const el = $('#wave-comp');
  el.innerHTML = summary.map((s) => `
    <div class="comp-row ${s.boss ? 'boss' : s.air ? 'air' : ''}">
      <span class="dot" style="background:${s.color}"></span>
      <span class="nm">${s.name}${s.air ? ' ✈' : ''}</span>
      <span class="qt">×${s.n}</span>
    </div>`).join('');
}

export function showWaveBanner(wave, sub, boss) {
  const banner = $('#wave-banner');
  $('#wb-num').textContent = wave;
  $('#wb-sub').textContent = sub || '';
  banner.classList.toggle('boss', !!boss);

  const inner = banner.querySelector('.wave-banner-inner');
  A.set(banner, { opacity: 1 });
  A.set(inner, { scaleX: 0, opacity: 1 });

  const tl = A.timeline({ easing: 'easeOutExpo' });
  tl.add({ targets: inner, scaleX: [0, 1], duration: 340 })
    .add({ targets: '.wb-num', scale: [2.4, 1], opacity: [0, 1], duration: 460, easing: 'easeOutElastic' }, '-=180')
    .add({ targets: '.wb-label, .wb-sub', opacity: [0, 1], translateY: [10, 0], duration: 260, delay: A.stagger(60) }, '-=300')
    .add({ targets: banner, opacity: [1, 0], duration: 340, delay: 780, easing: 'easeInQuad' });

  // Secousse glitch
  let n = 0;
  const gl = setInterval(() => {
    A({ targets: inner, translateX: [A.random(-7, 7), 0], skewX: [A.random(-12, -4), -8], duration: 90 });
    if (++n > 7) clearInterval(gl);
  }, 95);
}

export function toast(msg, kind = '', dur = 2400) {
  const stack = $('#toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = msg;
  stack.appendChild(el);
  A({ targets: el, opacity: [0, 1], translateX: [-26, 0], duration: 300, easing: 'easeOutBack' });
  setTimeout(() => {
    A({
      targets: el, opacity: [1, 0], translateX: [0, -20], duration: 240,
      complete: () => el.remove()
    });
  }, dur);
  while (stack.children.length > 5) stack.firstChild.remove();
}

// ============================================================
//  Panneau de tour sélectionnée
// ============================================================

export function renderTowerPanel(game, tower) {
  const panel = $('#tower-panel');
  if (!tower) { panel.hidden = true; return; }
  const wasHidden = panel.hidden;
  panel.hidden = false;

  const s = tower.stats;
  const def = tower.def;
  $('#tp-name').innerHTML =
    `<span style="color:${def.accent}">${def.name}</span> <small style="font-family:var(--font-mono);font-size:.62rem;color:var(--muted)">NIV ${tower.level}/${def.upgrades.length}</small>`;

  const rows = tower.id === 'sandbag'
    ? [['RÔLE', 'BLOQUE LE CHEMIN']]
    : [
      ['DPS', Math.round(tower.dps)],
      ['DÉGÂTS', Math.round(s.damage * 10) / 10],
      ['CADENCE', (Math.round(s.rate * 100) / 100) + '/s'],
      ['PORTÉE', Math.round(s.range * 10) / 10],
      ['CIBLES', s.mask === TARGET.AIR ? 'AIR' : s.mask === TARGET.GROUND ? 'SOL' : 'SOL+AIR']
    ];
  if (tower.id === 'sniper') {
    rows.push(['CRITIQUE', Math.round(s.critChance * 100) + '% ×' + (Math.round(s.critMult * 10) / 10)]);
    rows.push(['PERÇAGE', Math.floor(s.pierce)]);
  }
  if (tower.id === 'mortar') rows.push(['RAYON AoE', Math.round(s.splash * 10) / 10]);
  if (tower.id === 'tesla') {
    rows.push(['REBONDS', s.bounces]);
    rows.push(['CONSERVÉ', Math.round(s.bounceFalloff * 100) + '%']);
  }
  if (tower.id === 'flame') {
    rows.push(['BRÛLURE', Math.round(s.burnDps) + '/s × ' + (Math.round(s.burnDur * 10) / 10) + 's']);
    rows.push(['CÔNE', Math.round(s.cone) + '°']);
  }
  if (tower.id === 'aa') rows.push(['MISSILES', Math.max(1, Math.round(s.missiles))]);
  if (tower.id === 'mg') rows.push(['RÉGIME', Math.round(tower.spin * 100) + '% (max ×' + (Math.round(s.spinMax * 100) / 100) + ')']);
  if (tower.id !== 'sandbag') rows.push(['ÉLIMINATIONS', tower.kills]);

  $('#tp-stats').innerHTML = rows.map(([k, v]) =>
    `<div class="tp-stat"><span>${k}</span><b>${v}</b></div>`).join('');

  $('#tp-target-row').hidden = tower.id === 'sandbag';
  $('#tp-priority').textContent = {
    first: 'PREMIER', last: 'DERNIER', close: 'PROCHE', strong: 'SOLIDE', weak: 'FAIBLE'
  }[tower.priority];

  const upCost = tower.upgradeCost(game.mods);
  const upBtn = $('#tp-upgrade');
  if (upCost === null) {
    upBtn.disabled = true;
    upBtn.textContent = 'NIVEAU MAX';
  } else {
    upBtn.disabled = game.gold < upCost;
    upBtn.textContent = `AMÉLIORER · ${upCost}`;
  }
  $('#tp-sell').textContent = `VENDRE · ${tower.sellValue(game.mods)}`;

  if (wasHidden) {
    A({ targets: panel, opacity: [0, 1], translateX: [26, 0], duration: 320, easing: 'easeOutBack' });
  }
}

// ============================================================
//  Écran de fin
// ============================================================

export function renderGameOver(stats, save) {
  $('#over-kicker').textContent = stats.wave >= save.data.bestWave ? 'NOUVEAU RECORD' : 'SECTEUR PERDU';
  $('#over-wave').textContent = '0';
  $('#over-materials').textContent = '0';
  $('#over-kills').textContent = stats.kills;
  $('#over-towers').textContent = stats.towersBuilt;
  $('#over-best').textContent = Math.max(save.data.bestWave, stats.wave);
  const mm = Math.floor(stats.duration / 60);
  const ss = Math.floor(stats.duration % 60).toString().padStart(2, '0');
  $('#over-time').textContent = `${mm}:${ss}`;

  const avgCost = TREE.costBase + TREE.costPerRing * 2;
  $('#over-nodes-est').textContent = `≈ ${Math.floor(stats.materials / Math.max(1, avgCost))} nœuds au coût d'entrée`;

  setTimeout(() => {
    countUp($('#over-wave'), stats.wave, 1100);
    countUp($('#over-materials'), stats.materials, 1500);
    A({
      targets: '.over-stat',
      opacity: [0, 1], translateX: [-18, 0],
      duration: 400, delay: A.stagger(80, { start: 300 }), easing: 'easeOutBack'
    });
    A({
      targets: '.over-mats',
      scale: [0.9, 1], opacity: [0, 1],
      duration: 620, delay: 700, easing: 'easeOutElastic'
    });
  }, 360);
}

// ============================================================
//  Arbre — panneau de détail
// ============================================================

export function renderNodeDetail(node, save, tree, canBuy) {
  const empty = $('#detail-empty');
  const body = $('#detail-body');
  if (!node || node.hub) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;

  const typeEl = $('#detail-type');
  typeEl.className = 'detail-type ' + node.type;
  typeEl.textContent = { minor: 'MINEUR', notable: 'NOTABLE', keystone: 'CLÉ DE VOÛTE' }[node.type];

  $('#detail-name').textContent = node.name || node.desc;
  $('#detail-name').style.color = node.color;
  const branchName = (BRANCHES[node.branch] || {}).name || node.branchId.toUpperCase();
  $('#detail-branch').textContent = `${branchName} · ANNEAU ${node.ring + 1}`;
  $('#detail-desc').textContent = node.desc;
  $('#detail-desc').style.borderLeftColor = node.color;
  $('#detail-cost').textContent = node.cost;

  const buy = $('#detail-buy');
  const status = $('#detail-status');
  const unlocked = save.unlocked.has(node.id);

  if (unlocked) {
    buy.disabled = true;
    buy.textContent = 'DÉBLOQUÉ';
    status.textContent = 'Ce nœud est actif.';
  } else if (!canBuy.reachable) {
    buy.disabled = true;
    buy.textContent = 'INACCESSIBLE';
    status.textContent = 'Débloque d\'abord un nœud voisin.';
  } else if (save.materials < node.cost) {
    buy.disabled = true;
    buy.textContent = 'MATÉRIAUX INSUFFISANTS';
    status.textContent = `Il manque ${node.cost - save.materials} matériaux.`;
  } else {
    buy.disabled = false;
    buy.textContent = 'DÉBLOQUER';
    status.textContent = 'Double-clic sur le nœud fonctionne aussi.';
  }

  A({ targets: body, opacity: [0, 1], translateY: [12, 0], duration: 260, easing: 'easeOutQuad' });
}

export function renderBranchNav(summaries, active, onPick) {
  const nav = $('#tree-branches');
  nav.innerHTML = '';
  const all = document.createElement('button');
  all.className = 'branch-btn' + (active === -1 ? ' on' : '');
  all.style.borderColor = active === -1 ? PALETTE.line : '';
  all.innerHTML = `VUE GLOBALE<small>${summaries.reduce((a, s) => a + s.count, 0)} nœuds</small>`;
  all.addEventListener('click', () => onPick(-1));
  nav.appendChild(all);

  summaries.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'branch-btn' + (active === i ? ' on' : '');
    b.style.borderColor = active === i ? s.color : '';
    b.style.color = s.color;
    b.innerHTML = `${s.icon} ${s.name}<small>${s.count} / ${TREE.perBranch}</small>`;
    b.addEventListener('click', () => onPick(i));
    nav.appendChild(b);
  });
}

/** Aperçu chiffré des matériaux qu'une vague rapporterait. */
export function estimateMaterials(wave, mods) {
  const bonus = 1 + (mods['player.materials'] || 0);
  return Math.round(materialsForWave(wave) * bonus);
}
