import {
  STRAINS, ITEMS, UPGRADES,
  strainById, isStrainUnlocked, upgradeCost, podCost, readyPods, growingPods,
  stageName, gradeFor, plantQuality, estimateYield, pricePerGram, lotValue,
  totalGrams, seedCount, secondsLeft, formatMoney, formatGrams
} from './game.js';
import { icon } from './icons.js';

const esc = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const gradeClass = grade => 'g-' + grade.replace('+', 'p');

function statusFor(state, pod) {
  if (!pod.unlocked) return { label: 'Gesperrt', cls: 'locked' };
  if (!pod.plant) return { label: 'Leer', cls: 'empty' };
  if (pod.plant.progress >= 1) return { label: 'Erntereif', cls: 'ready' };
  if (pod.plant.water <= 0.001) return { label: 'Durstig', cls: 'thirsty' };
  return { label: stageName(pod.plant), cls: 'growing' };
}

export function growOverviewHtml(state) {
  const ready = readyPods(state).length;
  const growing = growingPods(state).length;
  const owned = state.pods.filter(pod => pod.unlocked).length;
  const nextLocked = state.pods.findIndex(pod => !pod.unlocked);

  const cards = state.pods.map((pod, index) => {
    const status = statusFor(state, pod);
    const plant = pod.plant;
    const strain = plant ? strainById(plant.strainId) : null;
    const progress = plant ? Math.round(plant.progress * 100) : 0;
    return `
      <button type="button" class="pod-mini ${status.cls}" data-action="select-pod" data-pod="${index}">
        <span class="pod-mini-top">
          <b>TOPF ${String(index + 1).padStart(2, '0')}</b>
          <span class="dot ${status.cls}"></span>
        </span>
        <span class="pod-mini-name">${strain ? esc(strain.name) : status.label}</span>
        <span class="pod-mini-meta" data-pod-meta="${index}">${strain
          ? `${status.label} · ${progress}%`
          : status.cls === 'locked' ? formatMoney(podCost(index)) : 'Zum Pflanzen tippen'}</span>
        <span class="mini-bar"><i data-pod-bar="${index}" style="width:${progress}%"></i></span>
      </button>`;
  }).join('');

  return `
    <div class="panel-head">
      <div>
        <p class="eyebrow">GROWROOM</p>
        <h2>Der Garten</h2>
      </div>
      <span class="chip">${growing} im Anbau</span>
    </div>
    <div class="overview-strip">
      <div class="ov-stat"><small>TÖPFE</small><b>${owned}/6</b></div>
      <div class="ov-stat"><small>ERNTE</small><b class="${ready ? 'lime' : ''}">${ready}</b></div>
      <div class="ov-stat"><small>VORRAT</small><b>${formatGrams(totalGrams(state))}</b></div>
    </div>
    <div class="pod-grid">${cards}</div>
    <button type="button" class="btn-primary wide" data-action="harvest-all" ${ready ? '' : 'disabled'}>
      ${icon('grow')} Ernten ${ready ? '· ' + ready + ' bereit' : ''}
    </button>
    ${nextLocked >= 0 ? `
      <button type="button" class="btn-ghost wide" data-action="unlock-pod" data-pod="${nextLocked}">
        ${icon('plus')} Topf ${nextLocked + 1} freischalten · ${formatMoney(podCost(nextLocked))}
      </button>` : ''}
    <div class="tip-card">
      ${icon('info')}
      <p><b>Tippe einen Topf im Raum an.</b> Pflanze einen Samen, gieße rechtzeitig und ernte, wenn die Blüten leuchten.</p>
    </div>`;
}

export function shopHtml(state, filter = 'unlocked') {
  const unlockedCount = STRAINS.filter(strain => isStrainUnlocked(state, strain.id)).length;
  const fertilizer = state.items.fertilizer ?? 0;
  const list = STRAINS.filter(strain => filter === 'all' || isStrainUnlocked(state, strain.id));
  const cards = list.map(strain => {
    const locked = !isStrainUnlocked(state, strain.id);
    const selected = state.selectedStrain === strain.id;
    const seeds = seedCount(state, strain.id);
    const accent = strain.accent;
    return `
      <article class="strain-card ${locked ? 'locked' : ''} ${selected ? 'selected' : ''}" style="--accent:${accent}">
        <div class="nug-wrap">
          <canvas class="nug" width="96" height="96" data-nug="${strain.id}" aria-hidden="true"></canvas>
          ${seeds > 0 ? `<span class="seed-badge" title="Samen im Besitz">×${seeds}</span>` : ''}
        </div>
        <div class="strain-main">
          <div class="strain-title">
            <b>${esc(strain.name)}</b>
            <span class="type ${strain.type.toLowerCase()}">${strain.type}</span>
          </div>
          <div class="strain-sub">THC ${strain.thc}% · ${esc(strain.effect)} · ${strain.grow} s</div>
          <div class="strain-stats">
            <span>${strain.yield} g Ertrag</span>
            <span>${formatMoney(strain.price)}/g</span>
          </div>
          ${locked ? `<div class="locked-row">${icon('lock')} Ab Level ${strain.level}</div>` : `
            <div class="strain-actions">
              <button type="button" class="btn-mini ${selected ? 'on' : ''}" data-action="select-strain" data-strain="${strain.id}">
                ${selected ? icon('check') + ' Gewählt' : 'Wählen'}
              </button>
              <button type="button" class="btn-mini ghost" data-action="buy-seed" data-strain="${strain.id}">
                ${icon('plus')} Samen · ${formatMoney(strain.seed)}
              </button>
            </div>`}
        </div>
      </article>`;
  }).join('');

  return `
    <div class="panel-head">
      <div>
        <p class="eyebrow">SAMENLADEN</p>
        <h2>Samen & Zubehör</h2>
      </div>
      <span class="chip">${unlockedCount} Sorten</span>
    </div>
    <div class="supply-card">
      <span class="supply-ico">${icon('flask')}</span>
      <div class="supply-copy">
        <b>${ITEMS.fertilizer.name}</b>
        <small>${ITEMS.fertilizer.desc}</small>
      </div>
      <span class="owned">${fertilizer} im Besitz</span>
      <button type="button" class="btn-mini" data-action="buy-item" data-item="fertilizer">${formatMoney(ITEMS.fertilizer.price)}</button>
    </div>
    <div class="filter-row">
      <button type="button" class="chip-btn ${filter === 'unlocked' ? 'on' : ''}" data-action="filter" data-filter="unlocked">Freigeschaltet</button>
      <button type="button" class="chip-btn ${filter === 'all' ? 'on' : ''}" data-action="filter" data-filter="all">Alle Sorten</button>
    </div>
    <div class="strain-list">${cards}</div>`;
}

export function marketHtml(state) {
  const unlocked = STRAINS.filter(strain => isStrainUnlocked(state, strain.id));
  const movers = [...unlocked]
    .sort((a, b) => (state.market[b.id] ?? 1) - (state.market[a.id] ?? 1))
    .slice(0, 3);

  const moverHtml = movers.map(strain => {
    const multiplier = state.market[strain.id] ?? 1;
    const up = multiplier >= 1;
    return `<span class="mover ${up ? 'up' : 'down'}">${esc(strain.name)} <b>${Math.round(multiplier * 100)}%</b> ${up ? '▲' : '▼'}</span>`;
  }).join('');

  const stashValue = state.lots.reduce((sum, lot) => sum + lotValue(state, lot), 0);
  const lots = state.lots.length
    ? state.lots.map(lot => {
      const strain = strainById(lot.strainId);
      const grade = gradeFor(lot.quality);
      const value = lotValue(state, lot);
      const multiplier = state.market[lot.strainId] ?? 1;
      return `
        <article class="lot-card">
          <canvas class="nug small" width="72" height="72" data-nug="${lot.strainId}" aria-hidden="true"></canvas>
          <div class="lot-main">
            <div class="lot-title"><b>${esc(strain.name)}</b><span class="grade ${gradeClass(grade)}">${grade}</span></div>
            <small>${formatGrams(lot.grams)} · ${formatMoney(pricePerGram(state, lot.strainId, lot.quality))}/g</small>
            <span class="market-tag ${multiplier >= 1 ? 'up' : 'down'}">${Math.round(multiplier * 100)} % Markt</span>
          </div>
          <div class="lot-sell">
            <b>${formatMoney(value)}</b>
            <button type="button" class="btn-mini" data-action="sell-lot" data-lot="${lot.id}">Verkaufen</button>
          </div>
        </article>`;
    }).join('')
    : `<div class="empty-state">${icon('bud')}<b>Nichts zu verkaufen</b><small>Ernte eine reife Pflanze. Der Vorrat erscheint hier.</small></div>`;

  return `
    <div class="panel-head">
      <div>
        <p class="eyebrow">SCHWARZMARKT</p>
        <h2>Vorrat verkaufen</h2>
      </div>
      <span class="chip live">● LIVE</span>
    </div>
    <div class="movers">${moverHtml}</div>
    <div class="inventory-total">
      <div><small>VORRATSWERT</small><b>${formatMoney(stashValue)}</b></div>
      <button type="button" class="btn-primary" data-action="sell-all" ${state.lots.length ? '' : 'disabled'}>
        Alles verkaufen
      </button>
    </div>
    <div class="lot-list">${lots}</div>
    <p class="market-note">${icon('info')} Preise ändern sich alle paar Sekunden. Verkaufe die Spitzen, nicht die Tiefs.</p>`;
}

export function upgradesHtml(state) {
  const cards = Object.entries(UPGRADES).map(([key, def]) => {
    const level = state.upgrades[key] ?? 0;
    const maxed = level >= def.max;
    const cost = upgradeCost(key, level);
    const affordable = state.cash >= cost;
    const pips = Array.from({ length: def.max }, (_, i) =>
      `<i class="${i < level ? 'on' : ''}"></i>`).join('');
    return `
      <article class="upgrade-card">
        <span class="upgrade-ico">${icon(def.icon)}</span>
        <div class="upgrade-main">
          <div class="upgrade-title">
            <b>${def.name}</b>
            <span class="upgrade-level">Lv ${level}/${def.max}</span>
          </div>
          <small>${def.desc}</small>
          <div class="pips">${pips}</div>
          <div class="effect">${def.effect(level)}${level < def.max ? ` <em>→ ${def.effect(level + 1)}</em>` : ''}</div>
        </div>
        <button type="button" class="btn-buy ${affordable ? '' : 'poor'}" data-action="buy-upgrade" data-key="${key}" ${maxed ? 'disabled' : ''}>
          ${maxed ? 'MAX' : formatMoney(cost)}
        </button>
      </article>`;
  }).join('');

  const lockedPods = state.pods.map((pod, index) => pod.unlocked ? '' : `
    <button type="button" class="btn-ghost wide" data-action="unlock-pod" data-pod="${index}">
      ${icon('plus')} Topf ${index + 1} · ${formatMoney(podCost(index))}
    </button>`).join('');

  return `
    <div class="panel-head">
      <div>
        <p class="eyebrow">DAS HINTERZIMMER</p>
        <h2>Ausbau</h2>
      </div>
      <span class="chip">Lv ${state.level}</span>
    </div>
    <div class="upgrade-list">${cards}</div>
    ${lockedPods ? `<div class="section-label">Raum erweitern</div>${lockedPods}` : ''}
    <div class="section-label">Gesamtstatistik</div>
    <div class="stats-card">
      <div><small>ERNTE</small><b>${state.stats.harvested}</b></div>
      <div><small>GEERNTET</small><b>${formatGrams(state.stats.grams)}</b></div>
      <div><small>UMSATZ</small><b>${formatMoney(state.stats.revenue)}</b></div>
      <div><small>RAZZIEN</small><b>${state.stats.raids}</b></div>
    </div>
    <button type="button" class="reset-link" data-action="reset">${icon('refresh')} Diesen Grow zurücksetzen</button>`;
}

export function drawNug(canvas, strain) {
  if (!canvas || !strain) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);

  const base = strain.bud;
  const r = (base >> 16) & 255;
  const g = (base >> 8) & 255;
  const b = base & 255;
  const shade = amount => {
    const c = v => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  };

  let seed = 2166136261;
  for (let i = 0; i < strain.id.length; i++) {
    seed ^= strain.id.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 10000) / 10000;
  };

  const background = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  background.addColorStop(0, 'rgba(40,70,45,.5)');
  background.addColorStop(1, 'rgba(8,14,10,0)');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 22; i++) {
    const angle = random() * Math.PI * 2;
    const distance = random() * size * 0.2;
    const x = size / 2 + Math.cos(angle) * distance;
    const y = size / 2 + Math.sin(angle) * distance * 0.9;
    const radius = size * (0.12 + random() * 0.09);
    const gradient = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.15, x, y, radius);
    gradient.addColorStop(0, shade(0.24));
    gradient.addColorStop(0.65, shade(0.02));
    gradient.addColorStop(1, shade(-0.22));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * (0.8 + random() * 0.4), radius, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,190,120,.8)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) {
    const x = size / 2 + (random() - 0.5) * size * 0.46;
    const y = size / 2 + (random() - 0.5) * size * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 3, y - 4, x + 6, y - 7);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < 26; i++) {
    const angle = random() * Math.PI * 2;
    const distance = random() * size * 0.3;
    ctx.beginPath();
    ctx.arc(size / 2 + Math.cos(angle) * distance, size / 2 + Math.sin(angle) * distance * 0.9, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}
