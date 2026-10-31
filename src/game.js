/**
 * Weed Firm — game rules and economy.
 * Pure state + transitions so it can be unit-tested in Node.
 */

export const SAVE_VERSION = 5;
export const POD_COUNT = 6;
export const POD_COSTS = [0, 0, 0, 900, 3200, 10000];

// Deliberately brisk: the first unlocks should land inside the first minute.
export const XP_TABLE = [
  0, 60, 160, 330, 580, 900, 1300, 1780, 2340, 2980, 3700, 4500, 5400,
  6400, 7500, 8700, 10000, 11400, 12900, 14500, 16200
];

const STRAIN_ROWS = [
  // id, name, type, thc, unlock, seed, grow, yield, price, bud color, effect
  ['northern', 'Northern Lights', 'INDICA', 17, 1, 14, 20, 9, 11, 0x6ee27a, 'Entspannend'],
  ['blue', 'Blue Dream', 'SATIVA', 19, 1, 26, 28, 13, 17, 0x79b8ff, 'Euphorisch'],
  ['afghani', 'Afghani', 'INDICA', 16, 2, 36, 30, 15, 21, 0x9bc46b, 'Körperruhe'],
  ['ak47', 'AK-47', 'SATIVA', 19, 2, 52, 34, 17, 25, 0xb9d96b, 'Kreativ'],
  ['blueberry', 'Blueberry', 'INDICA', 17, 3, 68, 36, 18, 30, 0x7f8dff, 'Glücklich'],
  ['bubblegum', 'Bubblegum', 'INDICA', 17, 3, 88, 38, 20, 34, 0xd98bd9, 'Aufheiternd'],
  ['og', 'OG Kush', 'HYBRID', 20, 4, 110, 40, 21, 40, 0x9bd96b, 'Schwer'],
  ['cheese', 'Cheese', 'HYBRID', 17, 4, 135, 43, 22, 45, 0xc9c96b, 'Gesprächig'],
  ['durban', 'Durban Poison', 'SATIVA', 20, 5, 165, 46, 24, 52, 0xb3d96b, 'Energetisierend'],
  ['dutch', 'Dutch Treat', 'INDICA', 18, 5, 195, 50, 26, 58, 0x8fc46b, 'Süß & ruhig'],
  ['g13', 'G13', 'HYBRID', 20, 6, 235, 54, 28, 66, 0x9adf8a, 'Couchdrücker'],
  ['gsc', 'Girl Scout Cookies', 'HYBRID', 22, 6, 280, 58, 30, 74, 0xc9a06b, 'Glückselig'],
  ['gorilla', 'Gorilla Glue #4', 'HYBRID', 25, 7, 340, 62, 32, 84, 0x9adf8a, 'Klebrig'],
  ['grape', 'Grape Ape', 'INDICA', 20, 7, 390, 66, 34, 92, 0xa07bff, 'Sedierend'],
  ['haze', 'Haze', 'SATIVA', 21, 8, 460, 70, 36, 102, 0xcf7bff, 'Zerebral'],
  ['headband', 'Headband', 'HYBRID', 20, 8, 530, 76, 38, 112, 0xb9c46b, 'Fokussiert'],
  ['hindu', 'Hindu Kush', 'INDICA', 20, 9, 620, 80, 40, 124, 0x8fc46b, 'Müde'],
  ['jack', 'Jack Herer', 'SATIVA', 21, 9, 710, 86, 42, 136, 0xbfe07a, 'Motiviert'],
  ['krypto', 'Kryptonite', 'INDICA', 20, 10, 820, 92, 44, 150, 0x7be0a3, 'Verträumt'],
  ['la', 'LA Confidential', 'INDICA', 20, 10, 930, 98, 46, 164, 0x9bc46b, 'Ruhig'],
  ['pineapple', 'Pineapple', 'HYBRID', 18, 11, 1060, 102, 48, 180, 0xe0c35a, 'Sonnig'],
  ['skunk', 'Skunk #1', 'HYBRID', 19, 11, 1200, 108, 50, 196, 0xa9d96b, 'Klassiker'],
  ['sour', 'Sour Diesel', 'SATIVA', 22, 12, 1360, 112, 52, 214, 0xc3e95f, 'Elektrisch'],
  ['tangerine', 'Tangerine', 'SATIVA', 18, 12, 1520, 118, 54, 232, 0xffb35c, 'Strahlend'],
  ['trainwreck', 'Trainwreck', 'SATIVA', 20, 13, 1720, 124, 57, 254, 0xb9d96b, 'Rasend'],
  ['whitewidow', 'White Widow', 'HYBRID', 22, 13, 1940, 130, 60, 276, 0xd9e8d0, 'Ausgeglichen'],
  ['zkittlez', 'Zkittlez', 'INDICA', 23, 14, 2200, 136, 63, 300, 0xc9a0ff, 'Fruchtig'],
  ['candyland', 'Candyland', 'SATIVA', 20, 14, 2480, 142, 66, 324, 0xff9bd0, 'Verspielt'],
  ['wedding', 'Wedding Cake', 'INDICA', 25, 15, 2800, 148, 70, 350, 0xffd27a, 'Reichhaltig'],
  ['purplehaze', 'Purple Haze', 'SATIVA', 22, 15, 3150, 154, 74, 378, 0xcf7bff, 'Trippy'],
  ['gelato', 'Gelato', 'HYBRID', 24, 16, 3550, 160, 78, 410, 0xb07bff, 'Dessert'],
  ['runtz', 'Runtz', 'HYBRID', 26, 16, 4000, 166, 82, 442, 0xff9bd0, 'Süß']
];

const NOTES = {
  northern: 'Schnell, verzeihend, immer gefragt.',
  blue: 'Süße Beeren. Die Leute lieben sie.',
  afghani: 'Alte Hash-Pflanze. Schwer harzig.',
  ak47: 'Ein Zug, der sitzt. Geht schnell weg.',
  blueberry: 'Beerige Terpene, lila Fade.',
  bubblegum: 'Rosa Blüten, Kaugummi-Nase.',
  og: 'Laut, gasig, Premium-Regal.',
  cheese: 'Funky, stechend, Kultklassiker.',
  durban: 'Reine Sativa. Kein Couchdrücker.',
  dutch: 'Süß, würzig, leicht anzubauen.',
  g13: 'Regierungsexperiment. Klebrig.',
  gsc: 'Minzige Cookies. Kuchenbasar.',
  gorilla: 'Dicht, klebrig, Premium-Gewicht.',
  grape: 'Traubenbonbon, lila Frost.',
  haze: 'Legendär. Sammler zahlen gut.',
  headband: 'Zitrone-Diesel. Headband-High.',
  hindu: 'Uralter Kush. Reine Schlafhilfe.',
  jack: 'Kiefer und Zitrus, Tageslegende.',
  krypto: 'Kryptischer Name, kosmisches High.',
  la: 'Sanft, erdig, altes Geld.',
  pineapple: 'Tropisch, sonnig, laut.',
  skunk: 'Der originale Skunk. Nostalgie.',
  sour: 'Dieselbiss. Verkauft sich selbst.',
  tangerine: 'Zitrusnote. Stimmungsheber.',
  trainwreck: 'Nach dem Abgang benannt. Festhalten.',
  whitewidow: 'Frostig weiß, ausgewogenes High.',
  zkittlez: 'Regenbogenbonbon. Frucht vorne.',
  candyland: 'Süße Sativa. Party-Starter.',
  wedding: 'Das Hausrezept. Reiner Profit.',
  purplehaze: 'Lila, psychedelisch, ikonisch.',
  gelato: 'Dessert-Terpene. Boutique-Preise.',
  runtz: 'Seltenes Bonbon. Ganz oben auf der Karte.'
};

export const STRAINS = STRAIN_ROWS.map(([id, name, type, thc, level, seed, grow, yieldGrams, price, bud, effect]) => ({
  id, name, type, thc, level, seed, grow, yield: yieldGrams, price, bud, effect,
  accent: '#' + bud.toString(16).padStart(6, '0'),
  note: NOTES[id] || ''
}));

export const ITEMS = {
  fertilizer: {
    name: 'Blüte-Booster', icon: 'flask', price: 45,
    desc: 'Düngt eine Pflanze: +30 % Wachstum, +6 % Qualität in diesem Zyklus.'
  }
};

export const UPGRADES = {
  lights: {
    name: 'LED-Array', icon: 'sun', base: 180, mult: 2.0, max: 8,
    desc: 'Vollspektrum-Leistung. Pflanzen werden schneller fertig.',
    effect: level => `+${level * 12} % Wachstumstempo`
  },
  nutes: {
    name: 'Nährstoff-Linie', icon: 'drop', base: 240, mult: 2.1, max: 8,
    desc: 'Individueller Düngeplan. Mehr Gewicht pro Pflanze.',
    effect: level => `+${level * 8} % Ertrag · +${(level * 2).toFixed(0)} % Qualität`
  },
  pots: {
    name: 'Smart Pots', icon: 'pot', base: 320, mult: 2.05, max: 6,
    desc: 'Luftbeschnittene Wurzeln. Gesündere, schwerere Pflanzen.',
    effect: level => `+${level * 6} % Ertrag · +${(level * 1.5).toFixed(1).replace('.', ',')} % Qualität`
  },
  security: {
    name: 'Sicherheit', icon: 'shield', base: 300, mult: 2.15, max: 8,
    desc: 'Kameras, Schlösser und ein freundlicher Anwalt.',
    effect: level => `-${level * 9} % Hitze · -${level * 10} % Verlust bei Razzia`
  },
  genetics: {
    name: 'Genetik-Labor', icon: 'dna', base: 420, mult: 2.3, max: 6,
    desc: 'Pheno-Jagd. Bessere Optik, bessere Preise.',
    effect: level => `+${level * 4} % Preis · +${(level * 1.2).toFixed(1).replace('.', ',')} % Qualität`
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function strainById(id) {
  return STRAINS.find(strain => strain.id === id) || STRAINS[0];
}

export function levelFromXp(xp) {
  let level = 1;
  for (let i = 0; i < XP_TABLE.length; i++) if (xp >= XP_TABLE[i]) level = i + 1;
  return level;
}

export function xpForLevel(level) {
  return XP_TABLE[clamp(level - 1, 0, XP_TABLE.length - 1)];
}

export function nextLevelXp(level) {
  return XP_TABLE[clamp(level, 0, XP_TABLE.length - 1)];
}

export function isStrainUnlocked(state, strainId) {
  return state.level >= strainById(strainId).level;
}

export function upgradeCost(key, level) {
  const def = UPGRADES[key];
  return Math.round(def.base * Math.pow(def.mult, level));
}

export function podCost(index) {
  return POD_COSTS[index] ?? 0;
}

export function createInitialState(now = Date.now()) {
  const market = {};
  const seeds = {};
  for (const strain of STRAINS) {
    market[strain.id] = 1;
    seeds[strain.id] = 0;
  }
  seeds.northern = 1;
  seeds.blue = 2;
  market.blue = 1.18;
  market.northern = 0.94;
  market.og = 1.06;

  return {
    version: SAVE_VERSION,
    started: false,
    cash: 320,
    xp: 25,
    level: 1,
    heat: 0,
    raidCooldown: 0,
    marketClock: 0,
    market,
    marketPrev: { ...market },
    seeds,
    items: { fertilizer: 1 },
    lots: [
      { id: 'lot-1', strainId: 'blue', grams: 3.4, quality: 0.84 }
    ],
    pods: [
      {
        unlocked: true,
        plant: { strainId: 'blue', progress: 1, water: 0.72, health: 1, watered: 2, fertilized: false, readyNotified: true }
      },
      {
        unlocked: true,
        plant: { strainId: 'blue', progress: 0.58, water: 0.34, health: 1, watered: 1, fertilized: false, readyNotified: false }
      },
      { unlocked: true, plant: null },
      { unlocked: false, plant: null },
      { unlocked: false, plant: null },
      { unlocked: false, plant: null }
    ],
    upgrades: { lights: 1, nutes: 0, pots: 0, security: 0, genetics: 0 },
    selectedStrain: 'blue',
    selectedPod: 0,
    tab: 'grow',
    sound: true,
    stats: { harvested: 0, grams: 0, sold: 0, revenue: 0, raids: 0, plants: 3 },
    nextLot: 2,
    savedAt: now,
    createdAt: now
  };
}

export function totalGrams(state) {
  return state.lots.reduce((sum, lot) => sum + lot.grams, 0);
}

export function readyPods(state) {
  return state.pods.reduce((list, pod, index) => {
    if (pod.plant && pod.plant.progress >= 1) list.push(index);
    return list;
  }, []);
}

export function growingPods(state) {
  return state.pods.reduce((list, pod, index) => {
    if (pod.plant && pod.plant.progress < 1) list.push(index);
    return list;
  }, []);
}

export function stageName(plant) {
  if (!plant) return 'Leer';
  if (plant.progress >= 1) return 'Erntereif';
  if (plant.progress >= 0.55) return 'Blüte';
  if (plant.progress >= 0.2) return 'Wachstum';
  return 'Sämling';
}

export function gradeFor(quality) {
  if (quality >= 0.95) return 'A+';
  if (quality >= 0.88) return 'A';
  if (quality >= 0.78) return 'B';
  if (quality >= 0.66) return 'C';
  return 'D';
}

export function growSpeed(state) {
  return 1 + 0.12 * state.upgrades.lights;
}

export function secondsLeft(state, plant) {
  if (!plant) return 0;
  const strain = strainById(plant.strainId);
  return Math.max(0, (1 - plant.progress) * strain.grow / (growSpeed(state) * (plant.fertilized ? 1.3 : 1)));
}

export function plantQuality(state, plant) {
  if (!plant) return 0;
  return clamp(
    0.55 + 0.35 * plant.health
      + 0.02 * state.upgrades.nutes
      + 0.015 * state.upgrades.pots
      + 0.012 * state.upgrades.genetics
      + (plant.fertilized ? 0.06 : 0),
    0.3, 1
  );
}

export function estimateYield(state, plant, random = () => 0.5) {
  if (!plant) return 0;
  const strain = strainById(plant.strainId);
  const quality = plantQuality(state, plant);
  const variation = 0.94 + random() * 0.12;
  const bonus = 1 + 0.08 * state.upgrades.nutes + 0.06 * state.upgrades.pots;
  return Math.max(1, Math.round(strain.yield * bonus * (0.72 + 0.38 * quality) * variation));
}

export function pricePerGram(state, strainId, quality) {
  const strain = strainById(strainId);
  const multiplier = state.market[strainId] ?? 1;
  return strain.price * (0.55 + 0.55 * quality) * multiplier * (1 + 0.04 * state.upgrades.genetics);
}

export function lotValue(state, lot) {
  return pricePerGram(state, lot.strainId, lot.quality) * lot.grams;
}

export function heatMultiplier(state) {
  return Math.max(0.25, 1 - 0.09 * state.upgrades.security);
}

export function addXp(state, amount) {
  const before = state.level;
  state.xp = Math.max(0, state.xp + amount);
  state.level = levelFromXp(state.xp);
  return state.level > before ? state.level : 0;
}

export function selectStrain(state, strainId) {
  if (!isStrainUnlocked(state, strainId)) return false;
  state.selectedStrain = strainId;
  return true;
}

export function seedCount(state, strainId) {
  return state.seeds[strainId] ?? 0;
}

export function buySeeds(state, strainId, quantity = 1) {
  const strain = strainById(strainId);
  if (!isStrainUnlocked(state, strainId)) return { ok: false, reason: 'locked' };
  const cost = strain.seed * quantity;
  if (state.cash < cost) return { ok: false, reason: 'cash' };
  state.cash -= cost;
  state.seeds[strainId] = (state.seeds[strainId] ?? 0) + quantity;
  return { ok: true, cost, quantity, strainId };
}

export function buyItem(state, itemId, quantity = 1) {
  const item = ITEMS[itemId];
  if (!item) return { ok: false, reason: 'missing' };
  const cost = item.price * quantity;
  if (state.cash < cost) return { ok: false, reason: 'cash' };
  state.cash -= cost;
  state.items[itemId] = (state.items[itemId] ?? 0) + quantity;
  return { ok: true, cost, quantity };
}

export function plantPod(state, index, { autoBuy = true } = {}) {
  const pod = state.pods[index];
  if (!pod) return { ok: false, reason: 'missing' };
  if (!pod.unlocked) return { ok: false, reason: 'locked' };
  if (pod.plant) return { ok: false, reason: 'occupied' };
  const strainId = state.selectedStrain;
  if (!isStrainUnlocked(state, strainId)) return { ok: false, reason: 'strain-locked' };
  const strain = strainById(strainId);

  let bought = false;
  let cost = 0;
  if (seedCount(state, strainId) > 0) {
    state.seeds[strainId] -= 1;
  } else if (autoBuy) {
    if (state.cash < strain.seed) return { ok: false, reason: 'cash' };
    state.cash -= strain.seed;
    cost = strain.seed;
    bought = true;
  } else {
    return { ok: false, reason: 'no-seed' };
  }

  pod.plant = {
    strainId,
    progress: 0,
    water: 1,
    health: 1,
    watered: 0,
    fertilized: false,
    readyNotified: false,
    thirstyNotified: false
  };
  state.stats.plants += 1;
  return { ok: true, strainId, cost, bought };
}

export function waterPod(state, index) {
  const pod = state.pods[index];
  if (!pod?.plant || pod.plant.progress >= 1) return { ok: false, reason: 'no-plant' };
  const plant = pod.plant;
  const wasThirsty = plant.water <= 0.001;
  plant.water = 1;
  plant.health = Math.min(1, plant.health + 0.05);
  plant.watered += 1;
  plant.thirstyNotified = false;
  return { ok: true, wasThirsty };
}

export function applyFertilizer(state, index) {
  const pod = state.pods[index];
  if (!pod?.plant) return { ok: false, reason: 'no-plant' };
  if (pod.plant.progress >= 1) return { ok: false, reason: 'ready' };
  if (pod.plant.fertilized) return { ok: false, reason: 'already' };
  if ((state.items.fertilizer ?? 0) < 1) return { ok: false, reason: 'none' };
  state.items.fertilizer -= 1;
  pod.plant.fertilized = true;
  pod.plant.health = Math.min(1, pod.plant.health + 0.1);
  return { ok: true };
}

export function harvestPod(state, index, random = Math.random) {
  const pod = state.pods[index];
  if (!pod?.plant) return { ok: false, reason: 'empty' };
  if (pod.plant.progress < 1) return { ok: false, reason: 'not-ready' };

  const plant = pod.plant;
  const strain = strainById(plant.strainId);
  const quality = clamp(plantQuality(state, plant) + (random() - 0.5) * 0.03, 0.3, 1);
  const grams = estimateYield(state, plant, random);
  const value = pricePerGram(state, plant.strainId, quality) * grams;
  const heat = grams * 0.42 * heatMultiplier(state);

  state.lots.push({
    id: `lot-${state.nextLot++}`,
    strainId: plant.strainId,
    grams,
    quality: Math.round(quality * 100) / 100
  });
  state.heat = clamp(state.heat + heat, 0, 100);
  state.stats.harvested += 1;
  state.stats.grams += grams;
  const xp = Math.round(grams * 0.8 + value * 0.025);
  const levelUp = addXp(state, xp);

  pod.plant = null;
  return {
    ok: true,
    strainId: strain.id,
    strainName: strain.name,
    grams,
    quality,
    grade: gradeFor(quality),
    value,
    xp,
    levelUp
  };
}

export function sellLot(state, lotId) {
  const index = state.lots.findIndex(lot => lot.id === lotId);
  if (index < 0) return { ok: false, reason: 'missing' };
  const lot = state.lots[index];
  const value = Math.round(lotValue(state, lot));
  const strain = strainById(lot.strainId);

  state.cash += value;
  state.stats.sold += lot.grams;
  state.stats.revenue += value;
  state.heat = clamp(state.heat + value * 0.014 * heatMultiplier(state), 0, 100);
  const xp = value * 0.06;
  const levelUp = addXp(state, xp);
  state.lots.splice(index, 1);
  return { ok: true, value, grams: lot.grams, strainName: strain.name, levelUp, xp };
}

export function sellAll(state) {
  let value = 0;
  let grams = 0;
  let levelUp = 0;
  for (const lot of [...state.lots]) {
    const result = sellLot(state, lot.id);
    if (result.ok) {
      value += result.value;
      grams += result.grams;
      levelUp = Math.max(levelUp, result.levelUp || 0);
    }
  }
  return { ok: value > 0, value, grams, levelUp };
}

export function buyUpgrade(state, key) {
  const def = UPGRADES[key];
  if (!def) return { ok: false, reason: 'missing' };
  const level = state.upgrades[key] ?? 0;
  if (level >= def.max) return { ok: false, reason: 'maxed' };
  const cost = upgradeCost(key, level);
  if (state.cash < cost) return { ok: false, reason: 'cash' };
  state.cash -= cost;
  state.upgrades[key] = level + 1;
  return { ok: true, cost, level: level + 1 };
}

export function unlockPod(state, index) {
  const pod = state.pods[index];
  if (!pod) return { ok: false, reason: 'missing' };
  if (pod.unlocked) return { ok: false, reason: 'unlocked' };
  const cost = podCost(index);
  if (state.cash < cost) return { ok: false, reason: 'cash' };
  state.cash -= cost;
  pod.unlocked = true;
  return { ok: true, cost };
}

export function raid(state, random = Math.random) {
  const security = state.upgrades.security;
  const lossFraction = Math.min(0.5, 0.28 / (1 + 0.18 * security));
  let lost = 0;
  for (const lot of state.lots) {
    const grams = lot.grams * lossFraction;
    lot.grams = Math.max(0, lot.grams - grams);
    lost += grams;
  }
  state.lots = state.lots.filter(lot => lot.grams >= 0.3);
  const fine = Math.round(Math.min(state.cash * 0.08, 2500));
  state.cash = Math.max(0, state.cash - fine);
  state.heat = 15;
  state.raidCooldown = 14;
  state.stats.raids += 1;
  return { lost: Math.round(lost * 10) / 10, fine, security };
}

/**
 * Advance the simulation. dt is in seconds. Returns notable events.
 * @returns {Array<{type:string, [key:string]:any}>}
 */
export function tick(state, dt, random = Math.random) {
  if (!(dt > 0)) return [];
  const events = [];
  const speed = growSpeed(state);

  state.pods.forEach((pod, index) => {
    const plant = pod.plant;
    if (!plant || plant.progress >= 1) return;
    const strain = strainById(plant.strainId);
    const boost = plant.fertilized ? 1.3 : 1;
    plant.progress = Math.min(1, plant.progress + (dt * speed * boost) / strain.grow);
    plant.water = Math.max(0, plant.water - dt / (strain.grow * 0.72));

    if (plant.water <= 0) {
      plant.health = Math.max(0.18, plant.health - dt * 0.055);
      if (!plant.thirstyNotified) {
        plant.thirstyNotified = true;
        events.push({ type: 'thirsty', pod: index, strainId: plant.strainId });
      }
    }

    if (plant.progress >= 1) {
      plant.water = Math.max(plant.water, 0.25);
      if (!plant.readyNotified) {
        plant.readyNotified = true;
        events.push({ type: 'ready', pod: index, strainId: plant.strainId });
      }
    }
  });

  state.marketClock += dt;
  if (state.marketClock >= 7) {
    state.marketClock = 0;
    state.marketPrev = { ...state.market };
    for (const strain of STRAINS) {
      const current = state.market[strain.id] ?? 1;
      const drift = (random() - 0.48) * 0.14 + (1 - current) * 0.1;
      state.market[strain.id] = clamp(current + drift, 0.72, 1.38);
    }
    events.push({ type: 'market' });
  }

  state.heat = Math.max(0, state.heat - dt * (0.05 + 0.012 * state.upgrades.security));
  if (state.raidCooldown > 0) state.raidCooldown = Math.max(0, state.raidCooldown - dt);

  if (state.heat >= 100 && state.raidCooldown <= 0) {
    const result = raid(state, random);
    events.push({ type: 'raid', ...result });
  }

  return events;
}

/** Fast-forward up to `seconds`, used for offline growth on load. */
export function advance(state, seconds, random = Math.random) {
  if (!(seconds > 0)) return [];
  const total = Math.min(seconds, 60 * 60 * 4);
  const events = [];
  for (let elapsed = 0; elapsed < total; elapsed += 1) {
    events.push(...tick(state, 1, random));
  }
  return events;
}

export function formatMoney(value) {
  const amount = Math.max(0, Math.round(value));
  return '$' + amount.toLocaleString('de-DE');
}

export function formatGrams(value) {
  if (value >= 1000) return (value / 1000).toFixed(2).replace('.', ',') + ' kg';
  return String(Math.round(value * 10) / 10).replace('.', ',') + ' g';
}
