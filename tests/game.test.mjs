import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STRAINS, ITEMS, UPGRADES, XP_TABLE, POD_COSTS,
  createInitialState, strainById, levelFromXp, xpForLevel, nextLevelXp,
  isStrainUnlocked, upgradeCost, podCost, totalGrams, readyPods, growingPods,
  stageName, gradeFor, growSpeed, secondsLeft, plantQuality, estimateYield,
  pricePerGram, lotValue, heatMultiplier, addXp, selectStrain, seedCount,
  buySeeds, buyItem, plantPod, waterPod, applyFertilizer, harvestPod,
  sellLot, sellAll, buyUpgrade, unlockPod, raid, tick, advance,
  formatMoney, formatGrams
} from '../src/game.js';

const fresh = () => createInitialState(1_700_000_000_000);
const plant = (strainId = 'northern', progress = 0.5, water = 1, health = 1) => ({
  strainId, progress, water, health, watered: 1, fertilized: false,
  readyNotified: false, thirstyNotified: false
});

test('new game starts with a small, playable stash', () => {
  const state = fresh();
  assert.equal(state.cash, 320);
  assert.equal(state.level, 1);
  assert.equal(state.xp, 25);
  assert.equal(state.pods.filter(pod => pod.unlocked).length, 3);
  assert.equal(state.seeds.blue, 2);
  assert.equal(state.seeds.northern, 1);
  assert.equal(state.items.fertilizer, 1);
  assert.equal(totalGrams(state), 3.4);
  assert.deepEqual(readyPods(state), [0]);
  assert.deepEqual(growingPods(state), [1]);
});

test('german labels and number formatting', () => {
  assert.equal(stageName(null), 'Leer');
  assert.equal(stageName({ progress: 0.1 }), 'Sämling');
  assert.equal(stageName({ progress: 0.3 }), 'Wachstum');
  assert.equal(stageName({ progress: 0.6 }), 'Blüte');
  assert.equal(stageName({ progress: 1 }), 'Erntereif');
  assert.equal(gradeFor(0.96), 'A+');
  assert.equal(gradeFor(0.9), 'A');
  assert.equal(gradeFor(0.8), 'B');
  assert.equal(gradeFor(0.7), 'C');
  assert.equal(gradeFor(0.4), 'D');
  assert.equal(formatMoney(1234), '$1.234');
  assert.equal(formatMoney(29.6), '$30');
  assert.equal(formatMoney(-5), '$0');
  assert.equal(formatGrams(3.4), '3,4 g');
  assert.equal(formatGrams(12), '12 g');
  assert.equal(formatGrams(1234), '1,23 kg');
});

test('strain catalogue is fully german and unlocks by level', () => {
  assert.equal(STRAINS.length, 32);
  assert.ok(STRAINS.every(strain => strain.note.length > 0));
  assert.ok(STRAINS.every(strain => /^[\p{L}0-9 #&\-]+$/u.test(strain.effect)));
  assert.equal(ITEMS.fertilizer.name, 'Blüte-Booster');
  assert.equal(UPGRADES.security.name, 'Sicherheit');
  assert.equal(ITEMS.fertilizer.desc.includes('Wachstum'), true);

  const state = fresh();
  assert.equal(isStrainUnlocked(state, 'northern'), true);
  assert.equal(isStrainUnlocked(state, 'afghani'), false);
  state.level = 2;
  assert.equal(isStrainUnlocked(state, 'afghani'), true);
  assert.equal(isStrainUnlocked(state, 'blueberry'), false);
  state.level = 16;
  assert.equal(isStrainUnlocked(state, 'runtz'), true);
});

test('xp curve reaches the first unlocks quickly', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(59), 1);
  assert.equal(levelFromXp(60), 2);
  assert.equal(levelFromXp(160), 3);
  assert.equal(levelFromXp(999999), XP_TABLE.length);
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 60);
  assert.equal(nextLevelXp(1), 60);
  assert.equal(nextLevelXp(2), 160);

  const state = fresh();
  const gained = addXp(state, 35);
  assert.equal(gained, 2);
  assert.equal(state.level, 2);
  assert.equal(addXp(state, 0), 0);
});

test('planting consumes stock, buys seeds when needed and guards pods', () => {
  const state = fresh();
  const first = plantPod(state, 2);
  assert.deepEqual(first, { ok: true, strainId: 'blue', cost: 0, bought: false });
  assert.equal(state.seeds.blue, 1);
  assert.equal(state.pods[2].plant.strainId, 'blue');
  assert.equal(state.pods[2].plant.water, 1);
  assert.equal(state.stats.plants, 4);

  assert.equal(plantPod(state, 2).reason, 'occupied');
  assert.equal(plantPod(state, 3).reason, 'locked');

  state.seeds.northern = 0;
  const bought = plantPod(state, 1, { autoBuy: true });
  assert.equal(bought.reason, 'occupied');

  state.seeds.blue = 0;
  state.cash = 320;
  const paid = plantPod(state, 4, { autoBuy: true });
  assert.equal(paid.reason, 'locked');

  state.pods[4].unlocked = true;
  const autoBought = plantPod(state, 4, { autoBuy: true });
  assert.equal(autoBought.ok, true);
  assert.equal(autoBought.bought, true);
  assert.equal(autoBought.cost, strainById('blue').seed);
  assert.equal(state.cash, 320 - strainById('blue').seed);

  state.pods[5].unlocked = true;
  state.seeds.blue = 0;
  assert.equal(plantPod(state, 5, { autoBuy: false }).reason, 'no-seed');

  state.seeds.blue = 0;
  state.cash = 1;
  assert.equal(plantPod(state, 5).reason, 'cash');

  state.selectedStrain = 'runtz';
  assert.equal(plantPod(state, 5).reason, 'strain-locked');
});

test('watering refills the tank, heals a little and rejects invalid pots', () => {
  const state = fresh();
  state.pods[1].plant.water = 0.2;
  state.pods[1].plant.health = 0.6;
  const result = waterPod(state, 1);
  assert.deepEqual(result, { ok: true, wasThirsty: false });
  assert.equal(state.pods[1].plant.water, 1);
  assert.equal(state.pods[1].plant.watered, 2);
  assert.equal(state.pods[1].plant.health, 0.65);

  state.pods[1].plant.water = 0;
  assert.equal(waterPod(state, 1).wasThirsty, true);
  assert.equal(waterPod(state, 2).reason, 'no-plant');
  assert.equal(waterPod(state, 0).reason, 'no-plant');
  assert.equal(waterPod(state, 9).reason, 'no-plant');
});

test('fertilizer is limited to one boost per cycle', () => {
  const state = fresh();
  const applied = applyFertilizer(state, 1);
  assert.deepEqual(applied, { ok: true });
  assert.equal(state.items.fertilizer, 0);
  assert.equal(state.pods[1].plant.fertilized, true);
  assert.equal(state.pods[1].plant.health, 1);

  assert.equal(applyFertilizer(state, 1).reason, 'already');
  assert.equal(applyFertilizer(state, 2).reason, 'no-plant');
  assert.equal(applyFertilizer(state, 0).reason, 'ready');

  state.pods[2].plant = plant('northern', 0.2);
  assert.equal(applyFertilizer(state, 2).reason, 'none');

  state.items.fertilizer = 1;
  state.pods[2].plant.health = 0.5;
  assert.equal(applyFertilizer(state, 2).ok, true);
  assert.equal(state.pods[2].plant.health, 0.6);
});

test('growth, water drain, thirst and market drift tick correctly', () => {
  const state = fresh();
  state.pods[2].plant = plant('northern', 0, 1);
  const speed = growSpeed(state);
  assert.equal(speed, 1.12);

  tick(state, 10, () => 0.5);
  assert.ok(Math.abs(state.pods[2].plant.progress - (10 * speed) / 20) < 0.0001);
  assert.ok(Math.abs(state.pods[2].plant.water - (1 - 10 / (20 * 0.72))) < 0.0001);
  assert.equal(state.pods[2].plant.health, 1);

  state.pods[2].plant.water = 0.01;
  const events = tick(state, 1, () => 0.5);
  assert.equal(state.pods[2].plant.water, 0);
  assert.ok(events.some(event => event.type === 'thirsty'));
  assert.ok(state.pods[2].plant.health < 1);
  assert.equal(tick(state, 1, () => 0.5).filter(event => event.type === 'thirsty').length, 0);

  // A ripe plant is clamped and announced exactly once.
  const ripe = fresh();
  ripe.pods[2].plant = plant('northern', 0.99, 1);
  const readyEvents = tick(ripe, 5, () => 0.5);
  assert.equal(ripe.pods[2].plant.progress, 1);
  assert.ok(ripe.pods[2].plant.water >= 0.25);
  assert.ok(readyEvents.some(event => event.type === 'ready'));
  assert.equal(tick(ripe, 5, () => 0.5).filter(event => event.type === 'ready').length, 0);

  // Market moves every seven seconds and stays inside its band.
  const market = fresh();
  market.marketClock = 6.8;
  const marketEvents = tick(market, 0.4, () => 0.5);
  assert.ok(marketEvents.some(event => event.type === 'market'));
  assert.equal(market.marketClock, 0);
  for (const strain of STRAINS) {
    assert.ok(market.market[strain.id] >= 0.72 && market.market[strain.id] <= 1.38);
  }

  // Heat cools down, minus security.
  const cooled = fresh();
  cooled.heat = 50;
  tick(cooled, 10, () => 0.5);
  assert.ok(Math.abs(cooled.heat - 49.5) < 1e-9);

  assert.deepEqual(tick(fresh(), 0), []);
  assert.deepEqual(tick(fresh(), -2), []);
});

test('harvest requires a ripe plant, fills the stash and pays xp', () => {
  const state = fresh();
  assert.equal(harvestPod(state, 1).reason, 'not-ready');
  assert.equal(harvestPod(state, 2).reason, 'empty');

  const xpBefore = state.xp;
  const result = harvestPod(state, 0, () => 0.5);
  assert.equal(result.ok, true);
  assert.equal(result.strainId, 'blue');
  assert.ok(result.grams >= 1);
  assert.ok(result.value > 0);
  assert.ok(result.xp > 0);
  assert.ok(['A+', 'A', 'B', 'C', 'D'].includes(result.grade));
  assert.equal(state.pods[0].plant, null);
  assert.equal(state.lots.length, 2);
  assert.equal(state.lots[1].strainId, 'blue');
  assert.equal(state.stats.harvested, 1);
  assert.ok(state.xp > xpBefore);
  assert.ok(state.heat > 0);

  // A harvest can push the player into the next level, unlocking strains.
  const leveling = fresh();
  leveling.xp = 59;
  const leveled = harvestPod(leveling, 0, () => 0.5);
  assert.equal(leveled.levelUp, 2);
  assert.equal(leveling.level, 2);
  assert.equal(isStrainUnlocked(leveling, 'afghani'), true);
});

test('selling lots and selling everything convert stash into cash', () => {
  const state = fresh();
  const before = state.cash;
  const sale = sellLot(state, 'lot-1');
  assert.equal(sale.ok, true);
  assert.equal(sale.grams, 3.4);
  assert.equal(sale.strainName, 'Blue Dream');
  assert.ok(sale.value > 0);
  assert.equal(state.cash, before + sale.value);
  assert.equal(state.lots.length, 0);
  assert.equal(state.stats.sold, 3.4);
  assert.equal(state.stats.revenue, sale.value);
  assert.equal(sellLot(state, 'lot-1').reason, 'missing');

  const bulk = fresh();
  bulk.lots.push({ id: 'lot-2', strainId: 'northern', grams: 5, quality: 0.8 });
  const all = sellAll(bulk);
  assert.equal(all.ok, true);
  assert.equal(bulk.lots.length, 0);
  assert.ok(all.value > 0);
  assert.ok(all.grams > 3.4);
  assert.equal(sellAll(bulk).ok, false);
});

test('seed, item and upgrade purchases respect cash and caps', () => {
  const state = fresh();
  assert.equal(buySeeds(state, 'afghani').reason, 'locked');
  state.level = 2;
  state.cash = 1000;
  const seeds = buySeeds(state, 'afghani', 2);
  assert.equal(seeds.ok, true);
  assert.equal(seeds.cost, strainById('afghani').seed * 2);
  assert.equal(state.seeds.afghani, 2);
  state.cash = 0;
  assert.equal(buySeeds(state, 'afghani').reason, 'cash');

  state.cash = 1000;
  const item = buyItem(state, 'fertilizer', 2);
  assert.equal(item.ok, true);
  assert.equal(state.items.fertilizer, 3);
  assert.equal(buyItem(state, 'nope').reason, 'missing');

  const upgrades = fresh();
  upgrades.cash = 1000;
  const lights = buyUpgrade(upgrades, 'lights');
  assert.equal(lights.ok, true);
  assert.equal(lights.level, 2);
  assert.equal(upgrades.cash, 1000 - upgradeCost('lights', 1));
  assert.equal(upgradeCost('lights', 1), Math.round(UPGRADES.lights.base * UPGRADES.lights.mult));

  upgrades.cash = 10;
  assert.equal(buyUpgrade(upgrades, 'lights').reason, 'cash');
  upgrades.cash = 100000;
  upgrades.upgrades.lights = UPGRADES.lights.max;
  assert.equal(buyUpgrade(upgrades, 'lights').reason, 'maxed');
  assert.equal(buyUpgrade(upgrades, 'nope').reason, 'missing');
});

test('unlocking pots charges the listed price once', () => {
  const state = fresh();
  assert.equal(podCost(0), 0);
  assert.equal(podCost(3), POD_COSTS[3]);
  assert.equal(podCost(9), 0);

  assert.equal(unlockPod(state, 3).reason, 'cash');
  state.cash = 1500;
  const unlock = unlockPod(state, 3);
  assert.equal(unlock.ok, true);
  assert.equal(unlock.cost, POD_COSTS[3]);
  assert.equal(state.cash, 1500 - POD_COSTS[3]);
  assert.equal(state.pods[3].unlocked, true);
  assert.equal(unlockPod(state, 3).reason, 'unlocked');
  assert.equal(unlockPod(state, 9).reason, 'missing');
});

test('raids seize product, fine the player and go on cooldown', () => {
  const state = fresh();
  state.cash = 1000;
  state.heat = 100;
  state.lots = [{ id: 'lot-9', strainId: 'blue', grams: 10, quality: 0.9 }];

  const result = raid(state);
  assert.equal(result.lost, 2.8);
  assert.equal(result.fine, 80);
  assert.equal(state.cash, 920);
  assert.equal(state.heat, 15);
  assert.equal(state.raidCooldown, 14);
  assert.equal(state.stats.raids, 1);
  assert.ok(Math.abs(state.lots[0].grams - 7.2) < 1e-9);

  const guarded = fresh();
  guarded.lots = [{ id: 'lot-9', strainId: 'blue', grams: 10, quality: 0.9 }];
  guarded.upgrades.security = 4;
  const guardedResult = raid(guarded);
  assert.ok(guardedResult.lost < result.lost);
  assert.equal(guardedResult.security, 4);

  const hot = fresh();
  hot.heat = 110;
  hot.lots = [{ id: 'lot-9', strainId: 'blue', grams: 10, quality: 0.9 }];
  const events = tick(hot, 0.1, () => 0.5);
  assert.ok(events.some(event => event.type === 'raid'));
  assert.equal(hot.stats.raids, 1);
});

test('prices, yields and timers follow upgrades', () => {
  const state = fresh();
  state.pods[1].plant.health = 0.5;
  const quality = plantQuality(state, state.pods[1].plant);
  assert.ok(quality > 0.3 && quality <= 1);

  const yieldLow = estimateYield(state, state.pods[1].plant, () => 0);
  const yieldHigh = estimateYield(state, state.pods[1].plant, () => 1);
  assert.ok(yieldHigh > yieldLow);

  const base = pricePerGram(state, 'blue', 0.8);
  const lot = { strainId: 'blue', grams: 4, quality: 0.8 };
  assert.equal(lotValue(state, lot), base * 4);

  state.market.blue = 1.38;
  assert.ok(pricePerGram(state, 'blue', 0.8) > base);
  state.upgrades.genetics = 3;
  assert.ok(pricePerGram(state, 'blue', 0.8) > base);

  assert.ok(secondsLeft(state, state.pods[1].plant) > 0);
  assert.equal(secondsLeft(state, null), 0);
  assert.equal(secondsLeft(state, { ...state.pods[1].plant, progress: 1 }), 0);

  state.upgrades.security = 2;
  assert.ok(heatMultiplier(state) < 1);
  state.upgrades.security = 50;
  assert.equal(heatMultiplier(state), 0.25);
});

test('selecting strains is limited to unlocked genetics', () => {
  const state = fresh();
  assert.equal(selectStrain(state, 'blue'), true);
  assert.equal(state.selectedStrain, 'blue');
  assert.equal(selectStrain(state, 'runtz'), false);
  assert.equal(state.selectedStrain, 'blue');
  assert.equal(seedCount(state, 'blue'), 2);
  assert.equal(seedCount(state, 'nope'), 0);
});

test('offline advance fast-forwards but is capped at four hours', () => {
  const state = fresh();
  state.pods[2].plant = plant('northern', 0);
  advance(state, 30, () => 0.55);
  assert.ok(state.pods[2].plant.progress > 1 - 1e-9);
  assert.deepEqual(advance(state, 0), []);
  assert.deepEqual(advance(state, -1), []);

  const slow = fresh();
  slow.pods[2].plant = plant('runtz', 0);
  advance(slow, 60 * 60 * 10, () => 0.55);
  assert.equal(slow.pods[2].plant.progress, 1);
});
