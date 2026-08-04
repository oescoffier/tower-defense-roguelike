// ============================================================
//  TWEEN — mini moteur d'animation compatible anime.js v3
//  Utilisé en repli si le CDN anime.js n'est pas joignable.
//  API couverte : anime({...}), anime.stagger(), anime.timeline(),
//  anime.set(), anime.remove(), anime.random().
// ============================================================

// ---------- Easings ----------
const bezier = (x1, y1, x2, y2) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) break;
      t -= err / d;
    }
    return sampleY(Math.max(0, Math.min(1, t)));
  };
};

const pow = (n) => ({
  in: (t) => Math.pow(t, n),
  out: (t) => 1 - Math.pow(1 - t, n),
  inOut: (t) => t < 0.5 ? Math.pow(2 * t, n) / 2 : 1 - Math.pow(2 - 2 * t, n) / 2
});

const elastic = (amp = 1, period = 0.5) => (t) => {
  if (t === 0 || t === 1) return t;
  const p = period;
  const a = Math.max(1, amp);
  const s = p / (2 * Math.PI) * Math.asin(1 / a);
  return a * Math.pow(2, -10 * t) * Math.sin((t - s) * (2 * Math.PI) / p) + 1;
};

const bounceOut = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

const backOut = (s = 1.70158) => (t) => 1 + (--t) * t * ((s + 1) * t + s);
const backIn = (s = 1.70158) => (t) => t * t * ((s + 1) * t - s);

export const EASINGS = {
  linear: (t) => t,
  easeInQuad: pow(2).in, easeOutQuad: pow(2).out, easeInOutQuad: pow(2).inOut,
  easeInCubic: pow(3).in, easeOutCubic: pow(3).out, easeInOutCubic: pow(3).inOut,
  easeInQuart: pow(4).in, easeOutQuart: pow(4).out, easeInOutQuart: pow(4).inOut,
  easeInQuint: pow(5).in, easeOutQuint: pow(5).out, easeInOutQuint: pow(5).inOut,
  easeInExpo: (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  easeInSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  easeInCirc: (t) => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: (t) => Math.sqrt(1 - (--t) * t),
  easeInBack: backIn(), easeOutBack: backOut(),
  easeInOutBack: (t) => t < 0.5 ? backIn()(2 * t) / 2 : 1 - backIn()(2 - 2 * t) / 2,
  easeOutElastic: elastic(1, 0.4),
  easeInElastic: (t) => 1 - elastic(1, 0.4)(1 - t),
  easeOutBounce: bounceOut,
  easeInBounce: (t) => 1 - bounceOut(1 - t),
  spring: elastic(1.1, 0.35)
};

function resolveEasing(e) {
  if (typeof e === 'function') return e;
  if (typeof e !== 'string') return EASINGS.easeOutQuad;
  if (EASINGS[e]) return EASINGS[e];
  const cb = e.match(/cubicBezier\(([^)]+)\)/);
  if (cb) {
    const [a, b, c, d] = cb[1].split(',').map(Number);
    return bezier(a, b, c, d);
  }
  const sp = e.match(/spring\(([^)]*)\)/);
  if (sp) {
    const p = sp[1].split(',').map(Number);
    return elastic(p[1] || 1.1, 0.35);
  }
  const el = e.match(/easeOutElastic\(([^)]*)\)/);
  if (el) {
    const p = el[1].split(',').map(Number);
    return elastic(p[0] || 1, (p[1] || 500) / 1000);
  }
  return EASINGS.easeOutQuad;
}

// ---------- Propriétés ----------
const TRANSFORMS = [
  'translateX', 'translateY', 'translateZ',
  'rotate', 'rotateX', 'rotateY', 'rotateZ',
  'scale', 'scaleX', 'scaleY', 'skew', 'skewX', 'skewY', 'perspective'
];
const DEG_PROPS = ['rotate', 'rotateX', 'rotateY', 'rotateZ', 'skew', 'skewX', 'skewY'];
const UNITLESS = ['opacity', 'scale', 'scaleX', 'scaleY', 'zIndex', 'lineHeight', 'flexGrow', 'order'];

function defaultUnit(prop) {
  if (TRANSFORMS.includes(prop)) {
    if (DEG_PROPS.includes(prop)) return 'deg';
    if (prop.startsWith('scale')) return '';
    return 'px';
  }
  if (UNITLESS.includes(prop)) return '';
  return 'px';
}

const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB = /rgba?\(([^)]+)\)/;

function parseColor(v) {
  if (typeof v !== 'string') return null;
  const h = v.trim().match(HEX);
  if (h) {
    let s = h[1];
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    if (s.length === 6) s += 'ff';
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
      parseInt(s.slice(6, 8), 16) / 255
    ];
  }
  const r = v.match(RGB);
  if (r) {
    const p = r[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}

function parseValue(v, prop) {
  if (typeof v === 'number') return { num: v, unit: defaultUnit(prop), color: null };
  const col = parseColor(v);
  if (col) return { num: 0, unit: '', color: col };
  const m = String(v).match(/^([+-]?[\d.]+)(.*)$/);
  if (m) return { num: parseFloat(m[1]), unit: m[2] || defaultUnit(prop), color: null };
  return { num: 0, unit: '', color: null, raw: v };
}

function getCurrent(target, prop) {
  if (!(target instanceof Element)) {
    const v = target[prop];
    return v === undefined ? 0 : v;
  }
  if (TRANSFORMS.includes(prop)) {
    const cache = target.__tw || (target.__tw = {});
    if (cache[prop] !== undefined) return cache[prop];
    return prop.startsWith('scale') ? 1 : 0;
  }
  const cs = getComputedStyle(target);
  const v = cs[prop];
  if (v === undefined || v === '') return 0;
  return v;
}

function applyTransforms(el) {
  const c = el.__tw || {};
  let s = '';
  for (const p of TRANSFORMS) {
    if (c[p] === undefined) continue;
    const unit = DEG_PROPS.includes(p) ? 'deg' : (p.startsWith('scale') ? '' : 'px');
    s += `${p}(${c[p]}${unit}) `;
  }
  el.style.transform = s.trim();
}

function setProp(target, prop, from, to, t) {
  let out;
  if (from.color && to.color) {
    const r = Math.round(from.color[0] + (to.color[0] - from.color[0]) * t);
    const g = Math.round(from.color[1] + (to.color[1] - from.color[1]) * t);
    const b = Math.round(from.color[2] + (to.color[2] - from.color[2]) * t);
    const a = from.color[3] + (to.color[3] - from.color[3]) * t;
    out = `rgba(${r},${g},${b},${a.toFixed(3)})`;
  } else {
    const n = from.num + (to.num - from.num) * t;
    out = n;
  }

  if (!(target instanceof Element)) {
    target[prop] = typeof out === 'number' ? out : out;
    return;
  }
  if (TRANSFORMS.includes(prop)) {
    const c = target.__tw || (target.__tw = {});
    c[prop] = typeof out === 'number' ? +out.toFixed(4) : out;
    applyTransforms(target);
    return;
  }
  if (typeof out === 'number') {
    target.style[prop] = out + (to.unit || '');
  } else {
    target.style[prop] = out;
  }
}

// ---------- Résolution des cibles ----------
function toArray(targets) {
  if (!targets) return [];
  if (typeof targets === 'string') return Array.from(document.querySelectorAll(targets));
  if (targets instanceof Element) return [targets];
  if (Array.isArray(targets)) return targets.flatMap(toArray);
  if (targets instanceof NodeList || targets instanceof HTMLCollection) return Array.from(targets);
  return [targets];
}

// ---------- Moteur ----------
const active = [];
let rafId = null;
let lastTime = 0;

function loop(now) {
  const dt = Math.min(64, now - lastTime);
  lastTime = now;
  for (let i = active.length - 1; i >= 0; i--) {
    const a = active[i];
    a._tick(dt);
    if (a.completed || a.paused) {
      if (a.completed) active.splice(i, 1);
    }
  }
  if (active.length) rafId = requestAnimationFrame(loop);
  else rafId = null;
}

function schedule(anim) {
  if (!active.includes(anim)) active.push(anim);
  if (rafId === null) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }
}

const RESERVED = new Set([
  'targets', 'duration', 'delay', 'endDelay', 'easing', 'loop', 'direction',
  'autoplay', 'begin', 'update', 'complete', 'loopBegin', 'loopComplete', 'round'
]);

class Anim {
  constructor(params = {}) {
    this.targets = toArray(params.targets);
    this.duration = params.duration === undefined ? 1000 : params.duration;
    this.delayFn = params.delay === undefined ? 0 : params.delay;
    this.endDelay = params.endDelay || 0;
    this.easing = resolveEasing(params.easing || 'easeOutQuad');
    this.loop = params.loop === true ? Infinity : (params.loop || 0);
    this.direction = params.direction || 'normal';
    this.round = params.round || 0;
    this.onBegin = params.begin;
    this.onUpdate = params.update;
    this.onComplete = params.complete;
    this.onLoopComplete = params.loopComplete;
    this.paused = false;
    this.completed = false;
    this.began = false;
    this.time = 0;
    this.iteration = 0;
    this.reversed = this.direction === 'reverse';
    this._resolvers = [];

    this.props = [];
    for (const key of Object.keys(params)) {
      if (RESERVED.has(key)) continue;
      this.props.push({ name: key, spec: params[key] });
    }

    this.tracks = [];
    this.targets.forEach((target, i) => {
      const delay = typeof this.delayFn === 'function'
        ? this.delayFn(target, i, this.targets.length) : this.delayFn;
      const dur = typeof this.duration === 'function'
        ? this.duration(target, i, this.targets.length) : this.duration;
      for (const p of this.props) {
        let spec = p.spec;
        if (typeof spec === 'function') spec = spec(target, i, this.targets.length);
        let fromRaw, toRaw, pDelay = delay, pDur = dur, pEase = this.easing;
        if (Array.isArray(spec)) {
          fromRaw = spec[0]; toRaw = spec[1];
        } else if (spec !== null && typeof spec === 'object' && 'value' in spec) {
          const v = spec.value;
          if (Array.isArray(v)) { fromRaw = v[0]; toRaw = v[1]; }
          else { fromRaw = getCurrent(target, p.name); toRaw = v; }
          if (spec.delay !== undefined) {
            pDelay = typeof spec.delay === 'function'
              ? spec.delay(target, i, this.targets.length) : spec.delay;
          }
          if (spec.duration !== undefined) pDur = spec.duration;
          if (spec.easing !== undefined) pEase = resolveEasing(spec.easing);
        } else {
          fromRaw = getCurrent(target, p.name); toRaw = spec;
        }
        const to = parseValue(toRaw, p.name);
        const from = parseValue(fromRaw, p.name);
        if (to.color && !from.color) from.color = [255, 255, 255, 1];
        if (!to.unit && from.unit) to.unit = from.unit;
        this.tracks.push({ target, prop: p.name, from, to, delay: pDelay, dur: pDur, ease: pEase });
      }
    });

    this.total = this.tracks.reduce((m, t) => Math.max(m, t.delay + t.dur), 0) + this.endDelay;
    if (!this.tracks.length) this.total = this.duration + this.endDelay;

    this.finished = new Promise((res) => this._resolvers.push(res));
    if (params.autoplay !== false) this.play();
  }

  _apply(time) {
    for (const tr of this.tracks) {
      const local = time - tr.delay;
      let t;
      if (local <= 0) t = 0;
      else if (local >= tr.dur) t = 1;
      else t = tr.ease(local / tr.dur);
      if (local < 0 && time < tr.delay) {
        // pas encore commencé : on n'écrase pas la valeur courante
        if (time === 0) continue;
      }
      setProp(tr.target, tr.prop, tr.from, tr.to, t);
    }
  }

  _tick(dt) {
    if (this.paused || this.completed) return;
    if (!this.began) {
      this.began = true;
      if (this.onBegin) this.onBegin(this);
    }
    this.time += dt;
    let t = Math.min(this.time, this.total);
    this.progress = this.total ? t / this.total : 1;
    this._apply(this.reversed ? this.total - t : t);
    if (this.onUpdate) this.onUpdate(this);

    if (this.time >= this.total) {
      if (this.iteration < this.loop) {
        this.iteration++;
        this.time = 0;
        if (this.direction === 'alternate') this.reversed = !this.reversed;
        if (this.onLoopComplete) this.onLoopComplete(this);
      } else {
        this.completed = true;
        if (this.onComplete) this.onComplete(this);
        this._resolvers.forEach((r) => r(this));
      }
    }
  }

  play() { this.paused = false; this.completed = false; schedule(this); return this; }
  pause() { this.paused = true; return this; }
  restart() { this.time = 0; this.iteration = 0; this.completed = false; this.began = false; this.play(); return this; }
  seek(ms) { this.time = ms; this._apply(ms); return this; }
}

// ---------- Timeline ----------
class Timeline {
  constructor(defaults = {}) {
    this.defaults = defaults;
    this.children = [];
    this.cursor = 0;
    this.time = 0;
    this.total = 0;
    this.paused = false;
    this.completed = false;
    this._resolvers = [];
    this.finished = new Promise((r) => this._resolvers.push(r));
    this.onComplete = defaults.complete;
    this._autoplay = defaults.autoplay !== false;
    this._queued = false;
  }

  add(params, offset) {
    const merged = { ...this.defaults, ...params, autoplay: false };
    delete merged.complete;
    if (params.complete) merged.complete = params.complete;
    const anim = new Anim(merged);
    let start;
    if (offset === undefined) start = this.cursor;
    else if (typeof offset === 'string') {
      const m = offset.match(/^([+-]=)(.+)$/);
      if (m) {
        const v = parseFloat(m[2]);
        start = m[1] === '+=' ? this.cursor + v : this.cursor - v;
      } else start = parseFloat(offset) || 0;
    } else start = offset;
    start = Math.max(0, start);
    this.children.push({ anim, start, done: false });
    this.cursor = start + anim.total;
    this.total = Math.max(this.total, this.cursor);
    if (this._autoplay) this._ensure();
    return this;
  }

  _ensure() {
    if (this._queued) return;
    this._queued = true;
    schedule(this);
  }

  _tick(dt) {
    if (this.paused || this.completed) return;
    this.time += dt;
    for (const c of this.children) {
      if (this.time < c.start) continue;
      const local = Math.min(c.anim.total, this.time - c.start);
      if (!c.anim.began) {
        c.anim.began = true;
        if (c.anim.onBegin) c.anim.onBegin(c.anim);
      }
      c.anim._apply(local);
      if (c.anim.onUpdate) c.anim.onUpdate(c.anim);
      if (!c.done && this.time >= c.start + c.anim.total) {
        c.done = true;
        if (c.anim.onComplete) c.anim.onComplete(c.anim);
      }
    }
    if (this.time >= this.total) {
      this.completed = true;
      if (this.onComplete) this.onComplete(this);
      this._resolvers.forEach((r) => r(this));
    }
  }

  play() { this.paused = false; this._ensure(); return this; }
  pause() { this.paused = true; return this; }
}

// ---------- API publique ----------
export function tween(params) { return new Anim(params); }

tween.timeline = (defaults) => new Timeline(defaults);

tween.stagger = (value, opts = {}) => {
  return (el, i, total) => {
    let base = value, unit = '';
    if (typeof value === 'string') {
      const m = value.match(/^([\d.]+)(.*)$/);
      base = parseFloat(m[1]); unit = m[2] || '';
    }
    let range = null;
    if (Array.isArray(value)) { range = value; base = 0; }
    const from = opts.from;
    let idx = i;
    if (from === 'center') idx = Math.abs(i - (total - 1) / 2);
    else if (from === 'last') idx = total - 1 - i;
    else if (typeof from === 'number') idx = Math.abs(i - from);
    let v;
    if (range) {
      const t = total > 1 ? idx / (total - 1) : 0;
      v = range[0] + (range[1] - range[0]) * t;
    } else {
      v = base * idx;
    }
    if (opts.start) v += opts.start;
    return unit ? v + unit : v;
  };
};

tween.set = (targets, props) => {
  const els = toArray(targets);
  for (const el of els) {
    for (const [k, raw] of Object.entries(props)) {
      const v = parseValue(raw, k);
      setProp(el, k, v, v, 1);
    }
  }
};

tween.remove = (targets) => {
  const els = toArray(targets);
  for (let i = active.length - 1; i >= 0; i--) {
    const a = active[i];
    if (a.tracks) {
      a.tracks = a.tracks.filter((t) => !els.includes(t.target));
      if (!a.tracks.length) active.splice(i, 1);
    }
  }
};

tween.random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
tween.get = (target, prop) => getCurrent(target, prop);
tween.easings = EASINGS;
tween.running = active;

export default tween;
