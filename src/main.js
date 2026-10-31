import {
  SAVE_VERSION, createInitialState, advance, tick, strainById, formatMoney, formatGrams
} from './game.js';
import { GrowScene } from './scene.js';
import { Sfx } from './audio.js';
import { Ui } from './ui.js';

const SAVE_KEY = 'weedfirm.save.v5';

function loadState() {
  let parsed;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || parsed.version !== SAVE_VERSION) return null;
  if (!Array.isArray(parsed.pods) || parsed.pods.length !== 6) return null;

  const base = createInitialState();
  const state = {
    ...base,
    ...parsed,
    seeds: { ...base.seeds, ...(parsed.seeds || {}) },
    items: { ...base.items, ...(parsed.items || {}) },
    market: { ...base.market, ...(parsed.market || {}) },
    upgrades: { ...base.upgrades, ...(parsed.upgrades || {}) },
    stats: { ...base.stats, ...(parsed.stats || {}) },
    pods: parsed.pods.map((pod, index) => ({
      unlocked: Boolean(pod.unlocked),
      plant: pod.plant
        ? { ...base.pods[index].plant, ...pod.plant, strainId: pod.plant.strainId }
        : null
    }))
  };
  state.level = parsed.level || 1;
  state.version = SAVE_VERSION;
  return state;
}

const loaded = loadState();
const state = loaded || createInitialState();
const loadedAt = loaded ? Date.now() : 0;

const sfx = new Sfx();
sfx.enabled = state.sound !== false;

let saveHandle = 0;
function save() {
  try {
    state.savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be blocked — game still works for this session */
  }
}

const scene = new GrowScene(document.getElementById('scene'), state, {
  onPick: index => ui.selectPod(index)
});

const ui = new Ui({ state, sfx, scene, save });

// Offline growth: keep it short so a returning player never loses a stash to a raid.
if (loaded && state.started) {
  const elapsed = Math.min(1800, Math.max(0, (loadedAt - (loaded.savedAt || loadedAt)) / 1000));
  if (elapsed > 30) {
    advance(state, elapsed);
    ui.renderActive(true);
    const stash = formatMoney(state.cash);
    setTimeout(() => ui.toast('Willkommen zurück', `Dein Garten wuchs weiter · ${stash} in der Kasse`, 'info', 'leaf'), 2200);
  }
}

const particles = { step: 0 };
let last = performance.now();
let uiTimer = 0;
let saveTimer = 0;

function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'ready') {
      sfx.ready();
      ui.toast('Erntereif', `${strainById(event.strainId).name} · Topf ${event.pod + 1}`, 'success', 'check');
    } else if (event.type === 'thirsty') {
      ui.toast('Pflanze ist durstig', `${strainById(event.strainId).name} · Topf ${event.pod + 1}`, 'warn', 'drop');
    } else if (event.type === 'raid') {
      sfx.raid();
      ui.toast('RAZZIA!', `Beschlagnahmt ${formatGrams(event.lost)} · Strafe ${formatMoney(event.fine)}`, 'danger', 'shield');
      document.body.classList.add('raid');
      setTimeout(() => document.body.classList.remove('raid'), 900);
      ui.renderActive(true);
    } else if (event.type === 'market' && ui.activeTab === 'market') {
      ui.renderActive(true);
    }
  }
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (state.started) {
    const events = tick(state, dt);
    if (events.length) handleEvents(events);
  }

  scene.update(dt);
  ui.updateMarkers();

  uiTimer += dt;
  if (uiTimer > 0.11) {
    uiTimer = 0;
    ui.updateHud();
    ui.updateLive();
  }

  if (state.started) {
    saveTimer += dt;
    if (saveTimer > 5) {
      saveTimer = 0;
      save();
    }
  }

  particles.step += 1;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});
window.addEventListener('pagehide', save);
window.addEventListener('beforeunload', save);

window.__weedfirm = { state, scene, ui };
