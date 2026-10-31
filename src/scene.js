import * as THREE from 'three';
import { strainById } from './game.js';

const DESKTOP_X = [-4.35, 0, 4.35];
const MOBILE_X = [-2.45, 0, 2.45];
const FRONT_Z = 1.55;
const BACK_Z = -2.35;

const easeOut = value => 1 - Math.pow(1 - value, 3);
const smoothstep = (edge0, edge1, value) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.28, 'rgba(255,255,255,.6)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,.14)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function shadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(0,0,0,.85)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function concreteTexture(base, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const shade = Math.floor(random() * 40);
    ctx.fillStyle = `rgba(${shade},${shade + 4},${shade + 6},${0.05 + random() * 0.16})`;
    const size = 1 + random() * 3;
    ctx.fillRect(random() * 512, random() * 512, size, size);
  }
  for (let i = 0; i < 12; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.012 + random() * 0.02})`;
    ctx.lineWidth = 1 + random() * 2;
    ctx.beginPath();
    ctx.moveTo(random() * 512, 0);
    ctx.bezierCurveTo(random() * 512, 170, random() * 512, 340, random() * 512, 512);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const leafCache = new Map();
const budCache = new Map();
let leafTextureCache = null;

/** Paint one serrated cannabis leaflet onto the shared leaf canvas. */
function drawLeaflet(ctx, angle, length, hue, light) {
  const baseX = 256;
  const baseY = 498;
  const maxWidth = length * 0.19;
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(angle);

  const gradient = ctx.createLinearGradient(0, 0, 0, -length);
  gradient.addColorStop(0, `hsl(${hue} 42% ${light - 10}%)`);
  gradient.addColorStop(0.45, `hsl(${hue} 48% ${light}%)`);
  gradient.addColorStop(1, `hsl(${hue + 6} 52% ${light + 9}%)`);

  ctx.beginPath();
  const steps = 34;
  const widthAt = t => Math.sin(Math.PI * Math.pow(t, 0.72)) ** 0.6 * maxWidth * (1 - t * 0.12);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const tooth = i % 2 === 0 ? 1 : 0.93;
    const x = widthAt(t) * tooth;
    const y = -t * length;
    if (i === 0) ctx.moveTo(0, 0);
    ctx.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const tooth = i % 2 === 0 ? 1 : 0.93;
    ctx.lineTo(-widthAt(t) * tooth, -t * length);
  }
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = `hsla(${hue - 6} 55% ${Math.max(8, light - 18)}% / 0.85)`;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Central vein and a few side veins.
  ctx.strokeStyle = `hsla(${hue + 18} 45% ${light + 22}% / 0.32)`;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.quadraticCurveTo(maxWidth * 0.12, -length * 0.55, 0, -length * 0.94);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const w = widthAt(t) * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -t * length);
    ctx.lineTo(w, -(t + 0.08) * length);
    ctx.moveTo(0, -t * length);
    ctx.lineTo(-w, -(t + 0.08) * length);
    ctx.stroke();
  }
  ctx.restore();
}

function leafTexture() {
  if (leafTextureCache) return leafTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  const angles = [-0.99, -0.66, -0.33, 0, 0.33, 0.66, 0.99];
  const lengths = [0.54, 0.77, 0.91, 1, 0.91, 0.77, 0.54];
  const hues = [104, 99, 108, 101, 108, 99, 104];
  const order = [0, 6, 1, 5, 2, 4, 3];
  for (const index of order) {
    drawLeaflet(ctx, angles[index], lengths[index] * 432, hues[index], 22 + (index % 3) * 2);
  }

  // Petiole joining the leaflets to the branch.
  const petiole = ctx.createLinearGradient(0, 498, 0, 430);
  petiole.addColorStop(0, '#37501f');
  petiole.addColorStop(1, '#4a6b29');
  ctx.strokeStyle = petiole;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(256, 502);
  ctx.lineTo(256, 442);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  leafTextureCache = texture;
  return texture;
}

/** A flat, textured fan leaf with its pivot at the stem. */
function leafGeometry(length) {
  const key = length.toFixed(3);
  if (leafCache.has(key)) return leafCache.get(key);
  const geometry = new THREE.PlaneGeometry(length * 0.95, length, 1, 1);
  geometry.translate(0, length * 0.5, 0);
  leafCache.set(key, geometry);
  return geometry;
}

function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function budGeometry(radius) {
  const key = radius.toFixed(3);
  if (budCache.has(key)) return budCache.get(key);
  const geometry = new THREE.IcosahedronGeometry(radius, 1);
  budCache.set(key, geometry);
  return geometry;
}

export class GrowScene {
  constructor(canvas, state, { onPick } = {}) {
    this.canvas = canvas;
    this.state = state;
    this.onPick = onPick || (() => {});
    this.selected = state.selectedPod ?? 0;
    this.hovered = -1;
    this.pointer = { x: 0, y: 0 };
    this.mobile = false;
    this.podVisuals = [];
    this.podGroups = [];
    this.bursts = [];
    this.failed = false;
    this.clock = new THREE.Clock();
    this.tmp = new THREE.Vector3();

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance'
      });
    } catch (error) {
      this.failed = true;
      return;
    }

    this.glowMap = glowTexture();
    this.shadowMap = shadowTexture();
    this.renderer.setClearColor(0x04070a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x04070a, 17, 46);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);

    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();

    this.buildRoom();
    for (let index = 0; index < 6; index++) this.buildPod(index);
    this.buildDust();
    this.bindEvents();
    this.resize();

    document.fonts.ready.then(() => this.buildSign()).catch(() => this.buildSign());
  }

  /* ------------------------------------------------------------- room */

  buildRoom() {
    const scene = this.scene;

    const floorTexture = concreteTexture('#20282a', 7);
    floorTexture.repeat.set(5, 4);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 44),
      new THREE.MeshStandardMaterial({
        map: floorTexture,
        color: 0xb8c4c4,
        roughness: 0.78,
        metalness: 0.14
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 2);
    scene.add(floor);

    const grid = new THREE.GridHelper(60, 30, 0x3d6b58, 0x24382f);
    grid.material.transparent = true;
    grid.material.opacity = 0.38;
    grid.position.y = 0.012;
    scene.add(grid);

    const wallTexture = concreteTexture('#1b2427', 19);
    wallTexture.repeat.set(7, 3);
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      color: 0xc2cece,
      roughness: 0.9,
      metalness: 0.1
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(34, 13, 0.5), wallMaterial);
    backWall.position.set(0, 6.5, -8.6);
    scene.add(backWall);

    const sideWallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 12, 18), wallMaterial);
    sideWallLeft.position.set(-20, 6, -1);
    scene.add(sideWallLeft);
    const sideWallRight = sideWallLeft.clone();
    sideWallRight.position.x = 20;
    scene.add(sideWallRight);

    // Neon trim along the floor line.
    const trimMaterial = new THREE.MeshBasicMaterial({ color: 0x9dff5e, toneMapped: false });
    const trim = new THREE.Mesh(new THREE.BoxGeometry(26, 0.035, 0.035), trimMaterial);
    trim.position.set(0, 0.09, -8.32);
    scene.add(trim);
    const trimGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowMap, color: 0x9dff5e, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    trimGlow.scale.set(24, 1.4, 1);
    trimGlow.position.set(0, 0.12, -8.3);
    scene.add(trimGlow);

    // Wall pipes.
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x2a3338, roughness: 0.5, metalness: 0.7 });
    for (const x of [-11.6, -10.8, 11.2]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 11, 10), pipeMat);
      pipe.position.set(x, 5.5, -8.25);
      scene.add(pipe);
    }
    const horizonPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 27, 10), pipeMat);
    horizonPipe.rotation.z = Math.PI / 2;
    horizonPipe.position.set(0, 10.4, -8.2);
    scene.add(horizonPipe);

    // Left-side shelf with jars.
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x26201a, roughness: 0.7, metalness: 0.25 });
    for (let level = 0; level < 2; level++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 0.9), shelfMat);
      shelf.position.set(-9.4, 2.4 + level * 1.25, -7.9);
      scene.add(shelf);
      const jarMat = new THREE.MeshStandardMaterial({
        color: 0x7fe08a, roughness: 0.25, metalness: 0.1,
        emissive: 0x2f7f3f, emissiveIntensity: 0.4, transparent: true, opacity: 0.75
      });
      for (let j = 0; j < 5; j++) {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 12), jarMat);
        jar.position.set(-11.2 + j * 0.75, 2.66 + level * 1.25, -7.78);
        scene.add(jar);
      }
    }

    // Crates and a water jug for set dressing.
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.85 });
    const cratePositions = [[9.6, 0.45, 4.4], [10.5, 0.45, 3.4], [9.8, 1.3, 4.2]];
    for (const [x, y, z] of cratePositions) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.9, 0.9), crateMat);
      crate.position.set(x, y, z);
      crate.rotation.y = (x + z) * 0.18;
      scene.add(crate);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(crate.geometry),
        new THREE.LineBasicMaterial({ color: 0x6b5740, transparent: true, opacity: 0.5 })
      );
      crate.add(edge);
    }

    const jug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.72, 12),
      new THREE.MeshStandardMaterial({ color: 0x5ab7d8, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.85 })
    );
    jug.position.set(-7.4, 0.36, 3.6);
    scene.add(jug);
    const jugCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0xdfeef2, roughness: 0.4 })
    );
    jugCap.position.set(-7.4, 0.78, 3.6);
    scene.add(jugCap);

    // Lighting rig.
    scene.add(new THREE.AmbientLight(0x7d8670, 0.72));
    const hemi = new THREE.HemisphereLight(0xdfe8cf, 0x14200f, 0.68);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff4e8, 1.45);
    key.position.set(6, 13, 9);
    scene.add(key);

    const pink = new THREE.PointLight(0xff5ea8, 11, 24, 2);
    pink.position.set(-7.5, 5.6, 2.5);
    scene.add(pink);
    const cyan = new THREE.PointLight(0x5affe0, 9, 22, 2);
    cyan.position.set(8, 5.2, 1.5);
    scene.add(cyan);
    const lime = new THREE.PointLight(0xa8ff66, 12, 20, 2);
    lime.position.set(0, 4.4, -6.2);
    scene.add(lime);

    const warm = new THREE.PointLight(0xffb070, 17, 24, 2);
    warm.position.set(-9, 4.2, -2);
    scene.add(warm);

    const top = new THREE.PointLight(0xfff1dc, 14, 22, 2);
    top.position.set(2, 9.5, 3);
    scene.add(top);

    const frontFill = new THREE.PointLight(0xbcd0c4, 9, 32, 1.6);
    frontFill.position.set(-8, 7, 10);
    scene.add(frontFill);

    // Wall-wash strips give the concrete some shape.
    const washMat = new THREE.MeshBasicMaterial({ color: 0x2e5140, toneMapped: false });
    for (const x of [-7.8, 7.8]) {
      const wash = new THREE.Mesh(new THREE.BoxGeometry(0.05, 5.4, 0.05), washMat);
      wash.position.set(x, 3.4, -8.32);
      scene.add(wash);
    }

    this.ambientBars = [];
  }

  buildSign() {
    if (this.signBuilt || !this.scene) return;
    this.signBuilt = true;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 1024, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#8dff45';
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#d9ffa6';
    ctx.font = '400 138px "Bebas Neue", Impact, sans-serif';
    ctx.letterSpacing = '10px';
    ctx.fillText('WEED FIRM', 512, 122);
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#eaffd9';
    ctx.font = '400 27px "Outfit", system-ui, sans-serif';
    ctx.letterSpacing = '7px';
    ctx.fillText('ANBAUEN  ·  ERNTEN  ·  IMPERIUM', 512, 206);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false, toneMapped: false
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 2.4), material);
    mesh.position.set(0, 6.1, -8.3);
    this.scene.add(mesh);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowMap, color: 0x9dff5e, transparent: true, opacity: 0.34,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(14, 5.8, 1);
    glow.position.set(0, 6.05, -8.4);
    this.scene.add(glow);
    this.signGlow = glow;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(10.1, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x9dff5e, toneMapped: false })
    );
    frame.position.set(0, 4.66, -8.35);
    this.scene.add(frame);
  }

  /* ------------------------------------------------------------- pods */

  buildPod(index) {
    const state = this.state;
    const visual = {
      index,
      plantRoot: null,
      leaves: [],
      buds: null,
      leafMat: null,
      leafBase: new THREE.Color(0x4e9c43),
      stemMat: null,
      strainId: null,
      fertGlow: null,
      plant: null
    };

    const group = new THREE.Group();
    group.userData.pod = index;
    this.scene.add(group);
    visual.group = group;
    this.podGroups.push(group);

    const tableMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1d, roughness: 0.78, metalness: 0.05 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.13, 1.2), tableMat);
    top.position.y = 0.6;
    group.add(top);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 0.8 });
    const legGeometry = new THREE.CylinderGeometry(0.045, 0.055, 0.55, 6);
    for (const [x, z] of [[-0.64, -0.44], [0.64, -0.44], [-0.64, 0.44], [0.64, 0.44]]) {
      const leg = new THREE.Mesh(legGeometry, legMat);
      leg.position.set(x, 0.3, z);
      group.add(leg);
    }

    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.4, 0.42, 22),
      new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.62, metalness: 0.28 })
    );
    pot.position.y = 0.85;
    group.add(pot);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.045, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.5, metalness: 0.45 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.06;
    group.add(rim);

    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.06, 22),
      new THREE.MeshStandardMaterial({ color: 0x24180f, roughness: 1 })
    );
    soil.position.y = 1.04;
    group.add(soil);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2),
      new THREE.MeshBasicMaterial({
        map: this.shadowMap, transparent: true, opacity: 0.55, depthWrite: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    group.add(shadow);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9dff5e, transparent: true, opacity: 0.75, toneMapped: false,
      side: THREE.DoubleSide, depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.73, 44), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.675;
    ring.visible = false;
    group.add(ring);
    visual.ring = ring;
    visual.ringMat = ringMat;

    // LED panel + hanging wires.
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xff9bdc, emissive: 0xff5ea8, emissiveIntensity: 2.4, roughness: 0.4
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 0.5), barMat);
    bar.position.y = 4.02;
    group.add(bar);
    visual.bar = bar;
    visual.barMat = barMat;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.5, metalness: 0.7 });
    const barFrame = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 0.66), frameMat);
    barFrame.position.y = 4.1;
    group.add(barFrame);

    const wireMat = new THREE.MeshStandardMaterial({ color: 0x141719, roughness: 0.8 });
    for (const x of [-0.68, 0.68]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 3.6, 5), wireMat);
      wire.position.set(x, 5.85, 0);
      group.add(wire);
    }

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.05, 2.9, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff6fd0, transparent: true, opacity: 0.045, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
      })
    );
    cone.position.y = 2.56;
    group.add(cone);
    visual.cone = cone;

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowMap, color: 0xff8bda, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(2.1, 2.1, 1);
    glow.position.y = 3.99;
    group.add(glow);
    visual.glow = glow;

    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({
        map: this.glowMap, color: 0xff6fd0, transparent: true, opacity: 0.13,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.682;
    group.add(pool);

    const light = new THREE.PointLight(0xffe9d8, index % 3 === 1 ? 1.25 : 0.9, 4.5, 2);
    light.position.y = 3.05;
    group.add(light);
    visual.light = light;

    this.podVisuals.push(visual);
    this.placePod(visual, index);
    this.refreshPod(index);
  }

  placePod(visual, index) {
    const xs = this.mobile ? MOBILE_X : DESKTOP_X;
    const column = index % 3;
    const row = Math.floor(index / 3);
    visual.group.position.set(xs[column], 0, row === 0 ? FRONT_Z : BACK_Z);
  }

  refreshPod(index) {
    const visual = this.podVisuals[index];
    if (!visual) return;
    const plant = this.state.pods[index]?.plant;

    if (visual.plantRoot) {
      visual.group.remove(visual.plantRoot);
      visual.plantRoot.traverse(child => {
        if (child.isMesh && child.material && child.material.userData?.owned) child.material.dispose();
      });
      visual.plantRoot = null;
    }
    visual.leaves = [];
    visual.buds = null;
    visual.fertGlow = null;
    visual.plant = plant;
    visual.strainId = plant?.strainId ?? null;

    if (!plant) return;
    const strain = strainById(plant.strainId);
    const random = seededRandom(hashString(strain.id) + index * 97);
    const root = new THREE.Group();
    root.position.y = 1.03;

    const leafColor = new THREE.Color(0xa9b99b);
    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTexture(), color: leafColor.clone(), roughness: 0.94, metalness: 0,
      side: THREE.DoubleSide, alphaTest: 0.45, emissive: 0x030a04, emissiveIntensity: 0.2
    });
    leafMat.userData.owned = true;
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x47682f, roughness: 0.94 });
    stemMat.userData.owned = true;
    visual.leafMat = leafMat;
    visual.leafBase = leafColor.clone();
    visual.stemMat = stemMat;

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.05, 1.08, 6), stemMat);
    stem.position.y = 0.54;
    root.add(stem);

    // Side branches follow the stem upward.
    const branchTips = [];
    for (const [height, length, tilt] of [[0.42, 0.42, 0.85], [0.64, 0.38, 0.7], [0.84, 0.3, 0.5]]) {
      for (const side of [-1, 1]) {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, length, 5), stemMat);
        branch.position.set(side * length * 0.3, height, 0);
        branch.rotation.z = side * tilt;
        root.add(branch);
        branchTips.push({ x: side * length * 0.52, y: height + length * 0.3 * Math.cos(tilt), z: 0 });
      }
    }
    for (const tip of branchTips) {
      const leafPivot = new THREE.Group();
      leafPivot.position.set(tip.x, tip.y, tip.z);
      leafPivot.rotation.y = random() * Math.PI * 2;
      const leaf = new THREE.Mesh(leafGeometry(0.26 + random() * 0.06), leafMat);
      leaf.rotation.x = -0.95 - random() * 0.2;
      leafPivot.add(leaf);
      root.add(leafPivot);
      visual.leaves.push({ mesh: leaf, minStage: 0.1 });
    }

    const nodeHeights = [0.3, 0.5, 0.7];
    const nodeStages = [0.02, 0.1, 0.24];
    const leafLengths = [0.42, 0.48, 0.52];
    nodeHeights.forEach((height, node) => {
      const pivot = new THREE.Group();
      pivot.position.y = height;
      pivot.rotation.y = random() * Math.PI * 2;
      root.add(pivot);

      const count = node === 2 ? 3 : 4;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (node % 2) * 0.36 + random() * 0.2;
        const leafPivot = new THREE.Group();
        leafPivot.rotation.y = angle;
        const mesh = new THREE.Mesh(leafGeometry(leafLengths[node] + (random() - 0.5) * 0.04), leafMat);
        mesh.rotation.x = -1.05 - node * 0.07 - random() * 0.3;
        mesh.rotation.z = (random() - 0.5) * 0.3;
        mesh.position.y = 0.015;
        leafPivot.add(mesh);
        pivot.add(leafPivot);
        visual.leaves.push({ mesh, minStage: nodeStages[node] });
      }
    });

    const budHex = mixHex(0x556b30, strain.bud, 0.14);
    const budBase = new THREE.Color(budHex);
    const budMat = new THREE.MeshStandardMaterial({
      color: budBase.clone(), roughness: 1, metalness: 0, flatShading: true,
      emissive: budBase.clone().multiplyScalar(0.04), emissiveIntensity: 0.25
    });
    budMat.userData.owned = true;
    const budMatLight = new THREE.MeshStandardMaterial({
      color: new THREE.Color(mixHex(budHex, 0x9bb06d, 0.4)), roughness: 0.98, metalness: 0, flatShading: true,
      emissive: budBase.clone().multiplyScalar(0.05), emissiveIntensity: 0.25
    });
    budMatLight.userData.owned = true;
    const pistilMat = new THREE.MeshStandardMaterial({
      color: 0xe98f3f, emissive: 0x7a3608, emissiveIntensity: 0.35, roughness: 0.75
    });
    pistilMat.userData.owned = true;
    // Sugar leaves sit on top of the buds, so keep them bright even from behind.
    const sugarMat = new THREE.MeshStandardMaterial({
      map: leafTexture(), color: 0xc8dca8, roughness: 0.95, metalness: 0,
      side: THREE.DoubleSide, alphaTest: 0.45, emissive: 0x10200a, emissiveIntensity: 0.45
    });
    sugarMat.userData.owned = true;

    const buds = new THREE.Group();
    const colas = [
      { x: 0, y: 1.2, z: 0, scale: 1 },
      { x: -0.19, y: 1.02, z: 0.03, scale: 0.78 },
      { x: 0.2, y: 1.03, z: -0.02, scale: 0.76 },
      { x: -0.12, y: 0.84, z: -0.11, scale: 0.6 },
      { x: 0.13, y: 0.82, z: 0.11, scale: 0.58 }
    ];
    const nugGeometry = budGeometry(0.055);
    for (const cola of colas) {
      const cluster = new THREE.Group();
      cluster.position.set(cola.x, cola.y, cola.z);
      // Solid inner mass: gaps between nugs read as shaded bud, never as holes.
      const core = new THREE.Mesh(budGeometry(0.09), budMat);
      core.scale.set(1, 1.7, 1);
      core.position.y = 0.01;
      cluster.add(core);
      for (let i = 0; i < 30; i++) {
        const nug = new THREE.Mesh(nugGeometry, i % 6 === 0 ? budMatLight : budMat);
        if (i < 6) {
          // Core nugs close the middle of the cola so no gaps show through.
          nug.position.set((random() - 0.5) * 0.07, (random() - 0.5) * 0.18, (random() - 0.5) * 0.07);
        } else {
          nug.position.set((random() - 0.5) * 0.17, (random() - 0.5) * 0.33, (random() - 0.5) * 0.17);
        }
        nug.scale.set(0.75 + random() * 0.45, 1.1 + random() * 0.55, 0.75 + random() * 0.45);
        nug.rotation.set(random() * 3, random() * 3, random() * 3);
        cluster.add(nug);
      }
      for (let i = 0; i < 6; i++) {
        const sugar = new THREE.Mesh(leafGeometry(0.13 + random() * 0.05), sugarMat);
        const angle = random() * Math.PI * 2;
        sugar.position.set(Math.cos(angle) * 0.12, -0.12 + random() * 0.26, Math.sin(angle) * 0.12);
        sugar.rotation.set(-1.05 - random() * 0.45, angle + Math.PI / 2, 0);
        cluster.add(sugar);
      }
      for (let i = 0; i < 14; i++) {
        const pistil = new THREE.Mesh(new THREE.ConeGeometry(0.0065, 0.07, 4), pistilMat);
        const angle = random() * Math.PI * 2;
        const distance = 0.11 + random() * 0.05;
        pistil.position.set(Math.cos(angle) * distance, (random() - 0.5) * 0.26, Math.sin(angle) * distance);
        pistil.rotation.z = -Math.cos(angle) * 0.9;
        pistil.rotation.x = Math.sin(angle) * 0.9;
        cluster.add(pistil);
      }
      cluster.scale.setScalar(cola.scale);
      buds.add(cluster);
    }
    root.add(buds);
    visual.buds = buds;

    const fertGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowMap, color: 0x9dff5e, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    fertGlow.scale.set(0.85, 0.85, 1);
    fertGlow.position.y = 1.25;
    fertGlow.visible = false;
    root.add(fertGlow);
    visual.fertGlow = fertGlow;

    visual.plantRoot = root;
    visual.group.add(root);
  }

  /* ------------------------------------------------------------- dust */

  buildDust() {
    const count = 260;
    const positions = new Float32Array(count * 3);
    const random = seededRandom(12345);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() - 0.5) * 26;
      positions[i * 3 + 1] = random() * 8;
      positions[i * 3 + 2] = (random() - 0.5) * 18 - 1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.04, map: this.glowMap, color: 0xd7ffe4, transparent: true,
      opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    this.dust = new THREE.Points(geometry, material);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  /* ---------------------------------------------------------- particles */

  burst(index, color = 0x9dff5e) {
    const visual = this.podVisuals[index];
    if (!visual) return;
    const random = seededRandom((Date.now() & 0xffffff) + index * 13);
    const count = 34;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const origin = visual.group.position;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = 2.1 + random() * 0.5;
      positions[i * 3 + 2] = origin.z;
      const angle = random() * Math.PI * 2;
      const speed = 0.6 + random() * 1.5;
      velocities.push(new THREE.Vector3(
        Math.cos(angle) * speed * 0.7,
        0.8 + random() * 1.6,
        Math.sin(angle) * speed * 0.7
      ));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.11, map: this.glowMap, color, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.scene.add(points);
    this.bursts.push({ points, velocities, life: 0, maxLife: 1.25, geometry, material });
  }

  /* ------------------------------------------------------------ events */

  bindEvents() {
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);

    let downX = 0;
    let downY = 0;
    let downTime = 0;
    this.canvas.addEventListener('pointerdown', event => {
      downX = event.clientX;
      downY = event.clientY;
      downTime = performance.now();
    });
    this.canvas.addEventListener('pointerup', event => {
      const distance = Math.hypot(event.clientX - downX, event.clientY - downY);
      if (distance > 10 || performance.now() - downTime > 700) return;
      const index = this.pick(event.clientX, event.clientY);
      if (index >= 0) this.onPick(index);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
      const index = this.pick(event.clientX, event.clientY);
      if (index !== this.hovered) {
        this.hovered = index;
        this.canvas.style.cursor = index >= 0 ? 'pointer' : 'default';
      }
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.hovered = -1;
      this.canvas.style.cursor = 'default';
      this.pointer.x = 0;
      this.pointer.y = 0;
    });
  }

  pick(clientX, clientY) {
    if (!this.camera || this.failed) return -1;
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.podGroups, true);
    if (!hits.length) return -1;
    let object = hits[0].object;
    while (object && object.userData.pod === undefined) object = object.parent;
    return object ? object.userData.pod : -1;
  }

  setSelected(index) {
    this.selected = index;
  }

  /* ------------------------------------------------------------ layout */

  resize() {
    if (this.failed || !this.renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.mobile = width < 860;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = this.mobile ? 50 : 47;

    this.basePos = this.mobile
      ? new THREE.Vector3(0, 8.9, 14.8)
      : new THREE.Vector3(0, 7.7, 12.4);
    this.baseTarget = this.mobile
      ? new THREE.Vector3(0, 0.65, -0.5)
      : new THREE.Vector3(1.9, 1.5, -0.5);
    this.camera.position.copy(this.basePos);
    this.camera.lookAt(this.baseTarget);
    this.camera.updateProjectionMatrix();

    this.podVisuals.forEach((visual, index) => this.placePod(visual, index));
    this.width = width;
    this.height = height;
  }

  /* -------------------------------------------------------------- frame */

  update(dt) {
    if (this.failed || !this.scene) return;
    const time = this.clock.elapsedTime;

    // Camera parallax.
    const targetX = this.basePos.x + this.pointer.x * 0.65;
    const targetY = this.basePos.y - this.pointer.y * 0.32;
    this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 3);
    this.camera.position.y += (targetY - this.camera.position.y) * Math.min(1, dt * 3);
    this.camera.lookAt(this.baseTarget);

    // Plants.
    this.podVisuals.forEach((visual, index) => {
      const plant = this.state.pods[index]?.plant;
      if (!visual.plantRoot || !plant) return;
      const progress = plant.progress;
      const scale = 0.45 + 1.0 * easeOut(progress);
      visual.plantRoot.scale.setScalar(scale);
      visual.plantRoot.rotation.z = Math.sin(time * 0.7 + index * 1.7) * 0.016;
      visual.plantRoot.rotation.x = Math.cos(time * 0.5 + index) * 0.008;

      for (const leaf of visual.leaves) {
        leaf.mesh.visible = progress >= leaf.minStage;
      }
      if (visual.buds) {
        const budProgress = smoothstep(0.48, 0.92, progress);
        visual.buds.visible = budProgress > 0.02;
        visual.buds.scale.setScalar(0.25 + 0.75 * budProgress);
      }
      if (visual.fertGlow) {
        visual.fertGlow.visible = Boolean(plant.fertilized);
        visual.fertGlow.material.opacity = 0.25 + Math.sin(time * 2.2 + index) * 0.1;
      }
      if (visual.leafMat) {
        const dryness = Math.min(0.85, (1 - plant.health) * 0.9);
        visual.leafMat.color.copy(visual.leafBase).lerp(new THREE.Color(0x9d8b2e), dryness);
      }

      if (visual.ring) {
        const isSelected = this.selected === index;
        const isHovered = this.hovered === index;
        visual.ring.visible = isSelected || isHovered;
        visual.ringMat.opacity = isSelected ? 0.9 : 0.42;
        const pulse = progress >= 1 ? 1 + Math.sin(time * 4) * 0.06 : 1;
        visual.ring.scale.setScalar(pulse);
      }
      if (visual.glow) {
        visual.glow.material.opacity = 0.42 + Math.sin(time * 1.6 + index * 2.1) * 0.08;
      }
      if (visual.cone) {
        visual.cone.material.opacity = 0.038 + Math.sin(time * 1.3 + index) * 0.008;
      }
    });

    // Dust drift.
    if (this.dust) {
      const positions = this.dust.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += dt * 0.06;
        positions[i] += Math.sin(time * 0.2 + positions[i + 2]) * dt * 0.01;
        if (positions[i + 1] > 8) positions[i + 1] = 0.1;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }

    // Particle bursts.
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.life += dt;
      const positions = burst.geometry.attributes.position.array;
      for (let p = 0; p < burst.velocities.length; p++) {
        const velocity = burst.velocities[p];
        velocity.y -= dt * 2.4;
        positions[p * 3] += velocity.x * dt;
        positions[p * 3 + 1] += velocity.y * dt;
        positions[p * 3 + 2] += velocity.z * dt;
      }
      burst.geometry.attributes.position.needsUpdate = true;
      burst.material.opacity = Math.max(0, 1 - burst.life / burst.maxLife);
      if (burst.life >= burst.maxLife) {
        this.scene.remove(burst.points);
        burst.geometry.dispose();
        burst.material.dispose();
        this.bursts.splice(i, 1);
      }
    }

    if (this.signGlow) {
      this.signGlow.material.opacity = 0.3 + Math.sin(time * 1.2) * 0.035;
    }

    this.renderer.render(this.scene, this.camera);
  }

  markerPosition(index) {
    if (this.failed || !this.camera) return { x: 0, y: 0, visible: false };
    const visual = this.podVisuals[index];
    this.tmp.set(visual.group.position.x, 3.55, visual.group.position.z);
    this.tmp.project(this.camera);
    return {
      x: (this.tmp.x * 0.5 + 0.5) * this.width,
      y: (-this.tmp.y * 0.5 + 0.5) * this.height,
      visible: this.tmp.z < 1
    };
  }
}
