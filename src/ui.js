import {
  STRAINS, ITEMS, UPGRADES, XP_TABLE,
  strainById, isStrainUnlocked, levelFromXp, xpForLevel, nextLevelXp,
  gradeFor, stageName, plantQuality, estimateYield, pricePerGram, secondsLeft,
  seedCount, selectStrain, buySeeds, buyItem, plantPod, waterPod, applyFertilizer,
  harvestPod, sellLot, sellAll, buyUpgrade, unlockPod, readyPods, totalGrams,
  formatMoney, formatGrams, podCost
} from './game.js';
import { icon } from './icons.js';
import { growOverviewHtml, shopHtml, marketHtml, upgradesHtml, drawNug } from './panels.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const POD_COUNT = 6;

const FAIL_TEXT = {
  cash: ['Nicht genug Geld', 'Verkauf etwas Vorrat oder nimm eine günstigere Sorte.'],
  locked: ['Topf ist gesperrt', 'Schalte ihn in der Gartenübersicht frei.'],
  'strain-locked': ['Sorte noch gesperrt', 'Steig auf, um diese Genetik freizuschalten.'],
  occupied: ['Topf ist belegt', 'Ernte zuerst.'],
  missing: ['Dort ist nichts', 'Versuch einen anderen Topf.'],
  'no-plant': ['Nichts zu gießen', 'Pflanze zuerst einen Samen.'],
  'no-seed': ['Kein Samen vorrätig', 'Kauf einen im Samenladen.'],
  already: ['Schon gedüngt', 'Ein Boost pro Zyklus reicht.'],
  none: ['Kein Blüte-Booster', 'Kauf einen im Shop.'],
  maxed: ['Voll ausgebaut', 'Hier gibt es nichts mehr.'],
  'not-ready': ['Noch nicht reif', 'Gib ihr noch etwas Zeit.'],
  empty: ['Leerer Topf', 'Pflanze zuerst einen Samen.']
};

export class Ui {
  constructor({ state, sfx, scene, save }) {
    this.state = state;
    this.sfx = sfx;
    this.scene = scene;
    this.onSave = save;
    this.selectedPod = Number.isInteger(state.selectedPod) ? state.selectedPod : 0;
    this.activeTab = ['grow', 'shop', 'market', 'upgrades'].includes(state.tab) ? state.tab : 'grow';
    this.shopFilter = 'unlocked';
    this.live = {};
    this.markerEls = [];
    this.markerSignatures = [];
    this.cache = {};

    this.buildMarkers();
    this.bind();
    this.updateSoundButton();
    this.renderActive(false);
    this.updateHud();

    const note = $('#start-note');
    if (note) {
      note.textContent = state.started
        ? `Gespeicherter Grow · Level ${state.level} · ${formatMoney(state.cash)} in der Kasse`
        : 'Pflanzen · Gießen · Ernten · Verkaufen · Aufsteigen';
    }
  }

  /* ------------------------------------------------------------- wiring */

  bind() {
    $('#tabs').addEventListener('click', event => {
      const button = event.target.closest('[data-tab]');
      if (!button) return;
      this.switchTab(button.dataset.tab);
    });

    $('#sheet-body').addEventListener('click', event => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      this.handle(button.dataset.action, button);
    });

    $('#sound-btn').addEventListener('click', () => {
      this.state.sound = !this.state.sound;
      this.sfx.setEnabled(this.state.sound);
      this.updateSoundButton();
      if (this.state.sound) this.sfx.click();
      this.onSave();
    });

    const start = $('#start-btn');
    if (start) start.addEventListener('click', () => this.begin());

    document.addEventListener('keydown', event => {
      if (event.key === '1') this.switchTab('grow');
      if (event.key === '2') this.switchTab('shop');
      if (event.key === '3') this.switchTab('market');
      if (event.key === '4') this.switchTab('upgrades');
      if (event.key === 'Escape') {
        this.selectedPod = null;
        this.state.selectedPod = null;
        if (this.activeTab === 'grow') this.renderActive();
      }
    });
  }

  begin() {
    if (this.begun) return;
    this.begun = true;
    this.sfx.init();
    this.sfx.setEnabled(this.state.sound);
    this.sfx.level();
    this.state.started = true;
    const overlay = $('#start');
    if (overlay) {
      overlay.classList.add('gone');
      setTimeout(() => overlay.classList.add('removed'), 700);
    }
    document.body.classList.add('playing');
    this.onSave();
    this.renderActive();
    setTimeout(() => this.toast('Tippe einen Topf an', 'Gieße durstige Pflanzen · ernte, wenn die Blüten leuchten', 'info', 'grow'), 420);
    setTimeout(() => this.toast('Schnell aufsteigen', 'Neue Sorten gibt es alle paar Ernten', 'info', 'star'), 3600);
    setTimeout(() => this.toast('Verkauf die Spitze', 'Marktpreise bewegen sich alle paar Sekunden', 'info', 'market'), 6800);
  }

  updateSoundButton() {
    const button = $('#sound-btn');
    if (button) button.innerHTML = icon(this.state.sound ? 'sound' : 'mute');
  }

  switchTab(tab) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.state.tab = tab;
    this.sfx.select();
    this.renderActive(false);
    this.onSave();
  }

  selectPod(index) {
    this.selectedPod = index;
    this.state.selectedPod = index;
    this.scene.setSelected(index);
    this.activeTab = 'grow';
    this.state.tab = 'grow';
    this.sfx.select();
    if (navigator.vibrate) navigator.vibrate(8);
    this.renderActive(false);
    this.onSave();
  }

  /* ------------------------------------------------------------- render */

  renderActive(preserveScroll = true) {
    const body = $('#sheet-body');
    const scroll = preserveScroll ? body.scrollTop : 0;

    $$('#tabs .tab').forEach(tab => tab.classList.toggle('on', tab.dataset.tab === this.activeTab));

    if (this.activeTab === 'grow') {
      body.innerHTML = this.selectedPod == null
        ? growOverviewHtml(this.state)
        : this.podDetailHtml(this.selectedPod);
    } else if (this.activeTab === 'shop') {
      body.innerHTML = shopHtml(this.state, this.shopFilter);
    } else if (this.activeTab === 'market') {
      body.innerHTML = marketHtml(this.state);
    } else {
      body.innerHTML = upgradesHtml(this.state);
    }

    body.scrollTop = scroll;
    this.live = {};
    this.captureLive();
    this.paintNugs();
    this.updateHud();
    this.updateLive();
  }

  podDetailHtml(index) {
    const pod = this.state.pods[index];
    if (!pod) {
      this.selectedPod = null;
      return growOverviewHtml(this.state);
    }
    const number = String(index + 1).padStart(2, '0');

    if (!pod.unlocked) {
      return `
        <button type="button" class="back-btn" data-action="back">${icon('back')} Alle Töpfe</button>
        <div class="panel-head">
          <div><p class="eyebrow">TOPF ${number}</p><h2>Gesperrt</h2></div>
          <span class="chip locked">${icon('lock')} GESPERRT</span>
        </div>
        <div class="empty-state tall">
          ${icon('lock')}
          <b>Erweitere den Growroom</b>
          <small>Ein Topf mehr heißt: eine Pflanze mehr, eine Ernte mehr, eine Auszahlung mehr.</small>
          <button type="button" class="btn-primary" data-action="unlock-pod" data-pod="${index}">
            Topf freischalten für ${formatMoney(podCost(index))}
          </button>
        </div>`;
    }

    if (!pod.plant) {
      const strain = strainById(this.state.selectedStrain);
      const seeds = seedCount(this.state, strain.id);
      const affordable = seeds > 0 || this.state.cash >= strain.seed;
      const priceLabel = seeds > 0 ? `${seeds} Samen übrig` : formatMoney(strain.seed);
      const chips = STRAINS.filter(item => isStrainUnlocked(this.state, item.id)).map(item => `
        <button type="button" class="strain-chip ${item.id === strain.id ? 'on' : ''}" data-action="select-strain" data-strain="${item.id}" style="--accent:${item.accent}">
          <span class="dot" style="background:${item.accent}"></span>${item.name}
        </button>`).join('');

      return `
        <button type="button" class="back-btn" data-action="back">${icon('back')} Alle Töpfe</button>
        <div class="panel-head">
          <div><p class="eyebrow">TOPF ${number} · LEER</p><h2>Samen pflanzen</h2></div>
          <span class="chip">${this.state.items.fertilizer ?? 0} Booster</span>
        </div>
        <div class="strain-chip-scroll">${chips}</div>
        <div class="strain-pick">
          <canvas class="nug hero" width="96" height="96" data-nug="${strain.id}" aria-hidden="true"></canvas>
          <div class="strain-pick-main">
            <div class="strain-title"><b>${strain.name}</b><span class="type ${strain.type.toLowerCase()}">${strain.type}</span></div>
            <small>THC ${strain.thc}% · ${strain.effect} · ${strain.grow} s Wachstum</small>
            <div class="strain-stats"><span>${strain.yield} g Ertrag</span><span>${formatMoney(strain.price)}/g</span></div>
          </div>
          <span class="seed-count">${seeds > 0 ? '×' + seeds : 'kein Samen'}</span>
        </div>
        <div class="action-row">
          <button type="button" class="btn-primary wide" data-action="plant" ${affordable ? '' : 'disabled'} id="live-plant">
            ${icon('plus')} ${strain.name} pflanzen
            <span class="btn-tag">${priceLabel}</span>
          </button>
        </div>
        <button type="button" class="btn-ghost wide" data-action="shop">${icon('shop')} Samenladen öffnen</button>
        <div class="tip-card">${icon('info')}<p>Samen werden beim Pflanzen verbraucht. Gieße, bevor der Balken leer ist, sonst sinkt die Qualität.</p></div>`;
    }

    const plant = pod.plant;
    const strain = strainById(plant.strainId);
    const quality = plantQuality(this.state, plant);
    const grade = gradeFor(quality);
    const grams = estimateYield(this.state, plant);
    const value = Math.round(grams * pricePerGram(this.state, plant.strainId, quality));
    const eta = Math.ceil(secondsLeft(this.state, plant));
    const ready = plant.progress >= 1;
    const status = ready ? 'Reif' : plant.water <= 0.001 ? 'Durstig' : stageName(plant);
    const statusClass = ready ? 'ready' : plant.water <= 0.001 ? 'thirsty' : 'growing';
    const tip = ready
      ? 'Die Blüten sind reif. Ernte jetzt — warten kostet nur Zeit.'
      : plant.water <= 0.001
        ? 'Die Erde ist staubtrocken. Ertrag und Qualität sinken jede Sekunde.'
        : plant.water < 0.25
          ? 'Das Wasser wird knapp. Gieß nach, bevor der Balken auf null geht.'
          : 'Sieht gesund aus. Gieße, wenn der Balken sinkt, und dünge einmal für mehr Ertrag.';

    return `
      <button type="button" class="back-btn" data-action="back">${icon('back')} Alle Töpfe</button>
      <div class="pod-detail-head">
        <div>
          <p class="eyebrow">TOPF ${number} · <span class="pill ${statusClass}">${status}</span></p>
          <h2>${strain.name}</h2>
          <p class="sub">${strain.type} · ${strain.thc}% THC · ${strain.effect}</p>
        </div>
        <div class="grade ${'g-' + grade.replace('+', 'p')}" id="live-grade">${grade}</div>
      </div>
      <div class="bar-block">
        <div class="bar-row">
          <span>WACHSTUM</span>
          <div class="bar"><i id="live-progress" style="width:${(plant.progress * 100).toFixed(1)}%"></i></div>
          <b id="live-pct">${Math.round(plant.progress * 100)}%</b>
        </div>
        <div class="bar-row">
          <span>WASSER</span>
          <div class="bar water"><i id="live-water" style="width:${(plant.water * 100).toFixed(1)}%"></i></div>
          <b id="live-water-pct">${Math.round(plant.water * 100)}%</b>
        </div>
      </div>
      <div class="stat-grid">
        <div><small>RESTZEIT</small><b id="live-eta">${ready ? 'Reif' : eta + ' s'}</b></div>
        <div><small>ERTRAG (EST.)</small><b id="live-yield">${grams} g</b></div>
        <div><small>WERT (EST.)</small><b id="live-value">${formatMoney(value)}</b></div>
        <div><small>SAMEN</small><b>${seedCount(this.state, strain.id)}</b></div>
      </div>
      <div class="action-row">
        ${ready
          ? `<button type="button" class="btn-primary wide harvest" data-action="harvest" id="live-primary">${icon('check')} Jetzt ernten</button>`
          : `<button type="button" class="btn-primary wide" data-action="water" id="live-primary">${icon('drop')} Gießen</button>`}
        ${plant.fertilized
          ? `<span class="fed-tag">${icon('check')} Gedüngt</span>`
          : `<button type="button" class="btn-secondary" data-action="feed" id="live-feed">${icon('flask')} Düngen</button>`}
      </div>
      <div class="tip-card">${icon('info')}<p>${tip}</p></div>
      <div class="strain-file">
        <div class="file-copy">
          <small>SORTENAKTE</small>
          <b>${strain.name}</b>
          <p>${strain.note}</p>
        </div>
        <div class="file-stats">
          <span><small>THC</small>${strain.thc}%</span>
          <span><small>MARKT</small>${Math.round((this.state.market[strain.id] ?? 1) * 100)}%</span>
          <span><small>SAMEN</small>${formatMoney(strain.seed)}</span>
        </div>
      </div>
      <button type="button" class="btn-ghost wide" data-action="back">${icon('grow')} Alle Töpfe</button>`;
  }

  paintNugs() {
    $$('#sheet-body canvas[data-nug]').forEach(canvas => {
      drawNug(canvas, strainById(canvas.dataset.nug));
    });
  }

  captureLive() {
    if (this.activeTab !== 'grow' || this.selectedPod == null) return;
    const pod = this.state.pods[this.selectedPod];
    if (!pod?.plant) {
      this.live.plantBtn = $('#live-plant');
      return;
    }
    this.live = {
      progress: $('#live-progress'),
      pct: $('#live-pct'),
      water: $('#live-water'),
      waterPct: $('#live-water-pct'),
      eta: $('#live-eta'),
      yield: $('#live-yield'),
      value: $('#live-value'),
      grade: $('#live-grade'),
      primary: $('#live-primary'),
      feed: $('#live-feed')
    };
  }

  /* --------------------------------------------------------------- hud */

  setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  updateHud() {
    const state = this.state;
    this.setText($('#cash'), formatMoney(state.cash));
    this.setText($('#stash'), formatGrams(totalGrams(state)));

    const level = state.level;
    const next = nextLevelXp(level);
    const base = xpForLevel(level);
    const maxed = level >= XP_TABLE.length;
    const ratio = maxed ? 1 : Math.min(1, Math.max(0, (state.xp - base) / Math.max(1, next - base)));
    this.setText($('#lvl-num'), String(level));
    this.setText($('#lvl-xp'), maxed ? 'MAX. LEVEL' : `${Math.floor(state.xp)} / ${next} XP`);
    const ring = $('#lvl-ring');
    if (ring) ring.style.setProperty('--p', ratio.toFixed(3));

    const heat = Math.round(state.heat);
    const fill = $('#heat-fill');
    if (fill) fill.style.width = Math.min(100, heat) + '%';
    this.setText($('#heat-pct'), heat + '%');
    const heatStat = $('#heat-stat');
    if (heatStat) {
      heatStat.classList.toggle('warm', heat >= 45 && heat < 75);
      heatStat.classList.toggle('hot', heat >= 75);
    }

    const ready = readyPods(state).length;
    const growBadge = $('#grow-badge');
    if (growBadge) {
      growBadge.textContent = ready ? String(ready) : '';
      growBadge.classList.toggle('show', ready > 0);
    }
    const marketBadge = $('#market-badge');
    if (marketBadge) {
      const count = state.lots.length;
      marketBadge.textContent = count ? String(count) : '';
      marketBadge.classList.toggle('show', count > 0);
    }

    const tabPulse = $('#tabs [data-tab="shop"] .tab-badge');
    if (tabPulse) {
      const unlocked = STRAINS.filter(strain => strain.level === level).length;
      tabPulse.textContent = unlocked ? 'NEU' : '';
      tabPulse.classList.toggle('show', unlocked > 0);
    }

    this.updateMarkers();
  }

  updateLive() {
    const state = this.state;
    if (this.activeTab !== 'grow' || this.selectedPod == null) {
      this.updateOverviewBars();
      return;
    }
    const pod = state.pods[this.selectedPod];
    if (!pod) return;

    if (!pod.plant) {
      if (this.live.plantBtn) {
        const strain = strainById(state.selectedStrain);
        const seeds = seedCount(state, strain.id);
        this.live.plantBtn.disabled = !(seeds > 0 || state.cash >= strain.seed);
      }
      return;
    }

    const plant = pod.plant;
    const live = this.live;
    if (!live.progress) return;

    const quality = plantQuality(state, plant);
    const grade = gradeFor(quality);
    const grams = estimateYield(state, plant);
    const value = Math.round(grams * pricePerGram(state, plant.strainId, quality));
    const ready = plant.progress >= 1;

    live.progress.style.width = (plant.progress * 100).toFixed(1) + '%';
    live.pct.textContent = Math.round(plant.progress * 100) + '%';
    live.water.style.width = (plant.water * 100).toFixed(1) + '%';
    live.waterPct.textContent = Math.round(plant.water * 100) + '%';
    live.eta.textContent = ready ? 'Reif' : Math.ceil(secondsLeft(state, plant)) + ' s';
    live.yield.textContent = grams + ' g';
    live.value.textContent = formatMoney(value);
    if (live.grade) {
      live.grade.textContent = grade;
      live.grade.className = 'grade g-' + grade.replace('+', 'p');
    }

    if (live.primary) {
      const action = ready ? 'harvest' : 'water';
      if (live.primary.dataset.action !== action) {
        live.primary.dataset.action = action;
        live.primary.classList.toggle('harvest', ready);
        live.primary.innerHTML = ready
          ? icon('check') + ' Jetzt ernten'
          : icon('drop') + ' Gießen';
      }
    }
    if (live.feed) {
      live.feed.classList.toggle('dim', state.cash < ITEMS.fertilizer.price && (state.items.fertilizer ?? 0) < 1);
    }
  }

  updateOverviewBars() {
    if (this.activeTab !== 'grow' || this.selectedPod != null) return;
    $$('#sheet-body [data-pod-bar]').forEach(bar => {
      const index = Number(bar.dataset.podBar);
      const plant = this.state.pods[index]?.plant;
      bar.style.width = (plant ? plant.progress * 100 : 0).toFixed(1) + '%';
    });
    $$('#sheet-body [data-pod-meta]').forEach(meta => {
      const index = Number(meta.dataset.podMeta);
      const pod = this.state.pods[index];
      const plant = pod?.plant;
      if (!plant) return;
      const status = plant.progress >= 1 ? 'Reif' : plant.water <= 0.001 ? 'Durstig' : stageName(plant);
      const value = `${status} · ${Math.round(plant.progress * 100)}%`;
      if (meta.textContent !== value) meta.textContent = value;
    });
  }

  /* ------------------------------------------------------------ markers */

  buildMarkers() {
    const wrap = $('#markers');
    if (!wrap) return;
    for (let index = 0; index < POD_COUNT; index++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'marker';
      button.dataset.pod = index;
      button.innerHTML = `
        <svg class="ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle class="ring-track" cx="20" cy="20" r="17" pathLength="100"></circle>
          <circle class="ring-fill" cx="20" cy="20" r="17" pathLength="100"></circle>
        </svg>
        <span class="m-ic"></span>`;
      button.addEventListener('click', event => {
        event.stopPropagation();
        this.selectPod(index);
      });
      button.style.setProperty('--accent', '#9dff5e');
      wrap.append(button);
      this.markerEls.push(button);
      this.markerSignatures.push('');
    }
  }

  updateMarkers() {
    if (!this.scene || this.scene.failed) return;
    for (let index = 0; index < POD_COUNT; index++) {
      const element = this.markerEls[index];
      if (!element) continue;
      const position = this.scene.markerPosition(index);
      if (!position.visible || position.x < -60 || position.x > window.innerWidth + 60) {
        element.style.opacity = '0';
        element.style.pointerEvents = 'none';
        continue;
      }
      element.style.opacity = '1';
      element.style.pointerEvents = 'auto';
      element.style.transform = `translate(-50%,-50%) translate3d(${position.x.toFixed(1)}px, ${position.y.toFixed(1)}px, 0)`;

      const pod = this.state.pods[index];
      const plant = pod.plant;
      const progress = plant ? plant.progress : 0;
      const ready = plant && progress >= 1;
      const thirsty = plant && plant.water <= 0.001 && !ready;
      const status = !pod.unlocked ? 'locked' : !plant ? 'empty' : ready ? 'ready' : thirsty ? 'thirsty' : 'growing';
      const strain = plant ? strainById(plant.strainId) : null;
      const signature = `${status}:${strain?.id ?? ''}`;
      const ring = element.querySelector('.ring-fill');
      if (ring) {
        ring.style.strokeDashoffset = String(100 - progress * 100);
        ring.style.stroke = strain ? strain.accent : '#9dff5e';
      }
      element.style.setProperty('--accent', strain ? strain.accent : '#9dff5e');
      if (this.markerSignatures[index] !== signature) {
        this.markerSignatures[index] = signature;
        element.className = `marker ${status}`;
        const names = { locked: 'lock', empty: 'plus', ready: 'check', thirsty: 'drop', growing: 'leaf' };
        element.querySelector('.m-ic').innerHTML = icon(names[status]);
        const labels = { locked: 'Gesperrter Topf', empty: 'Leerer Topf', ready: 'Erntereif', thirsty: 'Braucht Wasser', growing: 'Wachstum' };
        element.setAttribute('aria-label', `Topf ${index + 1} — ${labels[status]}`);
      }
    }
  }

  /* ------------------------------------------------------------ actions */

  refresh(preserveScroll = true) {
    this.renderActive(preserveScroll);
    this.updateHud();
    this.onSave();
  }

  fail(reason) {
    const [title, sub] = FAIL_TEXT[reason] || ['Nicht möglich', 'Versuch etwas anderes.'];
    this.sfx.error();
    this.toast(title, sub, 'danger', 'info');
  }

  showCash(delta) {
    if (!delta) return;
    const host = $('#cash-stat');
    if (!host) return;
    const node = document.createElement('span');
    node.className = 'cash-float ' + (delta > 0 ? 'up' : 'down');
    node.textContent = (delta > 0 ? '+' : '−') + formatMoney(Math.abs(delta));
    host.append(node);
    setTimeout(() => node.remove(), 1100);
  }

  toast(title, sub = '', type = 'info', iconName = 'leaf') {
    const wrap = $('#toasts');
    if (!wrap) return;
    while (wrap.children.length >= 3) wrap.firstElementChild.remove();
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = `<span class="toast-ico">${icon(iconName)}</span><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    wrap.append(node);
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => {
      node.classList.remove('show');
      setTimeout(() => node.remove(), 320);
    }, 3200);
  }

  announceLevel(level) {
    const unlocked = STRAINS.filter(strain => strain.level === level);
    this.sfx.level();
    this.toast(
      `LEVEL ${level}`,
      unlocked.length ? `${unlocked.map(strain => strain.name).join(' · ')} freigeschaltet` : 'Neue Upgrades verfügbar',
      'level',
      'star'
    );
    document.body.classList.add('level-flash');
    setTimeout(() => document.body.classList.remove('level-flash'), 850);
    if (navigator.vibrate) navigator.vibrate([12, 40, 18]);
  }

  handle(action, element) {
    const index = element.dataset.pod !== undefined ? Number(element.dataset.pod) : this.selectedPod;
    const state = this.state;

    switch (action) {
      case 'select-pod': {
        this.selectPod(index);
        break;
      }
      case 'back': {
        this.selectedPod = null;
        state.selectedPod = null;
        this.sfx.click();
        this.renderActive(false);
        this.onSave();
        break;
      }
      case 'shop': {
        this.switchTab('shop');
        break;
      }
      case 'plant': {
        const result = plantPod(state, index);
        if (!result.ok) return this.fail(result.reason);
        const strain = strainById(result.strainId);
        this.sfx.plant();
        if (result.bought) this.showCash(-result.cost);
        this.scene.refreshPod(index);
        this.scene.burst(index, strain.bud);
        this.toast('Gepflanzt', `${strain.name}${result.bought ? ` · Samen ${formatMoney(result.cost)}` : ' · Samen verbraucht'}`, 'success', 'grow');
        this.refresh();
        break;
      }
      case 'water': {
        const result = waterPod(state, index);
        if (!result.ok) return this.fail(result.reason);
        this.sfx.water();
        if (result.wasThirsty) this.toast('Gerettet', 'Gerade noch rechtzeitig gegossen', 'success', 'drop');
        this.refresh();
        break;
      }
      case 'feed': {
        if ((state.items.fertilizer ?? 0) < 1) {
          const bought = buyItem(state, 'fertilizer', 1);
          if (!bought.ok) return this.fail(bought.reason);
          this.showCash(-bought.cost);
          this.sfx.cash();
        }
        const fed = applyFertilizer(state, index);
        if (!fed.ok) return this.fail(fed.reason);
        this.sfx.feed();
        this.scene.refreshPod(index);
        this.toast('Blüte-Booster gedüngt', '+30 % Wachstum und +6 % Qualität in diesem Zyklus', 'success', 'flask');
        this.refresh();
        break;
      }
      case 'harvest': {
        const result = harvestPod(state, index);
        if (!result.ok) return this.fail(result.reason);
        this.sfx.harvest();
        this.scene.refreshPod(index);
        this.scene.burst(index, strainById(result.strainId).bud);
        this.toast(`Geerntet ${formatGrams(result.grams)}`, `${result.strainName} · Note ${result.grade} · Wert ${formatMoney(result.value)}`, 'success', 'bud');
        if (result.levelUp) this.announceLevel(result.levelUp);
        if (navigator.vibrate) navigator.vibrate(18);
        this.refresh();
        break;
      }
      case 'harvest-all': {
        const ready = readyPods(state);
        if (!ready.length) return this.fail('not-ready');
        let grams = 0;
        let value = 0;
        let levelUp = 0;
        for (const podIndex of ready) {
          const result = harvestPod(state, podIndex);
          if (!result.ok) continue;
          grams += result.grams;
          value += result.value;
          levelUp = Math.max(levelUp, result.levelUp || 0);
          this.scene.refreshPod(podIndex);
          this.scene.burst(podIndex, strainById(result.strainId).bud);
        }
        this.sfx.harvest();
        this.toast(`Geerntet ${formatGrams(grams)}`, `${ready.length} Töpfe · Wert ${formatMoney(value)}`, 'success', 'bud');
        if (levelUp) this.announceLevel(levelUp);
        this.refresh();
        break;
      }
      case 'unlock-pod': {
        const result = unlockPod(state, index);
        if (!result.ok) return this.fail(result.reason);
        this.showCash(-result.cost);
        this.sfx.cash();
        this.toast(`Topf ${index + 1} freigeschaltet`, 'Der Growroom ist größer geworden', 'success', 'pot');
        this.selectedPod = index;
        state.selectedPod = index;
        this.refresh();
        break;
      }
      case 'select-strain': {
        const strainId = element.dataset.strain;
        if (!selectStrain(state, strainId)) return this.fail('strain-locked');
        this.sfx.select();
        this.toast('Sorte gewählt', `${strainById(strainId).name} · bereit zum Pflanzen`, 'info', 'leaf');
        this.refresh();
        break;
      }
      case 'buy-seed': {
        const strainId = element.dataset.strain;
        const result = buySeeds(state, strainId, 1);
        if (!result.ok) return this.fail(result.reason);
        this.showCash(-result.cost);
        this.sfx.cash();
        this.toast('Samen gekauft', `${strainById(strainId).name} · ${seedCount(state, strainId)} im Vorrat`, 'success', 'shop');
        this.refresh();
        break;
      }
      case 'buy-item': {
        const result = buyItem(state, element.dataset.item, 1);
        if (!result.ok) return this.fail(result.reason);
        this.showCash(-result.cost);
        this.sfx.cash();
        this.toast('Blüte-Booster gekauft', `${state.items.fertilizer} im Schrank`, 'success', 'flask');
        this.refresh();
        break;
      }
      case 'buy-upgrade': {
        const key = element.dataset.key;
        const result = buyUpgrade(state, key);
        if (!result.ok) return this.fail(result.reason);
        this.showCash(-result.cost);
        this.sfx.cash();
        this.toast(`${UPGRADES[key].name} · Lv ${result.level}`, UPGRADES[key].effect(result.level), 'success', UPGRADES[key].icon);
        this.refresh();
        break;
      }
      case 'sell-lot': {
        const result = sellLot(state, element.dataset.lot);
        if (!result.ok) return this.fail(result.reason);
        this.sfx.cash();
        this.showCash(result.value);
        this.toast(`Verkauft ${formatGrams(result.grams)}`, `${result.strainName} · +${formatMoney(result.value)}`, 'success', 'cash');
        if (result.levelUp) this.announceLevel(result.levelUp);
        this.refresh();
        break;
      }
      case 'sell-all': {
        const result = sellAll(state);
        if (!result.ok) return this.fail('empty');
        this.sfx.cash();
        this.showCash(result.value);
        this.toast('Vorrat verkauft', `${formatGrams(result.grams)} · +${formatMoney(result.value)}`, 'success', 'cash');
        if (result.levelUp) this.announceLevel(result.levelUp);
        this.refresh();
        break;
      }
      case 'filter': {
        this.shopFilter = element.dataset.filter;
        this.renderActive(false);
        break;
      }
      case 'reset': {
        if (window.confirm('Diesen Grow verbrennen und neu starten?')) {
          try { localStorage.removeItem('weedfirm.save.v5'); } catch {}
          window.location.reload();
        }
        break;
      }
      default:
        break;
    }
  }
}
