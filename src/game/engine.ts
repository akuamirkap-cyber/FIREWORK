import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  FIRE_TYPES,
  MAX_BLAST_RADIUS,
  autoInterval,
  comboStep,
  fmt,
  fuseMult,
  incomeMult,
  radiusOf,
  sizeOf,
  valueOf,
  type FireType,
  type ModelId,
} from "./config";
import { sfx } from "./audio";
import * as store from "./store";
import { F_BOUNCY, OFF_X, OFF_Y, OFF_Z, VoxelWorld, makeCarved } from "./voxelWorld";

type Rgb = [number, number, number];
const _c = new THREE.Color();
const rgb = (hex: number): Rgb => {
  _c.setHex(hex);
  return [_c.r, _c.g, _c.b];
};
const rr = (a: number, b: number) => a + Math.random() * (b - a);

/** colour pushed into HDR (>1) so the bloom pass turns it into a soft glow */
const rgbG = (hex: number, k: number): Rgb => {
  _c.setHex(hex);
  return [_c.r * k, _c.g * k, _c.b * k];
};

// Glow colours are pushed just past the bloom threshold (~1.2 luminance) - enough to
// shimmer, not enough to wash the whole screen out.
const FIRE0 = rgbG(0xfff3b0, 1.9);
const FIRE1 = rgbG(0xf0561a, 1.25);
const SMOKE0 = rgb(0xa39a94);
const SMOKE1 = rgb(0xe6e1dc);
const SPARK0 = rgbG(0xffe680, 2.2);
const SPARK1 = rgbG(0xff5a14, 1.4);
const EMBER0 = rgbG(0xffb347, 1.7);
const EMBER1 = rgbG(0x8a1c08, 0.8);
const DUST0 = rgb(0xece0c8);
const DUST1 = rgb(0xa09378);
const WHITE = rgbG(0xffffff, 2.4);

const BURST_PALETTES: [Rgb, Rgb][] = [
  [rgbG(0xff4d6d, 2.5), rgbG(0x8a1030, 1.1)],
  [rgbG(0xffd23f, 1.9), rgbG(0xff7a00, 1.2)],
  [rgbG(0x4cc9f0, 2.0), rgbG(0x1d4ed8, 1.15)],
  [rgbG(0x7bf16b, 1.9), rgbG(0x0b8a3a, 1.1)],
  [rgbG(0xc77dff, 2.1), rgbG(0x5a189a, 1.15)],
  [rgbG(0xffffff, 2.1), rgbG(0x9bb0d0, 1.15)],
];
/** particles whose colour is one of these get stretched into streaks + flicker */
const SPARKY: Rgb[] = [SPARK0, ...BURST_PALETTES.map((p) => p[0])];

/** calmer palettes (kept just under the bloom threshold) for fountains and mid-air bursts */
const SOFT_PALETTES: [Rgb, Rgb][] = BURST_PALETTES.map((p) => [
  [p[0][0] * 0.66, p[0][1] * 0.66, p[0][2] * 0.66] as Rgb,
  [p[1][0] * 0.8, p[1][1] * 0.8, p[1][2] * 0.8] as Rgb,
]);
SPARKY.push(...SOFT_PALETTES.map((p) => p[0]));

const GLINT = rgbG(0xfff4d0, 1.12);
/** bright paper colours; channel max > 1.05 so they are not darkened at night */
const CONFETTI: Rgb[] = [0xff3b6b, 0xffd23f, 0x3bd6ff, 0x5dff7a, 0xc77dff, 0xff9f1c, 0xff6fd8, 0xffffff].map(
  (h) => rgbG(h, 1.12)
);
const BOLT0 = rgbG(0xeaf6ff, 1.55);
const BOLT1 = rgbG(0x4d8dff, 1.15);
const VOID0 = rgbG(0xe0c3ff, 1.25);
const VOID1 = rgbG(0x7c3aed, 0.95);
const G_THROW = 21; // thrown crackers float down gently

/** hex colour helper for lerping lights / sky */
const _ca = new THREE.Color();
const _cb = new THREE.Color();
const mixHex = (out: THREE.Color, a: number, b: number, t: number) =>
  out.setHex(a).lerp(_cb.setHex(b), t);

export interface EngineHooks {
  onFloat?: (
    x: number,
    y: number,
    text: string,
    kind: "coin" | "combo" | "chain" | "bonus",
    size: number
  ) => void;
  onFlash?: (intensity: number) => void;
  onTheme?: (bg: [string, string], name: string) => void;
}

interface Cracker {
  group: THREE.Group;
  bodies: THREE.Mesh[];
  origMats: THREE.Material[];
  flashOn: boolean;
  tip: THREE.Mesh; // glowing end of the burning fuse
  fuseMesh: THREE.Mesh | null;
  fuseBase: number; // local y where the fuse starts
  fuseLen: number;
  fuseX: number;
  lieW: number; // half thickness (used to rest on its side)
  lie: boolean; // rests on its side after being thrown
  scale: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  rz: number;
  ax: number; // tumble speed
  az: number;
  heading: number;
  spin: number;
  yOff: number; // visual-only vertical offset (smooths step-ups)
  age: number;
  fuse: number; // seconds until detonation / ignition
  beat: number; // tense swell right before the bang
  type: FireType;
  R: number;
  value: number; // coin multiplier (already includes the mercon's level)
  lvl: number;
  landed: boolean;
  landT: number;
  minor: boolean;
  thrown: boolean;
  bounces: number;
  active: boolean; // rocket flying / top roaming / fountain spraying
  actT: number;
  actDur: number;
  acc: number;
  sacc: number;
  seed: number;
  y0: number;
  pal: [Rgb, Rgb];
  g: number; // gravity: thrown crackers float down gently
  hop: number; // kodok: landings so far
  hopMax: number;
  wait: number;
  swell: number; // kodok / petir: time left in the pre-blast swell (-1 = not started)
  bolts: number; // petir: strikes still to come
  boltT: number;
  hover: number; // lubang hitam: 0..1 levitation
  spinSpeed: number; // gasing accelerates every revolution, capped at top speed
  tail: THREE.Group[]; // ular: independent body segments following the head
  trail: THREE.Vector3[]; // ular: recorded 3D path, including climbing height
  trailAcc: number;
  targetX: number;
  targetY: number;
  targetZ: number;
}

interface Comet {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  c0: Rgb;
  c1: Rgb;
  R: number;
  value: number;
  snd: "boom" | "crack";
  power: number;
}

interface ExplodeOpts {
  value: number;
  power: number;
  minor?: boolean;
  snd?: "boom" | "crack";
  chain?: number;
  nuke?: boolean;
  paper?: number[];
  shell?: number[];
  lvl?: number; // the cracker's level: more power, sound & festivity
  confetti?: number; // > 0: the paper cracker, a storm of colourful paper
  style?: string; // final explosion signature
}

interface GuardDummy {
  group: THREE.Group;
  rig: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  ax: number;
  ay: number;
  az: number;
  state: "stand" | "fly" | "down";
  t: number;
  bounces: number;
  seed: number;
  joints: Float32Array; // arm/leg/head angles
  jointV: Float32Array; // angular velocities, integrated with spring constraints
  impact: number;
  mass: number;
}

const FX_N = 8000;
const DEB_N = 5200;
const GRAV = 26;
const G_CRACKER = 34;

const _tf = new THREE.Vector3();
const _tu = new THREE.Vector3();
const _tr = new THREE.Vector3();
const _tp = new THREE.Vector3();

function writeMat(
  a: Float32Array,
  o: number,
  x: number,
  y: number,
  z: number,
  qx: number,
  qy: number,
  qz: number,
  qw: number,
  s: number
) {
  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;
  a[o] = (1 - (yy + zz)) * s;
  a[o + 1] = (xy + wz) * s;
  a[o + 2] = (xz - wy) * s;
  a[o + 3] = 0;
  a[o + 4] = (xy - wz) * s;
  a[o + 5] = (1 - (xx + zz)) * s;
  a[o + 6] = (yz + wx) * s;
  a[o + 7] = 0;
  a[o + 8] = (xz + wy) * s;
  a[o + 9] = (yz - wx) * s;
  a[o + 10] = (1 - (xx + yy)) * s;
  a[o + 11] = 0;
  a[o + 12] = x;
  a[o + 13] = y;
  a[o + 14] = z;
  a[o + 15] = 1;
}

function zeroMat(a: Float32Array, i: number) {
  const o = i * 16;
  for (let k = 0; k < 16; k++) a[o + k] = 0;
  a[o + 15] = 1;
}

export class Engine {
  hooks: EngineHooks = {};

  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private world = new VoxelWorld();
  private raycaster = new THREE.Raycaster();
  private ro: ResizeObserver;
  private raf = 0;
  private last = 0;
  private time = 0;
  private disposed = false;
  private contextLost = false;

  // camera state
  private yaw = 0.78;
  private pitch = 0.76;
  private zoom = 1;
  private fitDist = 45;
  private baseFov = 32;
  private trauma = 0;
  private punch = 0;
  private userIdle = 0;
  private target = new THREE.Vector3(0, 0.5, 0);

  // time
  private ts = 1;
  private slowT = 0;
  private slowCool = 0;
  private tension = 0;
  private tensionTarget = 0;
  private lastMinorFloat = 0;

  // lights
  private flashLight: THREE.PointLight;
  private flashI = 0;
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private glowLights: THREE.PointLight[] = [];

  // night / glow / sky
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private nightT = 1;
  private lastGlow = -1;
  private glare = 0; // recent bright-particle load; calms the bloom when the screen is full of fire
  private bloomBase = 0.3;
  private attr = { on: false, x: 0, y: 0, z: 0, k: 0, r: 0 }; // black-hole gravity well
  private skyCanvas = document.createElement("canvas");
  private skyTex = new THREE.CanvasTexture(this.skyCanvas);
  private starsA!: THREE.Points;
  private starsB!: THREE.Points;
  private orb!: THREE.Sprite; // sun by day, moon by night
  private orbDay!: THREE.CanvasTexture;
  private orbNight!: THREE.CanvasTexture;
  private cloudMat!: THREE.MeshLambertMaterial;
  private fxDim: Rgb = [1, 1, 1];
  private rings: { mesh: THREE.Mesh; t: number; dur: number; R: number }[] = [];
  private ringHead = 0;

  // fx
  private fx: THREE.InstancedMesh;
  private fxPos = new Float32Array(FX_N * 3);
  private fxVel = new Float32Array(FX_N * 3);
  private fxAge = new Float32Array(FX_N);
  private fxLife = new Float32Array(FX_N);
  private fxS0 = new Float32Array(FX_N);
  private fxS1 = new Float32Array(FX_N);
  private fxG = new Float32Array(FX_N);
  private fxDrag = new Float32Array(FX_N);
  private fxDelay = new Float32Array(FX_N);
  private fxStreak = new Float32Array(FX_N);
  private fxFlat = new Uint8Array(FX_N); // paper flakes: thin, spinning, fluttering
  private fxFlick = new Uint8Array(FX_N);
  private fxC0 = new Float32Array(FX_N * 3);
  private fxC1 = new Float32Array(FX_N * 3);
  private fxAlive = new Uint8Array(FX_N);
  private fxHead = 0;
  private fxWasAny = false;

  // debris
  private deb: THREE.InstancedMesh;
  private dPos = new Float32Array(DEB_N * 3);
  private dVel = new Float32Array(DEB_N * 3);
  private dQ = new Float32Array(DEB_N * 4);
  private dAv = new Float32Array(DEB_N * 3);
  private dSize = new Float32Array(DEB_N);
  private dT = new Float32Array(DEB_N);
  private dBounce = new Float32Array(DEB_N);
  private dState = new Uint8Array(DEB_N);
  private dFree: number[] = [];
  private dSteal = 0;
  private dHW = 0;
  private dWasAny = false;
  private dColorDirty = false;

  // gameplay
  private crackers: Cracker[] = [];
  private guards: GuardDummy[] = [];
  private comets: Comet[] = [];
  private events: { t: number; fn: () => void }[] = [];
  private carved = makeCarved();
  private carved2 = makeCarved();
  private seed = 1;
  private comboT = 0;
  private autoT = 0;
  private collapseQueued = false;
  private phase: "play" | "clear" | "out" | "in" = "play";
  private phaseT = 0;
  private lastProgress = -1;
  private clouds = new THREE.Group();
  private snow!: THREE.Points;
  private snowVel = new Float32Array(900);

  // models
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private matCache = new Map<number, THREE.MeshLambertMaterial>();
  // HDR colours: the blink and the burning fuse tip glow through the bloom pass
  private flashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.7, 1.3) });
  private tipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.35, 0.3) });

  // input
  private ptr: {
    id: number;
    x: number;
    y: number;
    moved: boolean;
    held: boolean;
    t: number;
    holdAcc: number;
  } | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    // MSAA lives in the post-processing target; the canvas itself needs none
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    // Keep enough GPU memory for the larger 40x40 world and bloom chain. At 1.75x,
    // HalfFloat post-processing could exceed mobile tile memory and lose the context.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x070a26, 1);
    const cv = this.renderer.domElement;
    cv.style.display = "block";
    cv.style.touchAction = "none";
    cv.style.width = "100%";
    cv.style.height = "100%";
    container.appendChild(cv);
    cv.addEventListener("webglcontextlost", this.onContextLost, false);
    cv.addEventListener("webglcontextrestored", this.onContextRestored, false);

    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 4, 400);

    // lights
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xb9a98f, 1.75);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.5);
    this.sun = sun;
    sun.position.set(-20, 34, 16);
    sun.castShadow = true;
    const ss = coarse ? 1024 : 2048;
    sun.shadow.mapSize.set(ss, ss);
    const sc = sun.shadow.camera;
    sc.left = -24;
    sc.right = 24;
    sc.top = 24;
    sc.bottom = -24;
    sc.near = 1;
    sc.far = 110;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.scene.add(sun.target);

    this.flashLight = new THREE.PointLight(0xffa24a, 0, 70, 2);
    this.scene.add(this.flashLight);
    // a fixed set of small lights that follow burning fuses / fountains (constant count = no shader recompiles)
    for (let i = 0; i < 3; i++) {
      const gl = new THREE.PointLight(0xff9d45, 0, 9, 2);
      this.scene.add(gl);
      this.glowLights.push(gl);
    }

    // world (night is the default look)
    this.scene.add(this.world.group);
    const st = store.getState();
    this.nightT = st.night ? 1 : 0;
    this.world.night = st.night;
    this.world.generate(st.stage);
    this.resetGuards();

    // fx mesh
    const fxMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.fx = new THREE.InstancedMesh(this.boxGeo, fxMat, FX_N);
    this.fx.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FX_N * 3), 3);
    this.fx.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fx.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.fx.frustumCulled = false;
    for (let i = 0; i < FX_N; i++) zeroMat(this.fx.instanceMatrix.array as Float32Array, i);
    this.scene.add(this.fx);

    // debris mesh
    const debMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.deb = new THREE.InstancedMesh(this.boxGeo, debMat, DEB_N);
    this.deb.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DEB_N * 3), 3);
    this.deb.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.deb.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.deb.frustumCulled = false;
    this.deb.castShadow = true;
    this.deb.receiveShadow = true;
    for (let i = 0; i < DEB_N; i++) zeroMat(this.deb.instanceMatrix.array as Float32Array, i);
    for (let i = DEB_N - 1; i >= 0; i--) this.dFree.push(i);
    this.scene.add(this.deb);

    this.buildClouds();
    this.scene.add(this.clouds);

    this.buildSky();
    this.buildSnow();
    this.buildBlastMeshes();
    this.buildPost(!!coarse);
    this.pushTheme();
    this.applyLook();

    // input
    cv.addEventListener("pointerdown", this.onDown);
    cv.addEventListener("pointermove", this.onMove);
    cv.addEventListener("pointerup", this.onUp);
    cv.addEventListener("pointercancel", this.onCancel);
    cv.addEventListener("wheel", this.onWheel, { passive: true });
    cv.addEventListener("contextmenu", this.onCtx);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    this.last = performance.now() / 1000;
    this.raf = requestAnimationFrame(this.loop);

    store.showBanner(`MISI ${st.stage}`, this.world.theme.mission);
  }

  /* =============================================================== setup */

  pushTheme() {
    this.hooks.onTheme?.(this.world.theme.bg, this.world.theme.name);
    this.drawSky();
  }

  /* ------------------------------------------------------------ sky, stars, sun & moon */

  private makeOrbTexture(moon: boolean) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const halo = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    if (moon) {
      halo.addColorStop(0, "rgba(200,216,255,0.7)");
      halo.addColorStop(0.3, "rgba(150,172,255,0.26)");
      halo.addColorStop(0.65, "rgba(120,140,255,0.07)");
      halo.addColorStop(1, "rgba(120,140,255,0)");
    } else {
      halo.addColorStop(0, "rgba(255,250,215,1)");
      halo.addColorStop(0.14, "rgba(255,238,170,0.8)");
      halo.addColorStop(0.35, "rgba(255,205,120,0.28)");
      halo.addColorStop(0.7, "rgba(255,190,110,0.07)");
      halo.addColorStop(1, "rgba(255,190,110,0)");
    }
    g.fillStyle = halo;
    g.fillRect(0, 0, 256, 256);
    // the disc (blocky edge keeps the voxel look)
    const r = moon ? 40 : 46;
    g.fillStyle = moon ? "#f2f5ff" : "#fff8dc";
    g.beginPath();
    g.arc(128, 128, r, 0, Math.PI * 2);
    g.fill();
    if (moon) {
      g.fillStyle = "rgba(150,164,205,0.5)";
      for (const [x, y, rr2] of [
        [112, 112, 9],
        [140, 130, 12],
        [120, 146, 6],
        [146, 108, 5],
      ]) {
        g.beginPath();
        g.arc(x, y, rr2, 0, Math.PI * 2);
        g.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private buildSky() {
    this.skyCanvas.width = 4;
    this.skyCanvas.height = 256;
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.skyTex.generateMipmaps = false;
    this.skyTex.minFilter = THREE.LinearFilter;
    this.skyTex.magFilter = THREE.LinearFilter;
    this.scene.background = this.skyTex;
    this.scene.add(this.camera); // sky objects below are children of the camera

    // stars: a screen-space backdrop, two groups that twinkle against each other
    const mk = (n: number) => {
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      const uv = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        uv[i * 3] = rr(-1, 1);
        uv[i * 3 + 1] = rr(-1, 1);
        uv[i * 3 + 2] = rr(200, 260);
        const tint = Math.random();
        const br = Math.random() < 0.09 ? rr(2.2, 3.2) : rr(0.55, 1.05);
        col[i * 3] = (tint < 0.2 ? 1 : tint < 0.6 ? 0.82 : 1) * br;
        col[i * 3 + 1] = (tint < 0.2 ? 0.9 : tint < 0.6 ? 0.9 : 0.95) * br;
        col[i * 3 + 2] = (tint < 0.2 ? 0.7 : tint < 0.6 ? 1 : 1) * br;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        size: 2.4,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        fog: false,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.userData.uv = uv;
      this.camera.add(pts);
      return pts;
    };
    this.starsA = mk(260);
    this.starsB = mk(260);

    this.orbDay = this.makeOrbTexture(false);
    this.orbNight = this.makeOrbTexture(true);
    this.orb = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.orbNight,
        transparent: true,
        depthWrite: false,
        fog: false,
        color: new THREE.Color(1.2, 1.2, 1.4),
      })
    );
    this.orb.frustumCulled = false;
    this.camera.add(this.orb);
  }

  /** (re)place stars & the sun/moon so they always fill the current view */
  private layoutSky() {
    const halfTan = Math.tan((this.baseFov * Math.PI) / 360);
    for (const pts of [this.starsA, this.starsB]) {
      const uv = pts.userData.uv as Float32Array;
      const pos = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const d = uv[i * 3 + 2];
        const hh = d * halfTan * 1.04;
        pos.setXYZ(i, uv[i * 3] * hh * this.camera.aspect, uv[i * 3 + 1] * hh, -d);
      }
      pos.needsUpdate = true;
    }
    const d = 150;
    const hh = d * halfTan;
    this.orb.position.set(0.6 * hh * this.camera.aspect, 0.62 * hh, -d);
    const sc = 30 * Math.min(1, Math.max(0.62, this.camera.aspect));
    this.orb.scale.set(sc, sc, 1);
  }

  private drawSky() {
    const ctx = this.skyCanvas.getContext("2d");
    if (!ctx) return;
    const n = this.nightT;
    const th = this.world.theme;
    const mix = (a: string, b: string) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), n).getHexString();
    const dayMid = "#" + new THREE.Color(th.bg[0]).lerp(new THREE.Color(th.bg[1]), 0.5).getHexString();
    const g = ctx.createLinearGradient(0, 0, 0, this.skyCanvas.height);
    g.addColorStop(0, mix(th.bg[0], th.night[0]));
    g.addColorStop(0.5, mix(dayMid, th.night[1]));
    g.addColorStop(1, mix(th.bg[1], th.night[2]));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.skyCanvas.width, this.skyCanvas.height);
    this.skyTex.needsUpdate = true;
  }

  /** blend every light / sky / glow setting between day (0) and night (1) */
  private applyLook() {
    const n = this.nightT;
    // night stays a bright "cartoon night": cool moonlight, still readable, colours alive
    mixHex(_ca, 0xffffff, 0xa0b4ff, n);
    this.hemi.color.copy(_ca);
    mixHex(_ca, 0xb9a98f, 0x55428f, n);
    this.hemi.groundColor.copy(_ca);
    this.hemi.intensity = 1.75 + 0.45 * n;
    mixHex(_ca, 0xfff1dc, 0xb4c6ff, n);
    this.sun.color.copy(_ca);
    this.sun.intensity = 2.5 + 0.3 * n;
    if (this.bloom) {
      // user-chosen glow level: 0 = off, 1 = soft (default), 2 = normal
      const gl = store.getState().glow;
      const gk = gl === 0 ? 0 : gl === 1 ? 1 : 1.7;
      this.bloom.enabled = gk > 0;
      this.bloomBase = (0.2 + 0.1 * n) * gk;
      this.bloom.radius = 0.35 + 0.1 * n;
      // high threshold: only genuinely emissive things glow, lit snow/sand/clouds never do
      this.bloom.threshold = 1.4 - 0.2 * n;
    }
    const sa = this.starsA.material as THREE.PointsMaterial;
    const sb = this.starsB.material as THREE.PointsMaterial;
    const tw = this.time * 1.9;
    sa.opacity = n * (0.7 + 0.3 * Math.sin(tw));
    sb.opacity = n * (0.7 + 0.3 * Math.sin(tw + Math.PI));
    this.starsA.visible = this.starsB.visible = n > 0.02;
    const moon = n > 0.5;
    const om = this.orb.material as THREE.SpriteMaterial;
    const want = moon ? this.orbNight : this.orbDay;
    if (om.map !== want) {
      om.map = want;
      om.needsUpdate = true;
    }
    if (moon) om.color.setRGB(1.2, 1.2, 1.4);
    else om.color.setRGB(1.25, 1.15, 0.9);
    mixHex(_ca, 0xffffff, 0x5c65ad, n);
    this.cloudMat.color.copy(_ca);
    this.fxDim = [1 - 0.4 * n, 1 - 0.38 * n, 1 - 0.26 * n];
    if (this.world.night !== moon) this.world.setNight(moon);
    this.drawSky();
  }

  /* ------------------------------------------------------------ bloom post-processing */

  private buildPost(coarse: boolean) {
    try {
      const w = Math.max(2, this.container.clientWidth);
      const h = Math.max(2, this.container.clientHeight);
      const rt = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        samples: coarse ? 0 : 2,
      });
      const composer = new EffectComposer(this.renderer, rt);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 1, 0.6, 0.8);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.bloom = bloom;
    } catch (err) {
      console.warn("Bloom tidak tersedia, memakai render biasa:", err);
      this.composer = null;
      this.bloom = null;
    }
  }

  /* ------------------------------------------------------------ fireball & shockwave meshes */

  private buildBlastMeshes() {
    const ring = new THREE.RingGeometry(0.8, 1, 56);
    const mk = (geo: THREE.BufferGeometry, flat: boolean) => {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.2, 1.4, 0.55),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      if (flat) mesh.rotation.x = -Math.PI / 2;
      this.scene.add(mesh);
      return { mesh, t: 1, dur: 1, R: 1 };
    };
    for (let i = 0; i < 6; i++) this.rings.push(mk(ring, true));
  }

  private blastGlow(cx: number, cy: number, cz: number, R: number, minor: boolean) {
    if (!minor) {
      const r = this.rings[this.ringHead];
      this.ringHead = (this.ringHead + 1) % this.rings.length;
      r.t = 0;
      r.dur = 0.34 + R * 0.02;
      r.R = R * 1.9 + 1.5;
      r.mesh.position.set(cx, cy, cz);
      r.mesh.visible = true;
    }
  }

  private updateBlastMeshes(dt: number) {
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) {
        r.mesh.visible = false;
        continue;
      }
      const e = 1 - Math.pow(1 - k, 2.4);
      r.mesh.scale.setScalar(Math.max(0.01, r.R * e));
      const m = r.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = Math.pow(1 - k, 1.4) * 0.5;
      m.color.setRGB(2.0 - 0.7 * k, 1.3 - 0.7 * k, 0.6);
    }
  }

  /* ------------------------------------------------------------ glow lights that follow the fire */

  private updateGlowLights() {
    const k = 0.4 + 0.6 * this.nightT;
    let n = 0;
    for (let pass = 0; pass < 2 && n < 3; pass++) {
      for (const c of this.crackers) {
        if (n >= 3) break;
        if ((pass === 0) !== c.active) continue;
        const L = this.glowLights[n++];
        // capped: a x10 cracker lights a wider area, but must never white-out the screen
        const sc = Math.min(4.5, Math.max(1, c.scale));
        const real = Math.max(1, c.scale);
        if (c.active) {
          const kind = c.type.kind;
          if (kind === "fountain") {
            L.color.setRGB(c.pal[0][0] * 0.4 + 0.6, c.pal[0][1] * 0.4 + 0.6, c.pal[0][2] * 0.4 + 0.6);
            L.intensity = (9 + Math.random() * 6) * k * Math.pow(sc, 1.05);
            L.distance = 14 + sc * 3;
            L.position.set(c.x, c.y + 1.8 * real, c.z);
          } else if (kind === "top") {
            L.color.setHex(0xffa24a);
            L.intensity = (14 + Math.random() * 8) * k * Math.pow(sc, 1.1);
            L.distance = 12 + sc * 2.5;
            L.position.set(c.x, c.y + 0.9 * real, c.z);
          } else {
            L.color.setHex(kind === "storm" ? 0x8ec0ff : kind === "hole" ? 0xb78cff : 0xffc27a);
            L.intensity = (kind === "storm" ? 20 + Math.random() * 14 : 16 + Math.random() * 7) * k;
            L.distance = 14;
            L.position.set(c.x, c.y + 0.4, c.z);
          }
        } else {
          const burnEnd = Math.max(0.05, c.fuse - c.beat);
          const p = Math.min(1, c.age / burnEnd);
          const inBeat = c.age >= burnEnd;
          L.color.setHex(inBeat ? 0xffd6a0 : 0xff9d45);
          const base = inBeat ? 26 : 3 + 9 * p;
          L.intensity = base * (0.8 + Math.random() * 0.4) * k * Math.pow(sc, 1.1);
          L.distance = 8 + sc * 2.2;
          L.position.set(c.x, c.y + 1.05 * real, c.z);
        }
      }
    }
    for (; n < 3; n++) this.glowLights[n].intensity = 0;
  }

  private buildClouds() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.cloudMat = mat;
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(this.boxGeo, mat);
        m.scale.set(rr(3, 6), rr(1.5, 2.4), rr(2.5, 4));
        m.position.set(k * 3.2 - n * 1.6, rr(-0.4, 0.5), rr(-1, 1));
        g.add(m);
      }
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
      const r = rr(24, 44);
      g.position.set(Math.cos(a) * r, rr(-20, -9), Math.sin(a) * r);
      g.rotation.y = Math.random() * 3;
      this.clouds.add(g);
    }
  }

  /** Persistent snow system, enabled only for the Salju mission. */
  private buildSnow() {
    const n = this.snowVel.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rr(-21, 21);
      pos[i * 3 + 1] = rr(-1, 25);
      pos[i * 3 + 2] = rr(-21, 21);
      this.snowVel[i] = rr(2.2, 5.8);
      const b = rr(0.72, 1.25);
      col[i * 3] = b * 0.9;
      col[i * 3 + 1] = b * 0.96;
      col[i * 3 + 2] = b * 1.1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.1,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      fog: false,
    });
    this.snow = new THREE.Points(geo, mat);
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);
  }

  private updateSnow(dt: number) {
    const active = this.world.theme.name === "Salju";
    this.snow.visible = active;
    if (!active) return;
    const a = this.snow.geometry.getAttribute("position") as THREE.BufferAttribute;
    const p = a.array as Float32Array;
    const wind = Math.sin(this.time * 0.37) * 1.8;
    for (let i = 0; i < this.snowVel.length; i++) {
      p[i * 3] += (wind + Math.sin(this.time * 1.7 + i) * 0.35) * dt;
      p[i * 3 + 1] -= this.snowVel[i] * dt;
      p[i * 3 + 2] += Math.cos(this.time * 0.9 + i * 0.17) * 0.45 * dt;
      if (p[i * 3 + 1] < -2) {
        p[i * 3] = rr(-21, 21);
        p[i * 3 + 1] = rr(20, 27);
        p[i * 3 + 2] = rr(-21, 21);
      }
      if (p[i * 3] > 23) p[i * 3] = -23;
      else if (p[i * 3] < -23) p[i * 3] = 23;
    }
    a.needsUpdate = true;
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    const vf = (this.baseFov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const dH = 16.5 / Math.tan(vf / 2);
    const dW = 18.5 / Math.tan(hf / 2);
    this.fitDist = Math.max(dH, dW);
    this.camera.updateProjectionMatrix();
    this.layoutSky();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const cv = this.renderer.domElement;
    cv.removeEventListener("pointerdown", this.onDown);
    cv.removeEventListener("pointermove", this.onMove);
    cv.removeEventListener("pointerup", this.onUp);
    cv.removeEventListener("pointercancel", this.onCancel);
    cv.removeEventListener("wheel", this.onWheel);
    cv.removeEventListener("contextmenu", this.onCtx);
    cv.removeEventListener("webglcontextlost", this.onContextLost);
    cv.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.composer?.dispose();
    this.renderer.dispose();
    if (cv.parentElement === this.container) this.container.removeChild(cv);
  }

  /* =============================================================== input */

  private onCtx = (e: Event) => e.preventDefault();

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    store.showBanner("GRAFIK DIJEDA", "Memulihkan GPU...");
  };

  private onContextRestored = () => {
    // Composer render targets and instanced buffers are safest rebuilt from a clean
    // engine. Progress is already persisted, so this cannot lose game state.
    store.showBanner("GPU PULIH", "Memuat ulang dunia...");
    window.setTimeout(() => window.location.reload(), 180);
  };

  private onDown = (e: PointerEvent) => {
    sfx.init();
    if (this.ptr) {
      // second finger = instant extra tap
      this.fireAt(e.clientX, e.clientY);
      return;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.ptr = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      held: false,
      t: performance.now(),
      holdAcc: 0,
    };
    this.userIdle = 0;
  };

  private dragStart = { x: 0, y: 0 };
  private onMove = (e: PointerEvent) => {
    const p = this.ptr;
    if (!p || p.id !== e.pointerId) return;
    if (!p.moved) {
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.hypot(dx, dy) > 9) {
        p.moved = true;
        this.dragStart.x = e.clientX;
        this.dragStart.y = e.clientY;
      }
      return;
    }
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    this.dragStart.x = e.clientX;
    this.dragStart.y = e.clientY;
    this.yaw -= dx * 0.007;
    this.pitch = Math.max(0.5, Math.min(1.15, this.pitch + dy * 0.004));
    this.userIdle = 0;
  };

  private onUp = (e: PointerEvent) => {
    const p = this.ptr;
    if (!p || p.id !== e.pointerId) return;
    if (!p.moved && !p.held) this.fireAt(e.clientX, e.clientY);
    this.ptr = null;
  };

  private onCancel = () => {
    this.ptr = null;
  };

  private onWheel = (e: WheelEvent) => {
    this.zoom = Math.max(0.65, Math.min(1.2, this.zoom * (1 + e.deltaY * 0.0008)));
  };

  private fireAt(clientX: number, clientY: number) {
    if (this.phase !== "play") return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const o = this.raycaster.ray.origin;
    const d = this.raycaster.ray.direction;
    const hit = this.world.raycast(o, d);
    if (!hit) return;
    let t: number;
    if (hit.nx !== 0) t = (hit.x + (hit.nx > 0 ? 1 : 0) - OFF_X - o.x) / d.x;
    else if (hit.ny !== 0) t = (hit.y + (hit.ny > 0 ? 1 : 0) - OFF_Y - o.y) / d.y;
    else t = (hit.z + (hit.nz > 0 ? 1 : 0) - OFF_Z - o.z) / d.z;
    const pt = new THREE.Vector3();
    if (!isFinite(t) || t < 0) {
      pt.set(hit.x + 0.5 - OFF_X, hit.y + 1 - OFF_Y, hit.z + 0.5 - OFF_Z);
    } else {
      pt.copy(o).addScaledVector(d, t);
    }
    if (!store.getState().tutorialDone) store.setState({ tutorialDone: true });
    this.launch(pt, { x: hit.nx, y: hit.ny, z: hit.nz }, store.getState().throwMode);
  }

  /* =============================================================== scheduling */

  private schedule(delay: number, fn: () => void) {
    this.events.push({ t: delay, fn });
  }

  /* =============================================================== launch */

  private launch(
    pt: THREE.Vector3,
    n: { x: number; y: number; z: number },
    thrown = false
  ) {
    if (this.crackers.length > 90) return;
    const st = store.getState();
    const type = FIRE_TYPES.find((f) => f.id === st.selected) ?? FIRE_TYPES[0];
    // everything about this mercon comes from ITS level (tap it in the HUD -> LEVEL UP)
    const lvl = store.fireLevel(st, type.id);
    const R = Math.min(MAX_BLAST_RADIUS, radiusOf(type, lvl));
    const size = sizeOf(type, lvl);
    const value = valueOf(type, lvl);
    const fuse = type.fuse * fuseMult(st.levels.fuse) * (1 + 0.03 * (lvl - 1));
    if (thrown) {
      sfx.swish();
      this.punch = Math.max(this.punch, 0.14);
    } else {
      sfx.tick();
    }
    // exactly ONE mercon per tap (the renteng is a single string of many)
    this.spawnSet(
      type,
      pt.x + n.x * 0.05,
      pt.y + n.y * 0.05,
      pt.z + n.z * 0.05,
      n.y > 0.5 ? 1.2 : 0,
      fuse,
      R,
      { size, value, lvl },
      thrown
    );
  }

  private spawnSet(
    type: FireType,
    x: number,
    y: number,
    z: number,
    drop: number,
    fuse: number,
    R: number,
    lv: { size: number; value: number; lvl: number },
    thrown: boolean
  ) {
    if (this.phase !== "play") return;
    if (type.kind === "string") {
      const a = Math.random() * Math.PI * 2;
      const gap = 1.05 + 0.3 * (lv.size - 1); // bigger crackers need more room
      const sx = Math.cos(a) * gap;
      const sz = Math.sin(a) * gap;
      for (let j = 0; j < type.count; j++) {
        const px = x + sx * (j - type.count / 2 + 0.5);
        const pz = z + sz * (j - type.count / 2 + 0.5);
        const ty = this.world.topY(Math.floor(px + OFF_X), Math.floor(pz + OFF_Z));
        if (ty < 0) continue;
        const spawn = () =>
          this.spawnCracker(type, px, ty + 1 - OFF_Y, pz, fuse + j * 0.07, R, {
            drop,
            minor: true,
            scale: 0.82 * lv.size,
            hiss: j === 0,
            thrown,
            value: lv.value,
            lvl: lv.lvl,
          });
        if (thrown && j > 0) {
          this.schedule(j * 0.04, () => {
            if (this.phase === "play") spawn();
          });
        } else spawn();
      }
    } else {
      this.spawnCracker(type, x, y, z, fuse, R, {
        drop,
        minor: false,
        scale: lv.size,
        hiss: true,
        thrown,
        value: lv.value,
        lvl: lv.lvl,
      });
    }
  }

  private mat(hex: number) {
    let m = this.matCache.get(hex);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color: hex });
      this.matCache.set(hex, m);
    }
    return m;
  }

  private buildModel(model: ModelId) {
    const group = new THREE.Group();
    const bodies: THREE.Mesh[] = [];
    const add = (
      hex: number,
      sx: number,
      sy: number,
      sz: number,
      px: number,
      y0: number,
      pz: number
    ) => {
      const m = new THREE.Mesh(this.boxGeo, this.mat(hex));
      m.scale.set(sx, sy, sz);
      m.position.set(px, y0 + sy / 2, pz);
      m.castShadow = true;
      group.add(m);
      bodies.push(m);
      return m;
    };
    // the fuse is a real mesh that shortens while it burns
    const fz = { mesh: null as THREE.Mesh | null, base: 0.9, len: 0.26, x: 0 };
    const addFuse = (len: number, y0: number, px = 0, thick = 0.07) => {
      fz.mesh = add(0x3b2a1a, thick, len, thick, px, y0, 0);
      fz.base = y0;
      fz.len = len;
      fz.x = px;
    };
    let lieW = 0.2;
    switch (model) {
      case "cabe":
        add(0xe3262e, 0.34, 0.8, 0.34, 0, 0, 0);
        add(0xffc533, 0.375, 0.1, 0.375, 0, 0.1, 0);
        add(0xffc533, 0.375, 0.1, 0.375, 0, 0.55, 0);
        add(0xfff1c9, 0.2, 0.2, 0.36, 0, 0.3, 0);
        add(0x7a1216, 0.26, 0.06, 0.26, 0, 0.8, 0);
        addFuse(0.3, 0.86);
        lieW = 0.19;
        break;
      case "bambu":
        add(0xb9d24f, 0.62, 0.5, 0.62, 0, 0, 0);
        add(0x6f8f2a, 0.7, 0.1, 0.7, 0, 0.5, 0);
        add(0xa9c640, 0.62, 0.45, 0.62, 0, 0.6, 0);
        add(0x6f8f2a, 0.7, 0.1, 0.7, 0, 1.05, 0);
        addFuse(0.34, 1.15, 0, 0.08);
        lieW = 0.35;
        break;
      case "tnt":
        add(0xd1281f, 0.28, 0.95, 0.28, -0.3, 0, 0);
        add(0xd1281f, 0.28, 0.95, 0.28, 0, 0, 0);
        add(0xd1281f, 0.28, 0.95, 0.28, 0.3, 0, 0);
        add(0x262626, 0.92, 0.16, 0.32, 0, 0.4, 0);
        addFuse(0.46, 0.95);
        lieW = 0.16;
        break;
      case "rocket":
        add(0xc9a26a, 0.07, 1.0, 0.07, 0, 0, 0);
        add(0xf4f4f4, 0.3, 0.9, 0.3, 0, 0.8, 0);
        add(0xe63946, 0.33, 0.18, 0.33, 0, 1.15, 0);
        add(0xe63946, 0.22, 0.2, 0.22, 0, 1.7, 0);
        add(0xe63946, 0.12, 0.16, 0.12, 0, 1.9, 0);
        add(0x2a9df4, 0.62, 0.18, 0.1, 0, 0.8, 0);
        add(0x2a9df4, 0.1, 0.18, 0.62, 0, 0.8, 0);
        addFuse(0.34, 0.5, 0.13, 0.06);
        lieW = 0.2;
        break;
      case "nuke":
        add(0x2d3748, 1.1, 0.8, 0.9, 0, 0.2, 0);
        add(0x2d3748, 0.9, 0.8, 1.1, 0, 0.2, 0);
        add(0x2d3748, 0.9, 1.1, 0.9, 0, 0.05, 0);
        add(0xffd60a, 1.13, 0.16, 1.13, 0, 0.5, 0);
        add(0x8895a7, 0.5, 0.15, 0.5, 0, 1.15, 0);
        addFuse(0.55, 1.3, 0, 0.1);
        lieW = 0.55;
        break;
      case "gasing":
        // a chunky spinning top - white bar makes the spin readable
        add(0x6b7280, 0.1, 0.14, 0.1, 0, 0, 0);
        add(0x14b8a6, 0.3, 0.14, 0.3, 0, 0.14, 0);
        add(0xf43f5e, 0.52, 0.14, 0.52, 0, 0.28, 0);
        add(0xfacc15, 0.7, 0.12, 0.7, 0, 0.42, 0);
        add(0x14b8a6, 0.82, 0.14, 0.82, 0, 0.54, 0);
        add(0xffffff, 0.88, 0.15, 0.16, 0, 0.535, 0);
        add(0xf43f5e, 0.56, 0.12, 0.56, 0, 0.68, 0);
        add(0xfff1c9, 0.22, 0.14, 0.22, 0, 0.8, 0);
        addFuse(0.34, 0.94);
        lieW = 0.4;
        break;
      case "kertas":
        // paper-wrapped cracker with rainbow stripes and a twisted top
        add(0xff3b6b, 0.36, 0.17, 0.36, 0, 0, 0);
        add(0xffd23f, 0.36, 0.17, 0.36, 0, 0.17, 0);
        add(0x3bd6ff, 0.36, 0.17, 0.36, 0, 0.34, 0);
        add(0x5dff7a, 0.36, 0.17, 0.36, 0, 0.51, 0);
        add(0xc77dff, 0.36, 0.17, 0.36, 0, 0.68, 0);
        add(0xfff7d6, 0.5, 0.07, 0.12, 0, 0.85, 0);
        addFuse(0.3, 0.92);
        lieW = 0.19;
        break;
      case "kodok":
        // a chunky voxel frog (faces +z): big eyes, light belly, back legs
        add(0x4ade80, 0.62, 0.34, 0.62, 0, 0.12, 0);
        add(0xd9f99d, 0.5, 0.16, 0.5, 0, 0.12, 0.08);
        add(0x22c55e, 0.5, 0.2, 0.5, 0, 0.46, -0.04);
        add(0xffffff, 0.2, 0.2, 0.2, -0.2, 0.6, 0.12);
        add(0xffffff, 0.2, 0.2, 0.2, 0.2, 0.6, 0.12);
        add(0x111111, 0.1, 0.1, 0.1, -0.2, 0.65, 0.24);
        add(0x111111, 0.1, 0.1, 0.1, 0.2, 0.65, 0.24);
        add(0x16a34a, 0.18, 0.28, 0.4, -0.38, 0, -0.1);
        add(0x16a34a, 0.18, 0.28, 0.4, 0.38, 0, -0.1);
        add(0x16a34a, 0.16, 0.1, 0.2, -0.26, 0, 0.36);
        add(0x16a34a, 0.16, 0.1, 0.2, 0.26, 0, 0.36);
        addFuse(0.3, 0.66);
        lieW = 0.3;
        break;
      case "petir":
        // a little tesla coil: dark base, hazard bands, cyan ring and a glowing orb
        add(0x1e293b, 0.6, 0.2, 0.6, 0, 0, 0);
        add(0x334155, 0.34, 0.5, 0.34, 0, 0.2, 0);
        add(0xfacc15, 0.44, 0.06, 0.44, 0, 0.3, 0);
        add(0xfacc15, 0.44, 0.06, 0.44, 0, 0.5, 0);
        add(0x38bdf8, 0.52, 0.1, 0.52, 0, 0.7, 0);
        add(0x7dd3fc, 0.34, 0.34, 0.34, 0, 0.8, 0);
        add(0xe0f2fe, 0.18, 0.18, 0.18, 0, 0.88, 0);
        addFuse(0.3, 1.14);
        lieW = 0.3;
        break;
      case "lubang":
        // black hole: dark core, violet disc, bright accretion ring and two tiny satellites
        add(0x0b0614, 0.62, 0.62, 0.62, 0, 0.12, 0);
        add(0x4c1d95, 0.7, 0.14, 0.7, 0, 0.36, 0);
        add(0xa855f7, 0.96, 0.07, 0.96, 0, 0.395, 0);
        add(0x67e8f9, 0.1, 0.1, 0.1, 0.55, 0.38, 0);
        add(0xf0abfc, 0.1, 0.1, 0.1, -0.55, 0.38, 0);
        addFuse(0.3, 0.74);
        lieW = 0.35;
        break;
      case "ufo":
        add(0x334155, 0.95, 0.18, 0.95, 0, 0.12, 0);
        add(0x22d3ee, 1.15, 0.1, 0.62, 0, 0.25, 0);
        add(0xa5f3fc, 0.56, 0.3, 0.56, 0, 0.35, 0);
        add(0xa3e635, 0.13, 0.13, 0.13, -0.38, 0.24, 0.23);
        add(0xe879f9, 0.13, 0.13, 0.13, 0, 0.24, 0.31);
        add(0xa3e635, 0.13, 0.13, 0.13, 0.38, 0.24, 0.23);
        addFuse(0.28, 0.66, 0);
        lieW = 0.42;
        break;
      case "naga":
        // only the head lives here; makeSnakeTail creates the flexible Slither-like body
        add(0xef4444, 0.58, 0.42, 0.58, 0, 0.12, 0);
        add(0xf97316, 0.34, 0.28, 0.34, -0.34, 0.17, 0);
        add(0xfacc15, 0.24, 0.17, 0.34, 0.38, 0.19, 0);
        add(0xffffff, 0.12, 0.12, 0.12, 0.18, 0.43, 0.23);
        add(0xffffff, 0.12, 0.12, 0.12, 0.18, 0.43, -0.23);
        add(0x111111, 0.055, 0.055, 0.055, 0.22, 0.46, 0.29);
        add(0x111111, 0.055, 0.055, 0.055, 0.22, 0.46, -0.29);
        add(0xf9a8d4, 0.28, 0.04, 0.06, 0.62, 0.2, 0);
        addFuse(0.28, 0.55, -0.18);
        lieW = 0.3;
        break;
      case "disco":
        add(0x64748b, 0.1, 0.45, 0.1, 0, 0, 0);
        add(0x334155, 0.5, 0.1, 0.5, 0, 0, 0);
        add(0xd946ef, 0.7, 0.7, 0.7, 0, 0.45, 0);
        add(0x38bdf8, 0.22, 0.22, 0.72, 0, 0.45, 0);
        add(0xfacc15, 0.72, 0.22, 0.22, 0, 0.45, 0);
        add(0x4ade80, 0.35, 0.35, 0.74, 0, 0.45, 0);
        addFuse(0.3, 0.82, 0);
        lieW = 0.36;
        break;
      case "drill":
        // motor on top, stepped conical auger pointing downward
        add(0x475569, 0.66, 0.35, 0.66, 0, 0.92, 0);
        add(0x22d3ee, 0.72, 0.08, 0.72, 0, 0.96, 0);
        add(0xf59e0b, 0.7, 0.18, 0.7, 0, 0.74, 0);
        add(0xfbbf24, 0.56, 0.2, 0.56, 0, 0.54, 0);
        add(0xf59e0b, 0.42, 0.22, 0.42, 0, 0.32, 0);
        add(0xd97706, 0.27, 0.24, 0.27, 0, 0.08, 0);
        add(0x64748b, 0.12, 0.22, 0.12, 0, -0.14, 0);
        addFuse(0.3, 1.28, 0.2);
        lieW = 0.35;
        break;
      case "gorilla":
        add(0x303640, 0.78, 0.65, 0.48, 0, 0.72, 0);
        add(0x59616e, 0.62, 0.52, 0.52, 0, 1.24, 0.03);
        add(0x8a929d, 0.42, 0.26, 0.5, 0, 1.14, 0.25);
        add(0x15191f, 0.07, 0.07, 0.05, -0.11, 1.4, 0.3);
        add(0x15191f, 0.07, 0.07, 0.05, 0.11, 1.4, 0.3);
        add(0x303640, 0.34, 0.92, 0.34, -0.55, 0.5, 0);
        add(0x303640, 0.34, 0.92, 0.34, 0.55, 0.5, 0);
        add(0x20252c, 0.32, 0.72, 0.38, -0.22, 0, 0);
        add(0x20252c, 0.32, 0.72, 0.38, 0.22, 0, 0);
        addFuse(0.3, 1.58, 0);
        lieW = 0.45;
        break;
      case "ants":
        add(0x171717, 0.32, 0.24, 0.32, -0.32, 0.15, 0);
        add(0xef4444, 0.38, 0.28, 0.38, 0, 0.15, 0);
        add(0x171717, 0.3, 0.25, 0.3, 0.34, 0.15, 0);
        add(0xfacc15, 0.07, 0.07, 0.07, 0.43, 0.25, 0.15);
        add(0x171717, 0.5, 0.05, 0.05, 0, 0.08, 0);
        add(0x171717, 0.05, 0.05, 0.5, 0, 0.08, 0);
        addFuse(0.25, 0.42, -0.4, 0.05);
        lieW = 0.2;
        break;
      case "fountain":
        add(0x2563eb, 0.42, 0.55, 0.42, 0, 0, 0);
        add(0xfacc15, 0.46, 0.08, 0.46, 0, 0.1, 0);
        add(0xfacc15, 0.46, 0.08, 0.46, 0, 0.38, 0);
        add(0xe11d48, 0.3, 0.14, 0.3, 0, 0.55, 0);
        add(0x1f2937, 0.18, 0.06, 0.18, 0, 0.69, 0);
        addFuse(0.3, 0.55, 0.15);
        lieW = 0.23;
        break;
    }
    const tip = new THREE.Mesh(this.boxGeo, this.tipMat);
    tip.scale.set(0.13, 0.13, 0.13);
    tip.position.set(fz.x, fz.base + fz.len, 0);
    group.add(tip);
    return { group, bodies, tip, fuseMesh: fz.mesh, fuseBase: fz.base, fuseLen: fz.len, fuseX: fz.x, lieW };
  }

  private spawnCracker(
    type: FireType,
    x: number,
    y: number,
    z: number,
    fuse: number,
    R: number,
    o: {
      drop: number;
      minor: boolean;
      scale: number;
      hiss: boolean;
      thrown: boolean;
      value: number;
      lvl: number;
    }
  ) {
    const m = this.buildModel(type.model);
    const { group, bodies } = m;
    group.rotation.order = "YXZ";
    group.scale.setScalar(0.01);
    this.scene.add(group);

    let sx = x;
    let sy = y + o.drop;
    let sz = z;
    let vx = 0;
    let vy = o.drop > 0 ? -2 : 0;
    let vz = 0;
    let flight = 0;
    let rx = 0;
    let rz = 0;
    let ax = 0;
    let az = 0;

    if (o.thrown) {
      // throw from the camera: spawn just in front of the lens (lower right), fly in an arc to the tapped spot
      const cam = this.camera;
      cam.updateMatrixWorld();
      _tf.set(0, 0, -1).applyQuaternion(cam.quaternion);
      _tu.set(0, 1, 0).applyQuaternion(cam.quaternion);
      _tr.set(1, 0, 0).applyQuaternion(cam.quaternion);
      const dist = 5.4 + Math.min(7, o.scale * 0.65); // big crackers start farther from the lens
      const halfH = dist * Math.tan((cam.fov * Math.PI) / 360);
      const side = 0.3 * halfH * cam.aspect + rr(-0.5, 0.5);
      const down = -0.78 * halfH;
      sx = cam.position.x + _tf.x * dist + _tu.x * down + _tr.x * side;
      sy = cam.position.y + _tf.y * dist + _tu.y * down + _tr.y * side;
      sz = cam.position.z + _tf.z * dist + _tu.z * down + _tr.z * side;
      const dx = x - sx;
      const dy = y + 0.1 - sy;
      const dz = z - sz;
      const D = Math.hypot(dx, dy, dz);
      // a calm, floaty lob: gentle gravity, longer flight and NO tumbling at all -
      // it stays upright the whole way and lands standing up
      flight = Math.min(1.35, Math.max(0.85, 0.7 + D * 0.011));
      vx = dx / flight;
      vz = dz / flight;
      vy = dy / flight + 0.5 * G_THROW * flight;
    }

    const lv = store.getState().levels;
    const actDur = (type.dur ?? 0) * (0.55 + 0.45 * fuseMult(lv.fuse));
    const beat =
      type.kind === "single" || type.kind === "string" || type.kind === "nuke"
        ? 0.12 + 0.12 * Math.min(1, type.power)
        : 0;
    const tail = type.kind === "dragon" ? this.makeSnakeTail(o.scale, o.lvl, sx, sy, sz) : [];
    const trail: THREE.Vector3[] = [];
    for (let i = 0; i < 180; i++) trail.push(new THREE.Vector3(sx, sy, sz));

    this.crackers.push({
      group,
      bodies,
      origMats: bodies.map((b) => b.material as THREE.Material),
      flashOn: false,
      tip: m.tip,
      fuseMesh: m.fuseMesh,
      fuseBase: m.fuseBase,
      fuseLen: m.fuseLen,
      fuseX: m.fuseX,
      lieW: m.lieW,
      lie: false, // thrown crackers always land standing up
      scale: o.scale,
      x: sx,
      y: sy,
      z: sz,
      vx,
      vy,
      vz,
      rx,
      rz,
      ax,
      az,
      heading: Math.random() * Math.PI * 2,
      spin: 0,
      yOff: 0,
      age: 0,
      fuse: fuse + flight,
      beat,
      type,
      R,
      value: o.value,
      lvl: o.lvl,
      landed: false,
      landT: 0,
      minor: o.minor,
      thrown: o.thrown,
      bounces: 0,
      active: false,
      actT: 0,
      actDur,
      acc: 0,
      sacc: 0,
      seed: Math.random(),
      y0: sy,
      pal: SOFT_PALETTES[1],
      g: o.thrown ? G_THROW : G_CRACKER,
      hop: 0,
      hopMax: 0,
      wait: 0,
      swell: -1,
      bolts: 0,
      boltT: 0,
      hover: 0,
      spinSpeed: 8,
      tail,
      trail,
      trailAcc: 0,
      targetX: sx,
      targetY: sy,
      targetZ: sz,
    });
    if (o.hiss) sfx.sizzle(Math.min(2.6, fuse));
  }

  /* =============================================================== crackers */

  private removeCracker(c: Cracker) {
    const k = this.crackers.indexOf(c);
    if (k >= 0) this.crackers.splice(k, 1);
    this.scene.remove(c.group);
    for (const seg of c.tail) this.scene.remove(seg);
  }

  /** Segmented voxel body used by Ular Mercon. Each segment is a separate 3D object. */
  private makeSnakeTail(
    scale: number,
    lvl: number,
    x: number,
    y: number,
    z: number
  ) {
    const result: THREE.Group[] = [];
    const count = 11 + Math.floor((lvl - 1) * 0.75);
    for (let i = 0; i < count; i++) {
      const seg = new THREE.Group();
      const body = new THREE.Mesh(this.boxGeo, this.mat(i % 3 === 1 ? 0xef4444 : 0xf97316));
      const taper = 1 - (i / count) * 0.55;
      body.scale.set(0.5 * taper, 0.34 * taper, 0.5 * taper);
      body.position.y = 0.2 * taper;
      body.castShadow = true;
      seg.add(body);
      if (i % 2 === 0 && i < count - 2) {
        const spine = new THREE.Mesh(this.boxGeo, this.mat(0xfacc15));
        spine.scale.set(0.13 * taper, 0.22 * taper, 0.13 * taper);
        spine.position.y = 0.47 * taper;
        spine.rotation.z = Math.PI / 4;
        seg.add(spine);
      }
      seg.scale.setScalar(scale);
      seg.position.set(x, y, z);
      seg.visible = false;
      this.scene.add(seg);
      result.push(seg);
    }
    return result;
  }

  private updateCrackers(dt: number) {
    let tens = 0;
    for (let i = this.crackers.length - 1; i >= 0; i--) {
      const c = this.crackers[i];
      if (!c) continue; // list may be cleared mid-loop by a stage clear
      c.age += dt;

      // ---- already ignited: rocket flying / gasing roaming / air mancur spraying
      if (c.active) {
        const kind = c.type.kind;
        if (kind === "rocket") {
          if (this.runRocket(c, dt)) {
            this.removeCracker(c);
            this.rocketBurst(c);
          }
        } else if (
          kind === "top"
            ? this.runTop(c, dt)
            : kind === "hopper"
              ? this.runHopper(c, dt)
              : kind === "storm"
                ? this.runStorm(c, dt)
                : kind === "hole"
                  ? this.runHole(c, dt)
                  : kind === "drill"
                    ? this.runDrill(c, dt)
                  : kind === "gorilla"
                    ? this.runGorilla(c, dt)
                    : kind === "ants"
                      ? this.runAnts(c, dt)
                  : kind === "orbit"
                    ? this.runOrbit(c, dt)
                    : kind === "dragon"
                      ? this.runDragon(c, dt)
                      : kind === "disco"
                        ? this.runDisco(c, dt)
                  : this.runFountain(c, dt)
        ) {
          this.removeCracker(c);
        }
        continue;
      }

      if (!this.physics(c, dt)) {
        this.removeCracker(c);
        continue;
      }

      // ---- the fuse burns down: p = 0..1, then a tense swell ("beat") before the bang
      const burnEnd = Math.max(0.05, c.fuse - c.beat);
      const p = Math.min(1, c.age / burnEnd);
      const inBeat = c.age >= burnEnd;
      const bt = inBeat ? Math.min(1, (c.age - burnEnd) / Math.max(0.01, c.beat)) : 0;

      if (c.fuseMesh) {
        const rem = 1 - p;
        c.fuseMesh.visible = rem > 0.015;
        c.fuseMesh.scale.y = Math.max(0.002, c.fuseLen * rem);
        c.fuseMesh.position.y = c.fuseBase + (c.fuseLen * rem) / 2;
        c.tip.position.set(c.fuseX, c.fuseBase + c.fuseLen * rem, 0);
      }
      c.tip.visible = !inBeat;

      // squash & stretch
      const pop = Math.min(1, c.age / (c.thrown ? 0.05 : 0.12));
      const popS = 1 - Math.pow(1 - pop, 3);
      let sy = c.scale * popS;
      let sxz = c.scale * popS;
      if (c.landed && c.landT < 0.16) {
        const k = 1 - c.landT / 0.16;
        sy *= 1 - 0.28 * k;
        sxz *= 1 + 0.2 * k;
      }
      const swell = inBeat ? 1 + 0.34 * (1 - (1 - bt) * (1 - bt)) : 1;
      const pulse = p > 0.55 ? Math.sin(c.age * 55) * 0.04 * p : 0;
      const gs = swell * (1 + pulse);
      c.group.scale.set(sxz * gs, sy * gs, sxz * gs);

      // nervous trembling that builds up
      const shake = p > 0.45 ? (inBeat ? 1.6 : 1) * p : 0;
      const wob = Math.sin(c.age * 62) * 0.06 * shake;
      c.group.rotation.set(c.rx + wob * 0.6, c.heading, c.rz + wob);
      const lift = c.thrown
        ? c.lieW * c.scale * (Math.abs(Math.sin(c.rz)) + Math.abs(Math.sin(c.rx)))
        : 0;
      c.group.position.set(c.x, c.y + lift, c.z);
      c.group.updateMatrixWorld(true);

      // white blink: slow at first, frantic in the beat
      let on = false;
      if (inBeat) on = Math.floor(c.age * 34) % 2 === 0;
      else if (p > 0.72) on = Math.floor(c.age * (8 + (22 * (p - 0.72)) / 0.28)) % 2 === 0;
      if (on !== c.flashOn) {
        c.flashOn = on;
        for (let k = 0; k < c.bodies.length; k++)
          c.bodies[k].material = on ? this.flashMat : c.origMats[k];
      }

      // sparks, flares & smoke from the burning tip - gets wilder as it nears the end
      if (!inBeat) {
        c.tip.getWorldPosition(_tp);
        const heat = 0.7 + p;
        const gz = Math.sqrt(c.scale); // bigger crackers throw bigger sparks
        const n = 3 + Math.floor(p * 4 + Math.random() * 2);
        for (let k = 0; k < n; k++) {
          this.spawnFx(
            _tp.x,
            _tp.y,
            _tp.z,
            rr(-3, 3) * heat * gz,
            rr(2.2, 7.5) * gz,
            rr(-3, 3) * heat * gz,
            rr(0.2, 0.5),
            rr(0.09, 0.16) * gz,
            0.03,
            11,
            3,
            SPARK0,
            SPARK1
          );
        }
        if (Math.random() < 0.15 + 0.3 * p) {
          this.spawnFx(_tp.x, _tp.y, _tp.z, 0, rr(0.5, 1.5), 0, 0.1, 0.28, 0.1, 0, 0, WHITE, SPARK0);
        }
        if (Math.random() < 0.3) {
          this.spawnFx(
            _tp.x,
            _tp.y + 0.05,
            _tp.z,
            rr(-0.3, 0.3),
            rr(0.8, 1.6),
            rr(-0.3, 0.3),
            rr(0.5, 0.9),
            0.08,
            0.2,
            -0.5,
            1.2,
            SMOKE1,
            SMOKE0
          );
        }
      }

      // heavy bombs: the camera creeps in and rumbles while the fuse runs out
      if (c.type.power >= 0.9 && p > 0.5) {
        tens = Math.max(tens, inBeat ? 0.6 + 0.4 * bt : (p - 0.5) * 1.2);
      }

      if (c.age >= c.fuse) {
        const kind = c.type.kind;
        if (
          kind === "rocket" ||
          kind === "top" ||
          kind === "fountain" ||
          kind === "hopper" ||
          kind === "storm" ||
          kind === "hole" ||
          kind === "drill" ||
          kind === "gorilla" ||
          kind === "ants" ||
          kind === "orbit" ||
          kind === "dragon" ||
          kind === "disco"
        ) {
          this.ignite(c);
          continue;
        }
        this.removeCracker(c);
        this.explode(c.x, c.y + 0.4 * c.scale, c.z, c.R, {
          value: c.value,
          power: c.type.power,
          minor: c.minor,
          snd: c.minor ? "crack" : "boom",
          nuke: kind === "nuke",
          paper: c.type.paper,
          shell: c.type.shell,
          lvl: c.lvl,
          confetti: c.type.confetti,
          style: c.type.id,
        });
      }
    }
    this.tensionTarget = tens;
  }

  /** gravity, bounces, wall hits and settling. Returns false when the cracker fell off the world. */
  private physics(c: Cracker, dt: number): boolean {
    const w = this.world;

    // horizontal drift (thrown crackers)
    if (c.vx !== 0 || c.vz !== 0) {
      const hy = Math.floor(c.y + 0.35 + OFF_Y);
      const nx = c.x + c.vx * dt;
      if (w.solidAt(Math.floor(nx + OFF_X), hy, Math.floor(c.z + OFF_Z))) {
        c.vx *= -0.45;
        c.ax *= -0.6;
      } else c.x = nx;
      const nz = c.z + c.vz * dt;
      if (w.solidAt(Math.floor(c.x + OFF_X), hy, Math.floor(nz + OFF_Z))) {
        c.vz *= -0.45;
        c.az *= -0.6;
      } else c.z = nz;
    }

    if (!c.landed) {
      c.vy -= c.g * dt;
      let ny = c.y + c.vy * dt;
      if (c.vy < 0) {
        const gx = Math.floor(c.x + OFF_X);
        const gz = Math.floor(c.z + OFF_Z);
        let gy = Math.floor(ny - 0.001 + OFF_Y);
        if (w.solidAt(gx, gy, gz)) {
          while (w.solidAt(gx, gy + 1, gz)) gy++;
          ny = gy + 1 - OFF_Y;
          const impact = -c.vy;
          if (c.thrown && impact > 6 && c.bounces < 2) {
            // one small, soft bounce - then it settles
            c.vy = impact * 0.26;
            c.vx *= 0.68;
            c.vz *= 0.68;
            c.ax *= 0.6;
            c.az *= 0.6;
            c.bounces++;
            sfx.thump(Math.min(1, impact / 24));
            this.dustPuff(c.x, ny, c.z, 0.55);
          } else {
            c.landed = true;
            c.landT = 0;
            c.vy = 0;
            if (c.thrown) sfx.thump(Math.min(1, impact / 24));
            this.dustPuff(c.x, ny, c.z, c.thrown ? 0.85 : 0.7);
          }
        }
      }
      c.y = ny;
      if (c.y < -25) return false;
    } else {
      c.landT += dt;
      if (c.vx !== 0 || c.vz !== 0) {
        // slide to a stop
        const k = Math.exp(-7 * dt);
        c.vx *= k;
        c.vz *= k;
        if (Math.abs(c.vx) < 0.05) c.vx = 0;
        if (Math.abs(c.vz) < 0.05) c.vz = 0;
      }
      const cx = Math.floor(c.x + OFF_X);
      const cz = Math.floor(c.z + OFF_Z);
      const cy = Math.floor(c.y - 0.05 + OFF_Y);
      if (!w.solidAt(cx, cy, cz)) {
        c.landed = false;
        c.vy = 0;
      }
    }

    // tumbling in the air, then settling onto its side (or upright)
    if (c.thrown) {
      if (!c.landed) {
        c.rx += c.ax * dt;
        c.rz += c.az * dt;
      } else {
        const damp = Math.exp(-6 * dt);
        c.ax *= damp;
        c.az *= damp;
        const kk = 1 - Math.exp(-13 * dt);
        const TAU = Math.PI * 2;
        const tz = c.lie
          ? Math.round((c.rz - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2
          : Math.round(c.rz / TAU) * TAU;
        const tx = Math.round(c.rx / TAU) * TAU;
        c.rx += (tx - c.rx) * kk;
        c.rz += (tz - c.rz) * kk;
      }
    }
    return true;
  }

  /** fuse is gone: rocket takes off, gasing starts spinning, air mancur starts spraying */
  private ignite(c: Cracker) {
    const kind = c.type.kind;
    c.active = true;
    c.actT = 0;
    c.flashOn = false;
    for (let k = 0; k < c.bodies.length; k++) c.bodies[k].material = c.origMats[k];
    c.tip.visible = false;
    if (c.fuseMesh) c.fuseMesh.visible = false;
    c.rx = 0;
    c.rz = 0;
    c.vx = 0;
    c.vz = 0;
    c.thrown = false;
    c.g = G_CRACKER;
    c.group.scale.setScalar(c.scale);
    c.group.rotation.set(0, c.heading, 0);
    c.group.position.set(c.x, c.y, c.z);
    this.dustPuff(c.x, c.y, c.z, 1.0);
    this.flashLight.position.set(c.x, c.y + 1.2, c.z);
    this.flashLight.color.setHex(0xffa24a);
    this.flashI = Math.max(this.flashI, 38);
    if (kind === "rocket") {
      c.vy = 4;
      c.y0 = c.y;
      c.age = c.fuse;
      sfx.whistle(0.85);
      this.trauma = Math.min(1, this.trauma + 0.08);
    } else if (kind === "top") {
      c.acc = 0.35;
      c.spinSpeed = 11 + c.lvl * 0.6;
      sfx.spin(c.actDur);
      this.trauma = Math.min(1, this.trauma + 0.06);
    } else if (kind === "hopper") {
      c.hopMax = 4 + Math.floor((c.lvl - 1) / 2); // more hops at higher levels
      c.hop = 0;
      c.wait = 0.28;
      c.swell = -1;
      c.tip.visible = true; // the lit fuse keeps burning on its head while it hops
      c.tip.position.set(c.fuseX, c.fuseBase + 0.05, 0);
      sfx.boing(1.1);
    } else if (kind === "storm") {
      c.bolts = c.type.count + Math.floor((c.lvl - 1) * 0.75); // more lightning at higher levels
      c.boltT = 0.95; // charge-up before the first strike
      c.swell = -1;
      sfx.charge(0.95);
      this.trauma = Math.min(1, this.trauma + 0.06);
    } else if (kind === "hole") {
      c.hover = 0;
      c.boltT = 0.45;
      c.acc = 0;
      c.sacc = 0;
      sfx.vortex(c.actDur);
      this.trauma = Math.min(1, this.trauma + 0.08);
    } else if (kind === "drill") {
      c.spinSpeed = 18 + c.lvl;
      c.acc = 0.05;
      c.y0 = c.y;
      sfx.spin(c.actDur);
    } else if (kind === "gorilla") {
      c.heading = Math.atan2(-c.z, -c.x) + rr(-0.7, 0.7);
      c.acc = 0.15;
      c.wait = 0;
      c.hover = 0;
      sfx.boing(0.55);
    } else if (kind === "ants") {
      this.makeAntSwarm(c);
      c.acc = 0.15;
      c.wait = 0;
      sfx.spin(c.actDur);
    } else if (kind === "orbit") {
      c.hover = 0;
      c.boltT = 0.55;
      c.acc = 0;
      c.spin = 0;
      sfx.charge(0.7);
    } else if (kind === "dragon") {
      c.acc = 0.25;
      c.heading = Math.atan2(-c.z, -c.x) + rr(-0.7, 0.7);
      c.spin = 0;
      c.trail.length = 0;
      for (let i = 0; i < 180; i++) {
        const d = i * 0.09 * c.scale;
        c.trail.push(
          new THREE.Vector3(
            c.x - Math.cos(c.heading) * d,
            c.y,
            c.z - Math.sin(c.heading) * d
          )
        );
      }
      c.tail.forEach((seg, i) => {
        seg.visible = true;
        seg.position.copy(c.trail[Math.min(c.trail.length - 1, (i + 1) * 2)]);
      });
      sfx.fountain(c.actDur);
    } else if (kind === "disco") {
      c.pal = SOFT_PALETTES[Math.floor(Math.random() * SOFT_PALETTES.length)];
      c.acc = 0.18;
      c.spin = 0;
      c.bolts = 0;
      sfx.buy();
    } else {
      c.pal = SOFT_PALETTES[Math.floor(Math.random() * SOFT_PALETTES.length)];
      sfx.fountain(c.actDur);
      this.trauma = Math.min(1, this.trauma + 0.1);
    }
  }

  private runRocket(c: Cracker, dt: number): boolean {
    c.vy = Math.min(32, c.vy + 70 * dt);
    c.y += c.vy * dt;
    c.x += Math.sin(c.age * 22) * 0.02;
    c.group.position.set(c.x, c.y, c.z);
    for (let k = 0; k < 3; k++) {
      this.spawnFx(
        c.x + rr(-0.08, 0.08),
        c.y + 0.6,
        c.z + rr(-0.08, 0.08),
        rr(-0.8, 0.8),
        rr(-4, -1),
        rr(-0.8, 0.8),
        rr(0.25, 0.5),
        0.28,
        0.05,
        0,
        1.5,
        k === 0 ? SMOKE0 : SPARK0,
        k === 0 ? SMOKE1 : SPARK1
      );
    }
    return c.y - c.y0 > 10.5 || c.age > c.fuse + 1.3;
  }

  /** a walkable cell in this column (1 step up / 3 steps down) or -1 */
  private floorAt(gx: number, gz: number, b: number): number {
    const w = this.world;
    for (let k = b + 1; k >= b - 3; k--) {
      if (!w.solidAt(gx, k, gz) && w.solidAt(gx, k - 1, gz) && !w.solidAt(gx, k + 1, gz)) return k;
    }
    return -1;
  }

  /** mercon gasing: spins up, zooms around spitting fire and leaving craters, then goes off */
  private runTop(c: Cracker, dt: number): boolean {
    if (!this.physics(c, dt)) return true;
    c.actT += dt;
    const t = c.actT;
    const left = c.actDur - t;
    const ramp = Math.min(1, Math.max(0, (t - 0.25) / 0.35));
    // Every completed revolution adds another burst of speed, until it reaches
    // a deliberately wild but capped maximum. Higher levels reach a higher cap.
    const before = Math.floor(c.spin / (Math.PI * 2));
    c.spin += c.spinSpeed * dt;
    const after = Math.floor(c.spin / (Math.PI * 2));
    if (after > before) {
      const topSpeed = 125 + c.lvl * 5.2;
      for (let rev = before; rev < after; rev++) {
        c.spinSpeed = Math.min(topSpeed, c.spinSpeed * 1.38 + 2 + c.lvl * 0.25);
      }
      this.flashI = Math.max(this.flashI, 3 + c.spinSpeed * 0.035);
    }

    if (left <= 0) {
      this.explode(c.x, c.y + 0.4 * c.scale, c.z, c.R, {
        value: c.value,
        power: c.type.power,
        snd: "boom",
        paper: c.type.paper,
        shell: c.type.shell,
        lvl: c.lvl,
        style: c.type.id,
      });
      return true;
    }

    // roam over the terrain, curving and bouncing off walls / edges
    if (ramp > 0 && c.landed) {
      c.heading += Math.sin(t * 2.7 + c.seed * 6.28) * 2.4 * ramp * dt;
      const speedRamp = Math.min(1.65, 0.65 + c.spinSpeed / 85);
      const sp = (5.4 + 0.45 * c.scale) * ramp * speedRamp;
      const nx = c.x + Math.cos(c.heading) * sp * dt;
      const nz = c.z + Math.sin(c.heading) * sp * dt;
      const k = this.floorAt(
        Math.floor(nx + OFF_X),
        Math.floor(nz + OFF_Z),
        Math.round(c.y + OFF_Y)
      );
      if (k >= 0) {
        const ny = k - OFF_Y;
        c.yOff -= ny - c.y;
        c.x = nx;
        c.z = nz;
        c.y = ny;
      } else {
        c.heading += Math.PI * rr(0.6, 1.4);
        this.dustPuff(c.x, c.y, c.z, 0.5);
      }
    }
    c.yOff += (0 - c.yOff) * (1 - Math.exp(-16 * dt));

    // sparks flung off the rim of the spinning top (a fan of glowing streaks)
    const rim = 0.42 * c.scale;
    const gs = Math.sqrt(c.scale);
    for (let k = 0; k < 5; k++) {
      const a = c.spin + k * 1.26 + rr(-0.4, 0.4);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const tg = rr(3, 7) * gs * Math.min(2.1, 0.6 + c.spinSpeed / 70);
      const out = rr(1.2, 3.5) * gs;
      const pal = SOFT_PALETTES[(k + Math.floor(c.spin / Math.PI)) % SOFT_PALETTES.length];
      this.spawnFx(
        c.x + ca * rim,
        c.y + c.yOff + 0.3 * c.scale,
        c.z + sa * rim,
        -sa * tg + ca * out,
        rr(1.5, 5) * gs,
        ca * tg + sa * out,
        rr(0.22, 0.5),
        rr(0.1, 0.18) * gs,
        0.04,
        14,
        2.2,
        k % 2 ? pal[0] : SPARK0,
        k % 2 ? pal[1] : SPARK1
      );
    }
    if (ramp > 0 && Math.random() < 0.75) {
      this.spawnFx(
        c.x + rr(-0.15, 0.15),
        c.y + 0.1,
        c.z + rr(-0.15, 0.15),
        rr(-0.6, 0.6),
        rr(0.4, 1.2),
        rr(-0.6, 0.6),
        rr(0.3, 0.55),
        0.2,
        0.36,
        0,
        3,
        DUST0,
        DUST1
      );
    }

    // little blasts behind it, chewing a trail through the island
    c.acc -= dt;
    if (ramp > 0.6 && c.acc <= 0) {
      c.acc = rr(0.3, 0.46);
      const back = 1.7 + 0.55 * c.scale;
      const bx = c.x - Math.cos(c.heading) * back;
      const bz = c.z - Math.sin(c.heading) * back;
      const ty = this.world.topY(Math.floor(bx + OFF_X), Math.floor(bz + OFF_Z));
      if (ty >= 0) {
        this.explode(bx, ty + 1 - OFF_Y + 0.25, bz, Math.max(1.0, c.R * 0.4), {
          value: c.value * 0.45,
          power: 0.25,
          minor: true,
          snd: "crack",
        });
      }
    }

    // swell + frantic blink right before the final bang
    const sw = left < 0.28 ? 1 + 0.3 * (1 - left / 0.28) : 1;
    c.group.scale.setScalar(c.scale * sw);
    const on = left < 0.28 && Math.floor(t * 34) % 2 === 0;
    if (on !== c.flashOn) {
      c.flashOn = on;
      for (let k = 0; k < c.bodies.length; k++)
        c.bodies[k].material = on ? this.flashMat : c.origMats[k];
    }
    c.group.position.set(c.x, c.y + c.yOff, c.z);
    c.group.rotation.set(0.17 * ramp, c.spin, 0);
    return false;
  }

  /** kodok loncat: hops around the island popping a small blast at every landing, then goes off */
  private runHopper(c: Cracker, dt: number): boolean {
    const was = c.landed;
    if (!this.physics(c, dt)) return true;
    c.actT += dt;

    // just touched down: a little crater, then squat for a moment
    if (c.landed && !was) {
      c.hop++;
      c.wait = 0.2;
      sfx.thump(0.55);
      this.explode(c.x, c.y + 0.3, c.z, Math.max(1.1, c.R * 0.45), {
        value: c.value * 0.55,
        power: 0.3,
        minor: true,
        snd: "crack",
        lvl: c.lvl,
      });
    }

    if (c.landed) {
      if (c.wait > 0) {
        c.wait -= dt;
      } else if (c.hop >= c.hopMax) {
        if (c.swell < 0) {
          c.swell = 0.5; // wind up for the big bang
          sfx.ribbit();
        }
      } else {
        // pick the next landing spot: stay on the island and drift toward the middle
        const dist = 3.2 + 0.7 * c.scale;
        let best = c.heading;
        let bestScore = -1e9;
        for (let k = 0; k < 9; k++) {
          const h = Math.random() * Math.PI * 2;
          const tx = c.x + Math.cos(h) * dist;
          const tz = c.z + Math.sin(h) * dist;
          const ty = this.world.topY(Math.floor(tx + OFF_X), Math.floor(tz + OFF_Z));
          if (ty < 0) continue;
          const score = -Math.hypot(tx, tz) * 0.35 + Math.random() * 5;
          if (score > bestScore) {
            bestScore = score;
            best = h;
          }
        }
        if (bestScore < -1e8) best = Math.atan2(-c.z, -c.x); // nowhere good: head for the centre
        c.heading = best;
        const air = 0.56;
        const sp = dist / air;
        c.vx = Math.cos(best) * sp;
        c.vz = Math.sin(best) * sp;
        c.vy = 0.5 * G_CRACKER * air;
        c.landed = false;
        c.landT = 0;
        sfx.boing(0.85 + Math.random() * 0.5);
      }
    }

    // the swell + frantic blink right before it goes off
    let swell = 1;
    if (c.swell >= 0) {
      c.swell -= dt;
      swell = 1 + 0.5 * (1 - Math.max(0, c.swell) / 0.5);
      if (c.swell <= 0) {
        this.explode(c.x, c.y + 0.4 * c.scale, c.z, c.R, {
          value: c.value,
          power: c.type.power,
          snd: "boom",
          paper: c.type.paper,
          shell: c.type.shell,
          lvl: c.lvl,
          style: c.type.id,
        });
        return true;
      }
    }

    // squash & stretch
    const air = !c.landed;
    const sy = air
      ? 1 + 0.22 * Math.min(1, Math.abs(c.vy) / 9)
      : 1 - 0.3 * Math.max(0, 1 - c.landT / 0.2);
    const sxz = air ? 1 / Math.sqrt(sy) : 1 + 0.18 * Math.max(0, 1 - c.landT / 0.2);
    c.group.scale.set(c.scale * sxz * swell, c.scale * sy * swell, c.scale * sxz * swell);
    c.group.position.set(c.x, c.y, c.z);
    c.group.rotation.set(0, Math.PI / 2 - c.heading, 0);
    const on = c.swell >= 0 && Math.floor(c.actT * 34) % 2 === 0;
    if (on !== c.flashOn) {
      c.flashOn = on;
      for (let k = 0; k < c.bodies.length; k++)
        c.bodies[k].material = on ? this.flashMat : c.origMats[k];
    }

    // sparks and smoke from the burning fuse on its head
    c.group.updateMatrixWorld(true);
    c.tip.getWorldPosition(_tp);
    const gz = Math.sqrt(c.scale);
    for (let k = 0; k < 3; k++) {
      this.spawnFx(
        _tp.x,
        _tp.y,
        _tp.z,
        rr(-2.5, 2.5),
        rr(2, 6),
        rr(-2.5, 2.5),
        rr(0.18, 0.42),
        rr(0.09, 0.15) * gz,
        0.03,
        11,
        3,
        SPARK0,
        SPARK1
      );
    }
    return false;
  }

  /** mercon petir: charges up, then calls lightning down from the sky; the last strike is the big one */
  private runStorm(c: Cracker, dt: number): boolean {
    if (!this.physics(c, dt)) return true;
    c.actT += dt;
    const t = c.actT;
    const lk = (c.lvl - 1) / 9;
    const gs = Math.sqrt(c.scale);
    const ox = c.x;
    const oy = c.y + 1.0 * c.scale;
    const oz = c.z;

    // electric sparks spiral up around the orb; little arcs crackle off it
    for (let k = 0; k < 3; k++) {
      const a = t * 13 + k * 2.1;
      const r = (0.35 + Math.random() * 0.25) * c.scale;
      this.spawnFx(
        ox + Math.cos(a) * r,
        oy + rr(-0.1, 0.5) * c.scale,
        oz + Math.sin(a) * r,
        -Math.sin(a) * 2.5,
        rr(1.2, 3.2),
        Math.cos(a) * 2.5,
        rr(0.2, 0.38),
        0.1 * gs,
        0.03,
        0,
        3,
        BOLT0,
        BOLT1
      );
    }
    if (Math.random() < 0.35) this.arc(ox, oy + 0.15 * c.scale, oz, 1.2 + c.scale * 0.9);

    if (c.bolts > 0) {
      // call down a strike every ~0.22s at a random spot around it
      c.boltT -= dt;
      if (c.boltT <= 0) {
        c.bolts--;
        c.boltT = 0.2 + Math.random() * 0.1 - lk * 0.05;
        let tx = c.x;
        let tz = c.z;
        let ty = c.y;
        for (let tries = 0; tries < 6; tries++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * (2.4 + c.R * 0.95 + 0.9 * c.scale) + 0.8;
          const px = c.x + Math.cos(a) * d;
          const pz = c.z + Math.sin(a) * d;
          const top = this.world.topY(Math.floor(px + OFF_X), Math.floor(pz + OFF_Z));
          if (top >= 0) {
            tx = px;
            tz = pz;
            ty = top + 1 - OFF_Y;
            break;
          }
        }
        this.lightning(tx, ty, tz, false);
        this.explode(tx, ty + 0.3, tz, Math.max(1.2, c.R * 0.62), {
          value: c.value * 0.7,
          power: 0.35,
          minor: true,
          snd: "crack",
          lvl: c.lvl,
          style: c.type.id,
        });
        this.flashLight.color.setHex(0xa8ccff);
        sfx.zap(0.3 + 0.4 * lk);
        this.hooks.onFlash?.(0.05 + 0.04 * lk);
        this.trauma = Math.min(1, this.trauma + 0.1);
      }
    } else {
      // a held breath, then the finale: one huge bolt straight onto the tower
      if (c.swell < 0) c.swell = 0.55;
      c.swell -= dt;
      if (c.swell <= 0) {
        this.lightning(c.x, c.y, c.z, true);
        this.explode(c.x, c.y + 0.4 * c.scale, c.z, c.R, {
          value: c.value * 1.3,
          power: c.type.power,
          snd: "boom",
          shell: c.type.shell,
          lvl: c.lvl,
        });
        this.flashLight.color.setHex(0xb8d4ff);
        sfx.zap(1);
        this.hooks.onFlash?.(0.18);
        return true;
      }
    }

    // the orb swells and flickers while it charges
    const pre =
      c.swell >= 0
        ? 1 + 0.32 * (1 - Math.max(0, c.swell) / 0.55)
        : 1 + 0.05 * Math.sin(t * 40);
    c.group.scale.setScalar(c.scale * pre);
    const on = c.swell >= 0 && Math.floor(t * 32) % 2 === 0;
    if (on !== c.flashOn) {
      c.flashOn = on;
      for (let k = 0; k < c.bodies.length; k++)
        c.bodies[k].material = on ? this.flashMat : c.origMats[k];
    }
    c.group.position.set(c.x, c.y, c.z);
    c.group.rotation.set(0, c.heading + t * 2.2, 0);
    this.flashLight.position.set(ox, oy + 0.5, oz);
    this.flashLight.color.setHex(0x8ec0ff);
    this.flashI = Math.max(this.flashI, 7 + Math.random() * 7);
    return false;
  }

  /** a short crackling arc of electricity */
  private arc(x: number, y: number, z: number, len: number) {
    const a = Math.random() * Math.PI * 2;
    const e = rr(-0.3, 0.9);
    const segs = 4;
    let px = x;
    let py = y;
    let pz = z;
    for (let i = 0; i < segs; i++) {
      const nx = px + (Math.cos(a) * len) / segs + rr(-0.25, 0.25);
      const ny = py + (Math.sin(e) * len) / segs + rr(-0.25, 0.25);
      const nz = pz + (Math.sin(a) * len) / segs + rr(-0.25, 0.25);
      this.bolt(px, py, pz, nx, ny, nz, 0.1);
      px = nx;
      py = ny;
      pz = nz;
    }
  }

  /** a glowing line of cubes between two points (the building block of lightning) */
  private bolt(ax: number, ay: number, az: number, bx: number, by: number, bz: number, thick: number) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    const steps = Math.max(1, Math.ceil(len / 0.4));
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      this.spawnFx(
        ax + dx * f,
        ay + dy * f,
        az + dz * f,
        0,
        0,
        0,
        rr(0.16, 0.3),
        thick,
        thick * 0.3,
        0,
        0,
        BOLT0,
        BOLT1
      );
    }
  }

  /** a jagged bolt from the sky to (tx, ty, tz) with forks, a flash and flying sparks */
  private lightning(tx: number, ty: number, tz: number, big: boolean) {
    const top = ty + 17 + Math.random() * 3;
    const sx = tx + rr(-2.4, 2.4);
    const sz = tz + rr(-2.4, 2.4);
    const segs = 9;
    const pts: number[][] = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const j = i === 0 || i === segs ? 0 : 1.25 * Math.sin(Math.PI * f) + 0.15;
      pts.push([
        sx + (tx - sx) * f + rr(-j, j),
        top + (ty - top) * f,
        sz + (tz - sz) * f + rr(-j, j),
      ]);
    }
    const th = big ? 0.34 : 0.22;
    for (let i = 0; i < segs; i++) {
      this.bolt(pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2], th);
    }
    // forks
    const forks = big ? 4 : 2;
    for (let f = 0; f < forks; f++) {
      const i = 2 + Math.floor(Math.random() * (segs - 4));
      let px = pts[i][0];
      let py = pts[i][1];
      let pz = pts[i][2];
      const a = Math.random() * Math.PI * 2;
      for (let k = 0; k < 3; k++) {
        const nx = px + Math.cos(a) * rr(0.8, 1.8) + rr(-0.5, 0.5);
        const ny = py - rr(0.9, 1.8);
        const nz = pz + Math.sin(a) * rr(0.8, 1.8) + rr(-0.5, 0.5);
        this.bolt(px, py, pz, nx, ny, nz, th * 0.55);
        px = nx;
        py = ny;
        pz = nz;
      }
    }
    // impact flash + sparks
    this.spawnFx(tx, ty + 0.3, tz, 0, 0, 0, 0.2, big ? 1.9 : 1.1, 0.2, 0, 0, BOLT0, BOLT0);
    const ns = big ? 40 : 18;
    for (let i = 0; i < ns; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rr(4, 11);
      this.spawnFx(
        tx,
        ty + 0.3,
        tz,
        Math.cos(a) * sp,
        rr(2, 9),
        Math.sin(a) * sp,
        rr(0.3, 0.7),
        0.13,
        0.04,
        14,
        1.2,
        SPARK0,
        SPARK1
      );
    }
    this.flashLight.position.set(tx, ty + 3, tz);
    this.flashLight.color.setHex(0xa8ccff);
    this.flashI = Math.max(this.flashI, big ? 90 : 45);
  }

  /** Gorilla Smash: four seconds of jumps and punches, then a climb/drop Hulk smash. */
  private runGorilla(c: Cracker, dt: number): boolean {
    if (!this.physics(c, dt)) return true;
    c.actT += dt;
    const p = Math.min(1, c.actT / 4);
    c.acc -= dt;

    if (p < 0.76) {
      // Pick solid props / walls nearby and leap toward them. Every landing is a punch.
      if (c.landed && c.wait > 0) {
        c.wait = 0;
        c.acc = 0.18; // brief recovery after the punch
        const fx = c.x + Math.cos(c.heading) * 0.9;
        const fz = c.z + Math.sin(c.heading) * 0.9;
        const top = this.world.topY(Math.floor(fx + OFF_X), Math.floor(fz + OFF_Z));
        const fy = top >= 0 ? top + 1 - OFF_Y : c.y;
        this.explode(fx, fy + 0.35, fz, Math.max(1.35, c.R * 0.42), {
          value: c.value * 0.48, power: 0.38, minor: true, snd: "crack", lvl: c.lvl,
        });
        sfx.thump(0.9);
        this.trauma = Math.max(this.trauma, 0.16);
      } else if (c.landed && c.acc <= 0) {
        c.acc = rr(0.38, 0.58);
        let bestX = c.x;
        let bestZ = c.z;
        let score = -1e9;
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = rr(2.5, 6.5);
          const x = c.x + Math.cos(a) * d;
          const z = c.z + Math.sin(a) * d;
          const top = this.world.topY(Math.floor(x + OFF_X), Math.floor(z + OFF_Z));
          if (top < 0) continue;
          const y = top + 1 - OFF_Y;
          const s = y * 2 + Math.random() * 5 - Math.hypot(x, z) * 0.08;
          if (s > score) { score = s; bestX = x; bestZ = z; }
        }
        const dx = bestX - c.x;
        const dz = bestZ - c.z;
        const d = Math.hypot(dx, dz) || 1;
        c.heading = Math.atan2(dz, dx);
        c.vx = (dx / d) * rr(6.5, 9.5);
        c.vz = (dz / d) * rr(6.5, 9.5);
        c.vy = rr(9, 13);
        c.landed = false;
        c.wait = 1; // marks a pending smash on landing
        sfx.boing(0.55);
      }
    } else {
      // Finale: find the tallest nearby structure, climb/attach to it, then jump and Hulk-smash.
      if (c.hover === 0) {
        let bx = c.x, bz = c.z, by = -1;
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = rr(1, 9);
          const x = c.x + Math.cos(a) * d;
          const z = c.z + Math.sin(a) * d;
          const top = this.world.topY(Math.floor(x + OFF_X), Math.floor(z + OFF_Z));
          if (top > by) { by = top; bx = x; bz = z; }
        }
        c.targetX = bx;
        c.targetZ = bz;
        c.targetY = by >= 0 ? by + 1 - OFF_Y : c.y + 5;
        c.hover = 0.001;
        c.vx = c.vy = c.vz = 0;
        c.landed = true;
      }
      c.hover = Math.min(1, c.hover + dt / 0.65);
      const climb = Math.min(1, c.hover / 0.62);
      const tx = c.targetX;
      const tz = c.targetZ;
      const ty = c.targetY;
      c.x += (tx - c.x) * (1 - Math.exp(-8 * dt));
      c.z += (tz - c.z) * (1 - Math.exp(-8 * dt));
      c.y += (ty + (climb < 1 ? 0 : Math.sin((c.hover - .62) / .38 * Math.PI) * 5) - c.y) * (1 - Math.exp(-10 * dt));
      if (p >= 1) {
        const floor = this.world.topY(Math.floor(c.x + OFF_X), Math.floor(c.z + OFF_Z));
        const iy = floor >= 0 ? floor + 1 - OFF_Y : c.y;
        this.explode(c.x, iy + 0.2, c.z, c.R, {
          value: c.value * 1.5, power: 1.2, snd: "boom", shell: c.type.shell, lvl: c.lvl, style: c.type.id,
        });
        this.hooks.onFlash?.(0.18);
        sfx.thump(1);
        return true;
      }
    }

    const air = !c.landed;
    const punch = c.wait > 0 ? Math.sin(c.actT * 18) * 0.65 : 0;
    c.group.position.set(c.x, c.y, c.z);
    c.group.rotation.set(air ? -0.18 : 0, Math.PI / 2 - c.heading, punch * 0.08);
    c.group.scale.set(c.scale * (1 + (air ? 0.04 : -0.03)), c.scale * (air ? 1.08 : 0.96), c.scale);
    return false;
  }

  private makeAntSwarm(c: Cracker) {
    c.group.visible = false;
    const count = c.type.count + Math.floor((c.lvl - 1) * 0.8);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rr(-0.2, 0.2);
      const ant = this.buildModel("ants").group;
      const sc = c.scale * rr(0.48, 0.68);
      ant.scale.setScalar(sc);
      ant.position.set(c.x + Math.cos(a) * 0.4, c.y, c.z + Math.sin(a) * 0.4);
      ant.rotation.y = -a;
      ant.userData.heading = a;
      ant.userData.life = c.actDur * rr(0.65, 1.0);
      ant.userData.dead = false;
      ant.userData.speed = rr(5.5, 9.5) + c.lvl * 0.2;
      ant.userData.sc = sc;
      this.scene.add(ant);
      c.tail.push(ant);
    }
  }

  /** Ant colony: independent fast agents spread over the map and pop in a wave. */
  private runAnts(c: Cracker, dt: number): boolean {
    c.actT += dt;
    let alive = 0;
    for (let i = 0; i < c.tail.length; i++) {
      const ant = c.tail[i];
      if (ant.userData.dead) continue;
      alive++;
      ant.userData.life -= dt;
      let h = ant.userData.heading as number;
      h += Math.sin(c.actT * 5 + i * 1.7) * dt * 1.3;
      const sp = ant.userData.speed as number;
      let nx = ant.position.x + Math.cos(h) * sp * dt;
      let nz = ant.position.z + Math.sin(h) * sp * dt;
      let floor = this.floorAt(Math.floor(nx + OFF_X), Math.floor(nz + OFF_Z), Math.round(ant.position.y + OFF_Y));
      if (floor < 0) {
        h += Math.PI * rr(0.55, 1.45);
        nx = ant.position.x;
        nz = ant.position.z;
        floor = this.world.topY(Math.floor(nx + OFF_X), Math.floor(nz + OFF_Z)) + 1;
      }
      ant.position.x = nx;
      ant.position.z = nz;
      if (floor >= 0) ant.position.y += (floor - OFF_Y - ant.position.y) * (1 - Math.exp(-20 * dt));
      ant.rotation.y = -h;
      ant.rotation.z = Math.sin(c.actT * 18 + i) * 0.08;
      ant.userData.heading = h;
      if (Math.random() < 0.18) {
        this.spawnFx(ant.position.x, ant.position.y + .2, ant.position.z, rr(-1,1), rr(.5,2), rr(-1,1), .25, .07, .02, 5, 2, SPARK0, SPARK1);
      }
      if (ant.userData.life <= 0) {
        ant.userData.dead = true;
        ant.visible = false;
        this.explode(ant.position.x, ant.position.y + .2, ant.position.z, Math.max(.9, c.R * .48), {
          value: c.value * .35, power: .25, minor: true, snd: "crack", lvl: c.lvl,
        });
      }
    }
    if (alive === 0 || c.actT >= c.actDur + .4) {
      this.explode(c.x, c.y + .2, c.z, Math.max(1.5, c.R * .75), {
        value: c.value, power: c.type.power, snd: "boom", lvl: c.lvl, style: c.type.id,
      });
      return true;
    }
    return false;
  }

  /** Mercon Bor: a downward-facing auger that cuts a clean shaft, then detonates underground. */
  private runDrill(c: Cracker, dt: number): boolean {
    c.actT += dt;
    const p = Math.min(1, c.actT / c.actDur);
    c.spinSpeed = Math.min(92 + c.lvl * 3, c.spinSpeed + dt * (18 + c.lvl * 2));
    c.spin += c.spinSpeed * dt;
    const depth = 4.2 + c.lvl * 0.16;
    const target = Math.max(-4.35, c.y0 - depth);
    c.y = c.y0 + (target - c.y0) * (1 - Math.pow(1 - p, 1.25));
    c.group.position.set(c.x, c.y, c.z);
    c.group.rotation.set(0, c.spin, 0);
    c.group.scale.setScalar(c.scale * (1 + Math.sin(c.spin) * 0.025));

    // corkscrew sparks and pulverised earth are thrown upward out of the shaft
    for (let k = 0; k < 4; k++) {
      const a = c.spin + k * Math.PI / 2;
      const r = 0.28 * c.scale;
      this.spawnFx(
        c.x + Math.cos(a) * r,
        c.y + 0.2,
        c.z + Math.sin(a) * r,
        Math.cos(a) * rr(2, 5),
        rr(5, 11),
        Math.sin(a) * rr(2, 5),
        rr(0.3, 0.65),
        rr(0.1, 0.17),
        0.035,
        13,
        1.8,
        k % 2 ? SPARK0 : GLINT,
        FIRE1
      );
    }
    c.acc -= dt;
    if (c.acc <= 0 && p < 0.95) {
      c.acc = Math.max(0.09, 0.16 - c.lvl * 0.005);
      this.drillCut(c);
    }
    this.trauma = Math.max(this.trauma, 0.05 + p * 0.06);
    this.flashLight.position.set(c.x, c.y + 0.5, c.z);
    this.flashLight.color.setHex(0xffb33b);
    this.flashI = Math.max(this.flashI, 5 + Math.random() * 4);

    if (p >= 1) {
      this.explode(c.x, c.y, c.z, c.R, {
        value: c.value * 1.35,
        power: c.type.power,
        snd: "boom",
        shell: c.type.shell,
        lvl: c.lvl,
        style: c.type.id,
      });
      return true;
    }
    return false;
  }

  private drillCut(c: Cracker) {
    const w = this.world;
    const cut = this.carved2;
    w.carve(c.x, c.y - 0.2, c.z, 0.85 + c.lvl * 0.025, this.seed++, cut);
    if (cut.n === 0) return;
    const st = store.getState();
    const coins = Math.floor(cut.coins * c.value * 0.45 * incomeMult(st.levels.income));
    if (coins > 0) store.addMoney(coins);
    const tmp = new THREE.Vector3();
    const keep = Math.min(1, 45 / cut.n);
    for (let i = 0; i < cut.n; i++) {
      if (Math.random() > keep) continue;
      const cell = cut.cells[i];
      w.cellWorld(cell, tmp);
      const a = Math.atan2(tmp.z - c.z, tmp.x - c.x) + c.spin;
      this.spawnDebris(
        tmp.x,
        tmp.y,
        tmp.z,
        Math.cos(a) * rr(2, 5),
        rr(6, 13),
        Math.sin(a) * rr(2, 5),
        rr(0.1, 0.25),
        w.col[cell],
        w.flag[cell] & F_BOUNCY ? 0.82 : 0
      );
    }
    c.sacc++;
    if (c.sacc % 2 === 0) sfx.crack(rr(0.65, 0.9));
    this.queueCollapse();
    this.checkStage();
  }

  /** UFO: levitates in a widening orbit, cuts circular laser craters, then slams down. */
  private runOrbit(c: Cracker, dt: number): boolean {
    if (!this.physics(c, dt)) return true;
    c.actT += dt;
    const p = Math.min(1, c.actT / c.actDur);
    c.hover = Math.min(1, c.hover + dt * 2.5);
    c.spin += dt * (5 + 8 * p);
    const lift = (2.2 + c.scale * 0.7) * (1 - Math.pow(1 - c.hover, 3));
    const orbit = (0.25 + p * 1.8) * Math.min(2, c.scale);
    const ux = c.x + Math.cos(c.spin * 0.45) * orbit;
    const uz = c.z + Math.sin(c.spin * 0.45) * orbit;
    const uy = c.y + lift + Math.sin(c.actT * 4) * 0.15;

    // soft holographic rings pulse out from the craft (below the bloom threshold)
    c.sacc += dt;
    if (c.sacc >= 0.18) {
      c.sacc = 0;
      const col = SOFT_PALETTES[(c.bolts + Math.floor(c.actT * 3)) % SOFT_PALETTES.length];
      const ring = 24;
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * Math.PI * 2 + c.spin;
        const sp = 2.5 + p * 4.5;
        this.spawnFx(
          ux + Math.cos(a) * 0.6 * c.scale,
          uy,
          uz + Math.sin(a) * 0.6 * c.scale,
          Math.cos(a) * sp,
          Math.sin(i * 1.7) * 0.25,
          Math.sin(a) * sp,
          0.55,
          0.12,
          0.025,
          0,
          2.5,
          col[0],
          col[1]
        );
      }
    }

    // neon running lights orbit around the saucer rim
    for (let k = 0; k < 3; k++) {
      const a = c.spin + (k * Math.PI * 2) / 3;
      const col = k === 0 ? BOLT0 : k === 1 ? VOID0 : SPARK0;
      this.spawnFx(
        ux + Math.cos(a) * 0.55 * c.scale,
        uy + 0.2 * c.scale,
        uz + Math.sin(a) * 0.55 * c.scale,
        -Math.sin(a) * 1.5,
        rr(-0.3, 0.8),
        Math.cos(a) * 1.5,
        0.22,
        0.12,
        0.03,
        0,
        2,
        col,
        col
      );
    }

    // laser shots carve an expanding ring around it
    c.boltT -= dt;
    if (c.boltT <= 0 && p < 0.86) {
      c.boltT = Math.max(0.2, 0.48 - c.lvl * 0.018);
      const a = c.spin + c.acc * 1.7;
      c.acc++;
      c.bolts++;
      const d = 2 + p * (3.5 + c.R * 0.55);
      const tx = c.x + Math.cos(a) * d;
      const tz = c.z + Math.sin(a) * d;
      const top = this.world.topY(Math.floor(tx + OFF_X), Math.floor(tz + OFF_Z));
      if (top >= 0) {
        const ty = top + 1 - OFF_Y;
        this.bolt(ux, uy, uz, tx, ty, tz, 0.16);
        // neon target reticle blooms over the impact point
        for (let ring = 0; ring < 3; ring++) {
          const count = 20 + ring * 6;
          for (let i = 0; i < count; i++) {
            const q = (i / count) * Math.PI * 2;
            const sp = 3.5 + ring * 2.2;
            const col = SOFT_PALETTES[(ring + c.bolts) % SOFT_PALETTES.length];
            this.spawnFx(tx, ty + 0.15, tz, Math.cos(q) * sp, 0.2 + ring * 0.15, Math.sin(q) * sp, 0.65, 0.13, 0.025, 2, 2, col[0], col[1], ring * 0.05);
          }
        }
        this.explode(tx, ty + 0.2, tz, Math.max(1.15, c.R * 0.45), {
          value: c.value * 0.55,
          power: 0.3,
          minor: true,
          snd: "crack",
          lvl: c.lvl,
        });
        sfx.zap(0.22);
      }
    }

    c.group.position.set(ux, uy, uz);
    c.group.rotation.set(0, c.spin, 0.08 * Math.sin(c.actT * 5));
    const sc = c.scale * (1 + 0.08 * Math.sin(c.actT * 9));
    c.group.scale.setScalar(sc);
    this.flashLight.position.set(ux, uy, uz);
    this.flashLight.color.setHex(0x62e8ff);
    this.flashI = Math.max(this.flashI, 5 + Math.random() * 5);

    if (p >= 1) {
      const top = this.world.topY(Math.floor(ux + OFF_X), Math.floor(uz + OFF_Z));
      const iy = top >= 0 ? top + 1 - OFF_Y : c.y;
      for (let i = 0; i < 3; i++) this.arc(ux, uy, uz, 2.5 + i);
      this.explode(ux, iy + 0.35, uz, c.R, {
        value: c.value * 1.35,
        power: c.type.power,
        snd: "boom",
        shell: c.type.shell,
        lvl: c.lvl,
        style: c.type.id,
      });
      return true;
    }
    return false;
  }

  /** Ular Mercon: a segmented Slither-like snake that follows a recorded 3D climbing path. */
  private runDragon(c: Cracker, dt: number): boolean {
    if (!this.physics(c, dt)) return true;
    c.actT += dt;
    const p = Math.min(1, c.actT / c.actDur);
    const speed = 4.1 + c.scale * 0.7 + p * 1.8;
    // broad, smooth S-curves like Slither.io; it gently biases toward the island centre
    c.heading += Math.sin(c.actT * 2.7 + c.seed * 6.28) * 1.35 * dt;
    if (Math.hypot(c.x, c.z) > 9) {
      const home = Math.atan2(-c.z, -c.x);
      c.heading += Math.atan2(Math.sin(home - c.heading), Math.cos(home - c.heading)) * dt * 0.9;
    }
    const nx = c.x + Math.cos(c.heading) * speed * dt;
    const nz = c.z + Math.sin(c.heading) * speed * dt;
    const floor = this.floorAt(
      Math.floor(nx + OFF_X),
      Math.floor(nz + OFF_Z),
      Math.round(c.y + OFF_Y)
    );
    if (floor >= 0) {
      c.x = nx;
      c.z = nz;
      c.y = floor - OFF_Y;
    } else {
      // a block / cliff ahead: slide around it instead of reversing abruptly
      const side = Math.random() < 0.5 ? 1 : -1;
      let found = false;
      for (const turn of [0.55, 0.9, 1.3, 1.8]) {
        const h = c.heading + side * turn;
        const tx = c.x + Math.cos(h) * 0.8;
        const tz = c.z + Math.sin(h) * 0.8;
        if (
          this.floorAt(
            Math.floor(tx + OFF_X),
            Math.floor(tz + OFF_Z),
            Math.round(c.y + OFF_Y)
          ) >= 0
        ) {
          c.heading = h;
          found = true;
          break;
        }
      }
      if (!found) c.heading = Math.atan2(-c.z, -c.x) + rr(-0.35, 0.35);
    }

    // Record the head path by distance, not by frame-rate. Because y is recorded too,
    // every body segment naturally climbs steps and wraps around voxel buildings.
    const headY = c.y + 0.08 + Math.sin(c.actT * 8) * 0.04;
    const h0 = c.trail[0];
    if (!h0 || Math.hypot(c.x - h0.x, headY - h0.y, c.z - h0.z) > 0.18 * c.scale) {
      c.trail.unshift(new THREE.Vector3(c.x, headY, c.z));
      if (c.trail.length > 240) c.trail.length = 240;
    }
    for (let i = 0; i < c.tail.length; i++) {
      const ti = Math.min(c.trail.length - 1, (i + 1) * 2);
      const pt = c.trail[ti];
      const prev = c.trail[Math.max(0, ti - 1)];
      const seg = c.tail[i];
      const follow = 1 - Math.exp(-18 * dt);
      seg.position.lerp(pt, follow);
      const h = Math.atan2(prev.z - pt.z, prev.x - pt.x);
      seg.rotation.set(0, -h, Math.sin(c.actT * 7 - i * 0.7) * 0.05);
      const pulse = 1 + 0.035 * Math.sin(c.actT * 9 - i * 0.8);
      seg.scale.setScalar(c.scale * pulse);
    }

    // the head spits a modest stream of sparks while the body remains visibly a snake
    const fx = c.x + Math.cos(c.heading) * 0.85 * c.scale;
    const fz = c.z + Math.sin(c.heading) * 0.85 * c.scale;
    const fy = c.y + 0.55 * c.scale;
    for (let i = 0; i < 3; i++) {
      const a = c.heading + rr(-0.22, 0.22);
      const sp = rr(7, 13) * Math.sqrt(c.scale);
      this.spawnFx(
        fx,
        fy,
        fz,
        Math.cos(a) * sp,
        rr(0.5, 4),
        Math.sin(a) * sp,
        rr(0.3, 0.7),
        rr(0.12, 0.2),
        0.04,
        5,
        2.4,
        FIRE0,
        FIRE1
      );
    }
    c.acc -= dt;
    if (c.acc <= 0) {
      c.acc = Math.max(0.18, 0.36 - c.lvl * 0.012);
      const bx = c.x - Math.cos(c.heading) * (1.2 + c.scale * 0.5);
      const bz = c.z - Math.sin(c.heading) * (1.2 + c.scale * 0.5);
      const top = this.world.topY(Math.floor(bx + OFF_X), Math.floor(bz + OFF_Z));
      if (top >= 0) {
        this.explode(bx, top + 1.2 - OFF_Y, bz, Math.max(1.1, c.R * 0.42), {
          value: c.value * 0.5,
          power: 0.28,
          minor: true,
          snd: "crack",
          lvl: c.lvl,
        });
      }
    }
    c.group.position.set(c.x, headY, c.z);
    c.group.rotation.set(0, Math.PI / 2 - c.heading, Math.sin(c.actT * 8) * 0.08);
    c.group.scale.setScalar(c.scale * (1 + 0.06 * Math.sin(c.actT * 12)));

    if (p >= 1) {
      // Fuse runs from the very tip of the tail toward the head: one satisfying
      // detonation per segment, ending with the largest blast at the head.
      const chain = [...c.tail].reverse().map((seg) => seg.position.clone());
      chain.push(new THREE.Vector3(c.x, c.y + 0.35 * c.scale, c.z));
      chain.forEach((pt, i) => {
        const last = i === chain.length - 1;
        this.schedule(i * 0.085, () => {
          if (this.phase !== "play") return;
          this.explode(pt.x, pt.y, pt.z, last ? c.R : Math.max(1.0, c.R * 0.34), {
            value: c.value * (last ? 1.15 : 0.18),
            power: last ? c.type.power : 0.22,
            minor: !last,
            snd: last ? "boom" : "crack",
            shell: last ? c.type.shell : undefined,
            paper: last ? c.type.paper : undefined,
            lvl: c.lvl,
          });
        });
      });
      return true;
    }
    return false;
  }

  /** Disco bomb: rhythmic colour pulses and radial spark choreography, then a rainbow finale. */
  private runDisco(c: Cracker, dt: number): boolean {
    if (!this.physics(c, dt)) return true;
    c.actT += dt;
    const p = Math.min(1, c.actT / c.actDur);
    c.spin += dt * (4 + p * 9);
    c.acc -= dt;
    if (c.acc <= 0 && p < 0.92) {
      c.acc = Math.max(0.22, 0.48 - c.lvl * 0.018);
      c.bolts++;
      const pal = SOFT_PALETTES[c.bolts % SOFT_PALETTES.length];
      // horizontal 360-degree pulse
      const rays = 28 + c.lvl * 3;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + c.spin;
        const up = (i % 3) * 0.22 - 0.1;
        const sp = 5 + c.bolts * 0.8 + c.lvl * 0.2;
        this.spawnFx(
          c.x,
          c.y + 0.65 * c.scale,
          c.z,
          Math.cos(a) * sp,
          up * sp,
          Math.sin(a) * sp,
          rr(0.65, 1.1),
          0.17,
          0.04,
          3,
          1.3,
          pal[0],
          pal[1]
        );
      }
      this.fireworkBurst(c.x, c.y + 2.1 + c.bolts * 0.2, c.z, 30, 4.5, 0);
      this.blastGlow(c.x, c.y + 0.7, c.z, 1.2 + c.bolts * 0.12, true);
      sfx.buy();
    }
    c.group.position.set(c.x, c.y + 0.15 + Math.abs(Math.sin(c.actT * 5)) * 0.35, c.z);
    c.group.rotation.set(c.actT * 1.2, c.spin, c.actT * 0.7);
    const beat = 1 + 0.09 * Math.max(0, Math.sin(c.actT * 12));
    c.group.scale.setScalar(c.scale * beat);
    this.flashLight.position.set(c.x, c.y + 1.2 * c.scale, c.z);
    this.flashLight.color.setHSL((c.actT * 0.4) % 1, 0.9, 0.65);
    this.flashI = Math.max(this.flashI, 4 + Math.random() * 4);

    if (p >= 1) {
      this.explode(c.x, c.y + 0.5 * c.scale, c.z, c.R, {
        value: c.value * 1.25,
        power: c.type.power,
        snd: "boom",
        shell: c.type.shell,
        paper: c.type.paper,
        lvl: c.lvl,
        confetti: c.type.confetti,
        style: c.type.id,
      });
      return true;
    }
    return false;
  }

  /** lubang hitam: levitates, sucks loose debris into orbit, digs a pit, then blows everything back out */
  private runHole(c: Cracker, dt: number): boolean {
    c.actT += dt;
    const prog = c.actT / c.actDur;
    c.hover = Math.min(1, c.hover + dt * 2.2);
    const lift = (1.3 + 0.5 * c.scale) * (1 - Math.pow(1 - c.hover, 3));
    const hx = c.x;
    const hy = c.y + lift + 0.35 * c.scale;
    const hz = c.z;
    const R = c.R;

    // the gravity well (debris physics reads this)
    this.attr.on = true;
    this.attr.x = hx;
    this.attr.y = hy;
    this.attr.z = hz;
    this.attr.k = 52 + c.lvl * 6;
    this.attr.r = 6.5 + R * 1.65 + 2 * c.scale;
    c.acc -= dt;
    if (c.acc <= 0) {
      c.acc = 0.12;
      this.wakeDebris(hx, hy, hz, this.attr.r); // loose rubble lifts off and starts to orbit
    }

    // accretion: violet motes spiral in from all around
    c.sacc += dt * (240 + 28 * c.lvl) * Math.min(1, c.actT / 0.4 + 0.2);
    const n = Math.floor(c.sacc);
    c.sacc -= n;
    for (let k = 0; k < n; k++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(rr(-1, 1));
      const dx = Math.sin(ph) * Math.cos(th);
      const dy = Math.cos(ph);
      const dz = Math.sin(ph) * Math.sin(th);
      const rs = this.attr.r * rr(0.45, 1.0);
      const life = rr(0.4, 0.75);
      const v = rs / life;
      this.spawnFx(
        hx + dx * rs,
        hy + dy * rs * 0.7,
        hz + dz * rs,
        -dx * v - dz * v * 0.45,
        -dy * v * 0.7,
        -dz * v + dx * v * 0.45,
        life,
        0.17,
        0.04,
        0,
        0,
        VOID0,
        VOID1
      );
    }

    // it eats the ground beneath it, bit by bit
    c.boltT -= dt;
    if (c.boltT <= 0) {
      c.boltT = 0.3;
      this.digTick(c, prog);
    }

    // model: spins faster, grows as it feeds, then collapses just before the blast
    c.spin += dt * (6 + 10 * prog);
    const shrink = prog > 0.9 ? 1 - ((prog - 0.9) / 0.1) * 0.6 : 1;
    c.group.scale.setScalar(c.scale * (1 + 0.45 * prog) * shrink);
    c.group.position.set(c.x, c.y + lift, c.z);
    c.group.rotation.set(0, c.spin, 0);
    this.flashLight.position.set(hx, hy, hz);
    this.flashLight.color.setHex(0xb78cff);
    this.flashI = Math.max(this.flashI, 8 + prog * 14);
    this.trauma = Math.max(this.trauma, 0.06 + 0.14 * prog);

    if (prog >= 1) {
      this.attr.on = false;
      // everything that was sucked in is flung back out
      this.disturbDebris(hx, hy, hz, R, true, true);
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rr(6, 15 + R * 0.6);
        this.spawnFx(
          hx,
          hy,
          hz,
          Math.cos(a) * sp,
          rr(-1, 5),
          Math.sin(a) * sp,
          rr(0.5, 1.0),
          0.2,
          0.05,
          6,
          1.6,
          VOID0,
          VOID1
        );
      }
      this.explode(c.x, c.y + 0.4, c.z, R, {
        value: c.value * 1.4,
        power: c.type.power,
        snd: "boom",
        shell: c.type.shell,
        lvl: c.lvl,
        style: c.type.id,
      });
      return true;
    }
    return false;
  }

  /** the black hole carves a small pit under itself; the rubble is pulled up into orbit */
  private digTick(c: Cracker, prog: number) {
    const w = this.world;
    const ty = w.topY(Math.floor(c.x + OFF_X), Math.floor(c.z + OFF_Z));
    if (ty < 0) return;
    const r = Math.max(1.0, c.R * (0.28 + 0.34 * prog));
    const gy = ty + 0.5 - OFF_Y;
    const carved = this.carved;
    w.carve(c.x, gy, c.z, r, this.seed++, carved);
    const n = carved.n;
    if (n === 0) return;
    const st = store.getState();
    const coins = Math.floor(
      carved.coins * c.value * 0.5 * incomeMult(st.levels.income) * st.comboMult
    );
    this.registerHit();
    if (coins > 0) {
      store.addMoney(coins);
      sfx.coin(Math.min(15, st.combo));
    }
    // Keep many recognisable full-colour voxel chunks: these are the blocks the
    // player can watch being torn out of the building and pulled into orbit.
    const keep = Math.min(1, (180 + c.lvl * 14) / n);
    const tmp = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      if (Math.random() > keep) continue;
      const cell = carved.cells[k];
      w.cellWorld(cell, tmp);
      this.spawnDebris(
        tmp.x,
        tmp.y,
        tmp.z,
        rr(-1.2, 1.2),
        rr(2, 6),
        rr(-1.2, 1.2),
        rr(0.22, 0.52),
        w.col[cell]
      );
    }
    this.dustPuff(c.x, gy + 0.5, c.z, 0.8);
    sfx.thump(0.4);
    this.queueCollapse();
    this.checkStage();
  }

  /** settled rubble near a point lifts off again (used by the black hole) */
  private wakeDebris(cx: number, cy: number, cz: number, r: number) {
    const r2 = r * r;
    const P = this.dPos;
    const V = this.dVel;
    for (let i = 0; i < this.dHW; i++) {
      if (this.dState[i] < 2) continue;
      const i3 = i * 3;
      const dx = P[i3] - cx;
      const dy = P[i3 + 1] - cy;
      const dz = P[i3 + 2] - cz;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      this.dState[i] = 1;
      V[i3] = rr(-1, 1);
      V[i3 + 1] = rr(1.5, 4);
      V[i3 + 2] = rr(-1, 1);
      const av = rr(4, 9);
      this.dAv[i3] = rr(-1, 1) * av;
      this.dAv[i3 + 1] = rr(-1, 1) * av;
      this.dAv[i3 + 2] = rr(-1, 1) * av;
    }
  }

  /** flat paper scraps that tumble, flutter and drift slowly down */
  private confetti(cx: number, cy: number, cz: number, n: number, R: number, pal: Rgb[]) {
    const count = Math.min(n, 480);
    const burst = Math.floor(count * 0.65);
    for (let i = 0; i < count; i++) {
      const col = pal[i % pal.length];
      const sz = rr(0.16, 0.3);
      const a = Math.random() * Math.PI * 2;
      if (i < burst) {
        const sp = rr(1.5, 5.5 + R * 1.15);
        this.spawnFx(
          cx,
          cy,
          cz,
          Math.cos(a) * sp,
          rr(6, 13 + R * 0.6),
          Math.sin(a) * sp,
          rr(2.6, 4.4),
          sz,
          sz,
          3.6,
          1.5,
          col,
          col,
          0,
          true
        );
      } else {
        // a second wave rains down from above
        const d = Math.sqrt(Math.random()) * (R * 1.1 + 2);
        this.spawnFx(
          cx + Math.cos(a) * d,
          cy + rr(3, 8 + R * 0.4),
          cz + Math.sin(a) * d,
          rr(-1, 1),
          rr(-0.5, 0.5),
          rr(-1, 1),
          rr(2.6, 4.2),
          sz,
          sz,
          2.4,
          1.2,
          col,
          col,
          rr(0.08, 0.9),
          true
        );
      }
    }
  }

  /** a small coloured firework bursting above a big blast (more of them at higher levels) */
  private fireworkBurst(cx: number, cy: number, cz: number, n: number, speed: number, delay: number) {
    const a = SOFT_PALETTES[Math.floor(Math.random() * SOFT_PALETTES.length)];
    const b = SOFT_PALETTES[Math.floor(Math.random() * SOFT_PALETTES.length)];
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(rr(-1, 1));
      const sp = speed * rr(0.7, 1.0);
      const p = i % 3 === 0 ? b : a;
      this.spawnFx(
        cx,
        cy,
        cz,
        Math.sin(ph) * Math.cos(th) * sp,
        Math.cos(ph) * sp,
        Math.sin(ph) * Math.sin(th) * sp,
        rr(1.0, 1.7),
        0.26,
        0.07,
        6,
        1.7,
        p[0],
        p[1],
        delay
      );
    }
    this.spawnFx(cx, cy, cz, 0, 0, 0, 0.16, 2.0, 0.4, 0, 0, GLINT, GLINT, delay);
  }

  /** air mancur: a roaring fountain of sparks that rains little exploding comets */
  private runFountain(c: Cracker, dt: number): boolean {
    if (!this.physics(c, dt)) return true;
    c.actT += dt;
    const prog = c.actT / c.actDur;
    const pw = Math.min(1, c.actT / 0.3) * (prog > 0.8 ? 1 - ((prog - 0.8) / 0.2) * 0.7 : 1);
    const nx = c.x;
    const ny = c.y + 0.72 * c.scale;
    const nz = c.z;
    const pal = c.pal;

    if (prog >= 1) {
      // grand finale
      for (let i = 0; i < 100; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = rr(5, 14);
        const col = Math.random() < 0.5 ? pal : BURST_PALETTES[Math.floor(Math.random() * BURST_PALETTES.length)];
        this.spawnFx(
          nx,
          ny,
          nz,
          Math.cos(a) * sp,
          rr(4, 15),
          Math.sin(a) * sp,
          rr(0.9, 1.5),
          0.26,
          0.08,
          10,
          1.2,
          col[0],
          col[1]
        );
      }
      this.explode(c.x, c.y + 0.4 * c.scale, c.z, c.R * 2.2, {
        value: c.value * 1.3,
        power: 0.7,
        snd: "boom",
        shell: c.type.shell,
        lvl: c.lvl,
      });
      return true;
    }

    // the spray itself (time-based so it looks the same at any frame rate)
    c.sacc += dt * 300 * pw; // fewer sparks + softer colours = a glow, not a glare
    const n = Math.floor(c.sacc);
    c.sacc -= n;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const tilt = rr(0.02, 0.4);
      const sp = rr(10, 18) * (0.75 + 0.25 * pw);
      const st = Math.sin(tilt);
      const col = Math.random() < 0.65 ? pal : SOFT_PALETTES[1];
      this.spawnFx(
        nx,
        ny,
        nz,
        st * Math.cos(a) * sp,
        Math.cos(tilt) * sp,
        st * Math.sin(a) * sp,
        rr(0.6, 1.2),
        rr(0.14, 0.22),
        0.04,
        15,
        0.6,
        col[0],
        col[1]
      );
    }
    if (Math.random() < 0.16 * pw) {
      this.spawnFx(
        nx + rr(-0.1, 0.1),
        ny + rr(0, 0.5),
        nz + rr(-0.1, 0.1),
        0,
        rr(2, 5),
        0,
        0.12,
        0.3,
        0.1,
        0,
        0,
        GLINT,
        GLINT
      );
    }
    this.flashLight.position.set(nx, ny + 2, nz);
    this.flashLight.color.setRGB(pal[0][0] * 0.5 + 0.5, pal[0][1] * 0.5 + 0.5, pal[0][2] * 0.5 + 0.5);
    this.flashI = Math.max(this.flashI, 5 + Math.random() * 6);
    this.trauma = Math.max(this.trauma, 0.05 + 0.05 * pw);

    // comets that fall around it and pop little craters
    c.acc += dt * c.type.count * (0.55 + 0.45 * pw);
    while (c.acc >= 1) {
      c.acc -= 1;
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * (2.8 + c.R * 1.7) + 0.8;
      const vy0 = rr(8.5, 13);
      const tf = (2 * vy0) / 18;
      this.comets.push({
        x: nx,
        y: ny,
        z: nz,
        vx: (Math.cos(a) * d) / tf,
        vy: vy0,
        vz: (Math.sin(a) * d) / tf,
        c0: pal[0],
        c1: pal[1],
        R: Math.max(1.1, c.R * 0.8),
        value: c.value * 0.55,
        snd: "crack",
        power: 0.2,
      });
    }
    return false;
  }

  private dustPuff(x: number, y: number, z: number, k: number) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rr(1.5, 3.5) * k;
      this.spawnFx(
        x,
        y + 0.1,
        z,
        Math.cos(a) * sp,
        rr(0.5, 1.6),
        Math.sin(a) * sp,
        rr(0.25, 0.45),
        0.22 * k,
        0.4 * k,
        0,
        4,
        DUST0,
        DUST1
      );
    }
  }

  /* =============================================================== royal guard ragdolls */

  private resetGuards() {
    for (const g of this.guards) this.scene.remove(g.group);
    this.guards.length = 0;
    for (const s of this.world.guardSpawns)
      this.guards.push(this.makeGuard(s.x, s.y, s.z, s.facing, s.role));
  }

  private makeGuard(
    x: number,
    y: number,
    z: number,
    facing: number,
    role: "knight" | "orc"
  ): GuardDummy {
    const root = new THREE.Group();
    const rig = new THREE.Group();
    rig.position.y = -1; // root is the centre of mass; old model coordinates were foot-relative
    root.add(rig);
    const cube = (parent: THREE.Object3D, color: number, sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
      const m = new THREE.Mesh(this.boxGeo, this.mat(color));
      m.scale.set(sx, sy, sz);
      m.position.set(px, py, pz);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const head = new THREE.Group();
    head.position.set(0, 1.55, 0);
    rig.add(head);
    const limb = (px: number, py: number, color: number, sx: number, sy: number) => {
      const p = new THREE.Group();
      p.position.set(px, py, 0);
      rig.add(p);
      cube(p, color, sx, sy, 0.25, 0, -sy / 2, 0);
      return p;
    };
    let leftArm: THREE.Group;
    let rightArm: THREE.Group;
    let leftLeg: THREE.Group;
    let rightLeg: THREE.Group;

    if (role === "knight") {
      // layered steel plate over a royal blue tunic
      cube(rig, 0x3357a6, 0.6, 0.72, 0.36, 0, 1.1, 0);
      cube(rig, 0xb8c4d6, 0.66, 0.5, 0.4, 0, 1.28, 0);
      cube(rig, 0xe5edf7, 0.13, 0.52, 0.43, 0, 1.28, 0.02);
      cube(rig, 0x566277, 0.7, 0.1, 0.42, 0, 0.91, 0);
      cube(rig, 0xffcf3f, 0.16, 0.14, 0.44, 0, 0.91, 0.02);
      // helmet, visor slits and blue plume
      cube(head, 0xd5deea, 0.42, 0.4, 0.38, 0, 0.14, 0);
      cube(head, 0x7c899c, 0.46, 0.13, 0.42, 0, 0.13, 0.04);
      cube(head, 0x161b28, 0.08, 0.035, 0.04, -0.1, 0.15, 0.25);
      cube(head, 0x161b28, 0.08, 0.035, 0.04, 0.1, 0.15, 0.25);
      cube(head, 0xffcf3f, 0.46, 0.055, 0.42, 0, 0.33, 0);
      cube(head, 0x3357a6, 0.12, 0.38, 0.18, 0, 0.61, -0.04);
      leftArm = limb(-0.43, 1.4, 0xb8c4d6, 0.22, 0.7);
      rightArm = limb(0.43, 1.4, 0xb8c4d6, 0.22, 0.7);
      // shield with golden cross
      cube(leftArm, 0x3357a6, 0.46, 0.58, 0.12, -0.12, -0.42, 0.22);
      cube(leftArm, 0xffcf3f, 0.1, 0.48, 0.14, -0.12, -0.42, 0.29);
      cube(leftArm, 0xffcf3f, 0.36, 0.1, 0.14, -0.12, -0.42, 0.29);
      // sword, crossguard and pommel
      cube(rightArm, 0xe8eef7, 0.09, 1.15, 0.08, 0.11, -0.58, 0.1);
      cube(rightArm, 0xffcf3f, 0.34, 0.08, 0.11, 0.11, -0.06, 0.1);
      cube(rightArm, 0x6b4426, 0.11, 0.32, 0.11, 0.11, 0.19, 0.1);
      leftLeg = limb(-0.18, 0.78, 0x69768a, 0.24, 0.78);
      rightLeg = limb(0.18, 0.78, 0x69768a, 0.24, 0.78);
      cube(leftLeg, 0x343c4d, 0.28, 0.18, 0.44, 0, -0.8, 0.09);
      cube(rightLeg, 0x343c4d, 0.28, 0.18, 0.44, 0, -0.8, 0.09);
    } else {
      // broad orc: green skin, dark battered armour and asymmetric pauldrons
      cube(rig, 0x384438, 0.74, 0.7, 0.44, 0, 1.08, 0);
      cube(rig, 0x263029, 0.8, 0.18, 0.48, 0, 1.34, 0);
      cube(rig, 0x6f4c2d, 0.82, 0.11, 0.47, 0, 0.9, 0);
      cube(rig, 0x9aa0a7, 0.18, 0.18, 0.5, 0, 0.9, 0.02);
      cube(head, 0x5f9e42, 0.46, 0.4, 0.42, 0, 0.12, 0);
      // heavy brow, nose, ears and two ivory tusks
      cube(head, 0x355f2d, 0.48, 0.09, 0.45, 0, 0.23, 0.03);
      cube(head, 0x78b957, 0.16, 0.14, 0.17, 0, 0.09, 0.25);
      cube(head, 0x5f9e42, 0.22, 0.1, 0.12, -0.31, 0.14, 0);
      cube(head, 0x5f9e42, 0.22, 0.1, 0.12, 0.31, 0.14, 0);
      cube(head, 0xfff0c2, 0.08, 0.2, 0.08, -0.13, -0.02, 0.24);
      cube(head, 0xfff0c2, 0.08, 0.2, 0.08, 0.13, -0.02, 0.24);
      cube(head, 0xffc247, 0.065, 0.055, 0.04, -0.11, 0.2, 0.24);
      cube(head, 0xffc247, 0.065, 0.055, 0.04, 0.11, 0.2, 0.24);
      leftArm = limb(-0.48, 1.4, 0x5f9e42, 0.28, 0.76);
      rightArm = limb(0.48, 1.4, 0x5f9e42, 0.28, 0.76);
      cube(leftArm, 0x343a3a, 0.4, 0.24, 0.4, 0, -0.1, 0);
      cube(rightArm, 0x343a3a, 0.4, 0.24, 0.4, 0, -0.1, 0);
      cube(leftArm, 0xb8bec8, 0.08, 0.12, 0.1, -0.18, -0.1, 0);
      cube(rightArm, 0xb8bec8, 0.08, 0.12, 0.1, 0.18, -0.1, 0);
      // two-handed-looking axe attached to the right ragdoll limb
      cube(rightArm, 0x704b2c, 0.1, 1.55, 0.1, 0.16, -0.55, 0.08);
      cube(rightArm, 0xaeb6c2, 0.55, 0.28, 0.1, -0.02, 0.18, 0.08);
      cube(rightArm, 0x707985, 0.24, 0.46, 0.12, 0.18, 0.18, 0.08);
      leftLeg = limb(-0.2, 0.76, 0x29352c, 0.29, 0.76);
      rightLeg = limb(0.2, 0.76, 0x29352c, 0.29, 0.76);
      cube(leftLeg, 0x33271e, 0.34, 0.2, 0.47, 0, -0.78, 0.1);
      cube(rightLeg, 0x33271e, 0.34, 0.2, 0.47, 0, -0.78, 0.1);
    }

    root.position.set(x, y + 1, z);
    root.rotation.y = facing;
    root.scale.setScalar(role === "orc" ? 1.17 : 1.08);
    this.scene.add(root);
    return {
      group: root,
      rig,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      x, y: y + 1, z,
      vx: 0, vy: 0, vz: 0,
      rx: 0, ry: facing, rz: 0,
      ax: 0, ay: 0, az: 0,
      state: "stand",
      t: 0,
      bounces: 0,
      seed: Math.random() * 10,
      joints: new Float32Array(10),
      jointV: new Float32Array(10),
      impact: 0,
      mass: role === "orc" ? 1.35 : 1,
    };
  }

  /** Guards never break: a blast only converts them into high-bounce floppy dummies. */
  private blastGuards(cx: number, cy: number, cz: number, R: number, power: number) {
    const reach = R * 1.65 + 3;
    for (const g of this.guards) {
      let dx = g.x - cx;
      let dy = g.y - cy;
      let dz = g.z - cz;
      const d = Math.hypot(dx, dy, dz);
      if (d >= reach) continue;
      const inv = 1 / Math.max(0.35, d);
      dx *= inv;
      dy *= inv;
      dz *= inv;
      const f = ((1 - d / reach) * (13 + R * 2.2 + power * 8)) / g.mass;
      g.vx = dx * f + rr(-2.5, 2.5);
      g.vy = Math.max(7, Math.abs(dy) * f + f * 0.72);
      g.vz = dz * f + rr(-2.5, 2.5);
      g.ax = rr(-10, 10);
      g.ay = rr(-9, 9);
      g.az = rr(-10, 10);
      g.state = "fly";
      g.bounces = 0;
      g.t = 0;
      g.impact = f;
      for (let j = 0; j < g.jointV.length; j++) {
        g.jointV[j] = rr(-7, 7) + (j % 2 ? 1 : -1) * f * 0.08;
      }
    }
  }

  /** Vertical half-size changes as the dummy rotates from standing to lying flat. */
  private guardExtent(g: GuardDummy) {
    const upright = Math.abs(Math.cos(g.rx) * Math.cos(g.rz));
    return 0.42 + upright * 0.62;
  }

  /** Capsule-like wall test at hips, chest and shoulders, including four radial offsets. */
  private guardBlocked(x: number, y: number, z: number, extent: number) {
    const rad = 0.34 + (1 - Math.min(1, (extent - 0.42) / 0.62)) * 0.18;
    const hs = [-extent * 0.52, 0, extent * 0.52];
    const ring = [[0, 0], [rad, 0], [-rad, 0], [0, rad], [0, -rad]];
    for (const h of hs)
      for (const [dx, dz] of ring)
        if (
          this.world.solidAt(
            Math.floor(x + dx + OFF_X),
            Math.floor(y + h + OFF_Y),
            Math.floor(z + dz + OFF_Z)
          )
        ) return true;
    return false;
  }

  /** Highest supporting surface under the dummy, but never a roof above its body. */
  private guardFloor(x: number, y: number, z: number, extent: number) {
    let floor = -1e9;
    const r = extent > 0.78 ? 0.27 : 0.42;
    for (const [dx, dz] of [[0, 0], [r, r], [-r, r], [r, -r], [-r, -r]]) {
      const top = this.world.topY(Math.floor(x + dx + OFF_X), Math.floor(z + dz + OFF_Z));
      if (top < 0) continue;
      const surface = top + 1 - OFF_Y;
      if (surface <= y + 0.18 && surface > floor) floor = surface;
    }
    return floor;
  }

  private guardJointImpulse(g: GuardDummy, impact: number) {
    const k = Math.min(8, 1.2 + impact * 0.22);
    for (let j = 0; j < g.jointV.length; j++) g.jointV[j] += rr(-k, k);
    g.impact = Math.max(g.impact, impact);
  }

  private updateGuardJoints(g: GuardDummy, dt: number) {
    // GTA-like loose constraints: each joint carries inertia, but soft springs and
    // angular limits stop limbs from rotating through the torso indefinitely.
    const down = g.state === "down";
    const targets = down
      ? [-1.15, -0.55, 1.05, 0.55, 0.45, -0.5, -0.42, 0.48, 0.08, -0.12]
      : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const spring = g.state === "fly" ? 1.6 : down ? 7 : 12;
    const damp = Math.exp(-(g.state === "fly" ? 1.7 : 5.5) * dt);
    for (let j = 0; j < 10; j++) {
      const gravity = g.state === "fly" && (j === 0 || j === 2) ? 1.5 : 0;
      g.jointV[j] += ((targets[j] - g.joints[j]) * spring + gravity) * dt;
      g.jointV[j] *= damp;
      g.joints[j] += g.jointV[j] * dt;
      const limit = j >= 8 ? 0.65 : j === 1 || j === 3 ? 1.15 : 2.15;
      if (g.joints[j] > limit) {
        g.joints[j] = limit;
        g.jointV[j] *= -0.22;
      } else if (g.joints[j] < -limit) {
        g.joints[j] = -limit;
        g.jointV[j] *= -0.22;
      }
    }
    g.leftArm.rotation.set(g.joints[0], 0, g.joints[1]);
    g.rightArm.rotation.set(g.joints[2], 0, g.joints[3]);
    g.leftLeg.rotation.set(g.joints[4], 0, g.joints[5]);
    g.rightLeg.rotation.set(g.joints[6], 0, g.joints[7]);
    g.head.rotation.set(g.joints[8], Math.sin(g.t * 4 + g.seed) * 0.08, g.joints[9]);
    g.impact *= Math.exp(-4 * dt);
  }

  private updateGuards(dt: number) {
    for (const g of this.guards) {
      g.t += dt;
      let extent = this.guardExtent(g);
      const floor0 = this.guardFloor(g.x, g.y, g.z, extent);

      if (g.state === "stand") {
        const targetY = floor0 + 1.02;
        if (floor0 < -100 || g.y - extent > floor0 + 0.3) {
          g.state = "fly";
          g.vy = Math.min(0, g.vy);
          g.ax = rr(-2, 2);
          g.az = rr(-2, 2);
        } else {
          g.y += (targetY - g.y) * (1 - Math.exp(-15 * dt));
          g.group.position.set(g.x, g.y + Math.sin(g.t * 2 + g.seed) * 0.012, g.z);
          g.group.rotation.set(0, g.ry, 0);
          this.updateGuardJoints(g, dt);
          continue;
        }
      }

      if (g.state === "fly") {
        const speed = Math.hypot(g.vx, g.vy, g.vz);
        const steps = Math.max(1, Math.ceil((speed * dt) / 0.22));
        const h = dt / steps;
        for (let s = 0; s < steps; s++) {
          g.vy -= 23 * h;
          extent = this.guardExtent(g);

          // X and Z are resolved separately, so the dummy slides along walls instead of tunnelling.
          const nx = g.x + g.vx * h;
          if (this.guardBlocked(nx, g.y, g.z, extent)) {
            const hit = Math.abs(g.vx);
            g.vx *= -0.32;
            g.vz *= 0.82;
            g.ay += rr(-2, 2) + g.vx * 0.08;
            g.az += rr(-3, 3);
            this.guardJointImpulse(g, hit);
          } else g.x = nx;

          const nz = g.z + g.vz * h;
          if (this.guardBlocked(g.x, g.y, nz, extent)) {
            const hit = Math.abs(g.vz);
            g.vz *= -0.32;
            g.vx *= 0.82;
            g.ax += rr(-3, 3);
            g.ay += rr(-2, 2) + g.vz * 0.08;
            this.guardJointImpulse(g, hit);
          } else g.z = nz;

          const ny = g.y + g.vy * h;
          if (g.vy > 0 && this.guardBlocked(g.x, ny + extent * 0.3, g.z, extent)) {
            const hit = g.vy;
            g.vy *= -0.3;
            g.ax += rr(-3, 3);
            g.az += rr(-3, 3);
            this.guardJointImpulse(g, hit);
          } else g.y = ny;

          const floor = this.guardFloor(g.x, g.y, g.z, extent);
          if (g.vy < 0 && floor > -100 && g.y - extent <= floor) {
            g.y = floor + extent + 0.015;
            const impact = -g.vy;
            this.guardJointImpulse(g, impact);
            if (impact > 2.2 && g.bounces < 5) {
              g.vy = impact * (0.28 + Math.min(0.16, impact * 0.006));
              g.vx *= 0.72;
              g.vz *= 0.72;
              g.ax += rr(-4, 4);
              g.ay += rr(-3, 3);
              g.az += rr(-4, 4);
              g.bounces++;
              if (s === steps - 1) {
                sfx.thump(Math.min(1, impact / 18));
                this.dustPuff(g.x, floor, g.z, 0.4);
              }
            } else {
              g.state = "down";
              g.vx = g.vy = g.vz = 0;
              // choose the closest side, rather than snapping every dummy to one identical pose
              const side = Math.sin(g.rx + g.rz) >= 0 ? 1 : -1;
              g.rx = side * Math.PI / 2;
              g.rz *= 0.2;
              g.ax = g.ay = g.az = 0;
              break;
            }
          }

          g.rx += g.ax * h;
          g.ry += g.ay * h;
          g.rz += g.az * h;
          const ad = Math.exp(-0.55 * h);
          g.ax *= ad;
          g.ay *= ad;
          g.az *= ad;
        }
        if (g.y < -30) {
          g.x = 0;
          g.z = 0;
          g.y = 8;
          g.vx = g.vz = 0;
          g.vy = 0;
        }
      } else {
        extent = this.guardExtent(g);
        const floor = this.guardFloor(g.x, g.y, g.z, extent);
        if (floor < -100 || g.y - extent > floor + 0.15) {
          g.state = "fly";
          g.vy = 0;
        } else {
          g.y += (floor + extent + 0.015 - g.y) * (1 - Math.exp(-14 * dt));
          g.vx = g.vz = 0;
        }
      }

      this.updateGuardJoints(g, dt);
      g.group.position.set(g.x, g.y, g.z);
      g.group.rotation.set(g.rx, g.ry, g.rz);
    }
  }

  /* =============================================================== rocket */

  private rocketBurst(c: Cracker) {
    const st = store.getState();
    const pal = BURST_PALETTES[Math.floor(Math.random() * BURST_PALETTES.length)];
    const pal2 = BURST_PALETTES[Math.floor(Math.random() * BURST_PALETTES.length)];
    const x = c.x;
    const y = c.y + 0.8;
    const z = c.z;
    // shell
    const nShell = 150 + c.lvl * 24; // a fuller firework at higher levels
    for (let i = 0; i < nShell; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(rr(-1, 1));
      const sp = rr(7, 13.5);
      const useA = i % 3 !== 0;
      this.spawnFx(
        x,
        y,
        z,
        Math.sin(ph) * Math.cos(th) * sp,
        Math.cos(ph) * sp,
        Math.sin(ph) * Math.sin(th) * sp,
        rr(1.1, 2.0),
        0.34,
        0.1,
        7,
        1.7,
        useA ? pal[0] : pal2[0],
        useA ? pal[1] : pal2[1]
      );
    }
    for (let i = 0; i < 50; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(rr(-1, 1));
      const sp = rr(2, 5);
      this.spawnFx(
        x,
        y,
        z,
        Math.sin(ph) * Math.cos(th) * sp,
        Math.cos(ph) * sp,
        Math.sin(ph) * Math.sin(th) * sp,
        rr(0.6, 1.1),
        0.3,
        0.08,
        3,
        1.4,
        WHITE,
        pal[0]
      );
    }
    this.spawnFx(x, y, z, 0, 0, 0, 0.18, 3.2, 4.4, 0, 0, WHITE, WHITE);
    this.flashI = Math.max(this.flashI, 150);
    this.flashLight.position.set(x, y, z);
    this.flashLight.color.setRGB(pal[0][0] * 0.6 + 0.4, pal[0][1] * 0.6 + 0.4, pal[0][2] * 0.6 + 0.4);
    this.trauma = Math.min(1, this.trauma + 0.22);
    this.punch = Math.max(this.punch, 0.35);
    sfx.boom(5 + c.lvl * 0.3, 0.5, c.lvl);
    sfx.crack(0.7);
    this.hooks.onFlash?.(0.12);
    this.vibrate(30);

    const inc = incomeMult(st.levels.income);
    const bonus = Math.round(12 * c.value * inc * st.comboMult);
    store.addMoney(bonus);
    this.floatWorld(x, y - 2, z, `+${fmt(bonus)}`, "bonus", 1.1);

    // meteor shower: more (and bigger) meteors as the rocket levels up
    const n = c.type.count + Math.floor((c.lvl - 1) * 1.2);
    const R = Math.min(MAX_BLAST_RADIUS, c.R);
    const baseX = c.x;
    const baseZ = c.z;
    const spread = 4.5 + Math.sqrt(R / c.type.radius) * 3;
    for (let i = 0; i < n; i++) {
      this.schedule(0.35 + i * 0.1 + Math.random() * 0.05, () => {
        if (this.phase !== "play") return;
        const a = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * spread;
        const tx = baseX + Math.cos(a) * rad;
        const tz = baseZ + Math.sin(a) * rad;
        const sx = x + rr(-1.5, 1.5);
        const sz = z + rr(-1.5, 1.5);
        const tf = rr(0.7, 1.0);
        const g = 18;
        const vy = (0 - y + 0.5 * g * tf * tf) / tf;
        const col = Math.random() < 0.5 ? pal : pal2;
        this.comets.push({
          x: sx,
          y,
          z: sz,
          vx: (tx - sx) / tf,
          vy,
          vz: (tz - sz) / tf,
          c0: col[0],
          c1: col[1],
          R,
          value: c.value,
          snd: "boom",
          power: 0.25,
        });
      });
    }
  }

  private updateComets(dt: number) {
    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i];
      if (!c) continue; // list may be cleared mid-loop by a stage clear
      const speed = Math.hypot(c.vx, c.vy, c.vz);
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.5));
      const h = dt / steps;
      let hitIt = false;
      for (let s = 0; s < steps; s++) {
        c.vy -= 18 * h;
        c.x += c.vx * h;
        c.y += c.vy * h;
        c.z += c.vz * h;
        if (
          this.world.solidAt(
            Math.floor(c.x + OFF_X),
            Math.floor(c.y + OFF_Y),
            Math.floor(c.z + OFF_Z)
          )
        ) {
          hitIt = true;
          break;
        }
      }
      for (let k = 0; k < 2; k++) {
        this.spawnFx(
          c.x,
          c.y,
          c.z,
          rr(-0.6, 0.6),
          rr(-0.6, 1.2),
          rr(-0.6, 0.6),
          rr(0.25, 0.55),
          0.3,
          0.04,
          2,
          1.2,
          k === 0 ? WHITE : c.c0,
          c.c1
        );
      }
      if (hitIt) {
        this.comets.splice(i, 1);
        this.explode(c.x, c.y + 0.2, c.z, c.R, {
          value: c.value,
          power: c.power,
          minor: true,
          snd: c.snd,
        });
      } else if (c.y < -22) {
        this.comets.splice(i, 1);
      }
    }
  }

  /* =============================================================== particles */

  private spawnFx(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    s0: number,
    s1: number,
    grav: number,
    drag: number,
    c0: Rgb,
    c1: Rgb,
    delay = 0,
    flat = false
  ) {
    const i = this.fxHead;
    this.fxHead = (this.fxHead + 1) % FX_N;
    const p = this.fxPos;
    p[i * 3] = x;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = z;
    const v = this.fxVel;
    v[i * 3] = vx;
    v[i * 3 + 1] = vy;
    v[i * 3 + 2] = vz;
    this.fxAge[i] = 0;
    this.fxLife[i] = life;
    this.fxS0[i] = s0;
    this.fxS1[i] = s1;
    this.fxG[i] = grav;
    this.fxDrag[i] = drag;
    this.fxDelay[i] = delay;
    // spark-like colours get stretched into streaks and flicker; embers just flicker
    const sparky = SPARKY.indexOf(c0) >= 0;
    this.fxStreak[i] = sparky ? 1.5 : 0;
    this.fxFlick[i] = sparky || c0 === EMBER0 ? 1 : 0;
    this.fxFlat[i] = flat ? 1 : 0;
    // every very bright particle adds to the "glare" load, which dims the bloom while the screen is full of fire
    if (c0[0] > 1.25 || c0[1] > 1.25 || c0[2] > 1.25) this.glare += 1;
    this.fxC0[i * 3] = c0[0];
    this.fxC0[i * 3 + 1] = c0[1];
    this.fxC0[i * 3 + 2] = c0[2];
    this.fxC1[i * 3] = c1[0];
    this.fxC1[i * 3 + 1] = c1[1];
    this.fxC1[i * 3 + 2] = c1[2];
    this.fxAlive[i] = 1;
    zeroMat(this.fx.instanceMatrix.array as Float32Array, i);
  }

  private updateFx(dt: number) {
    const m = this.fx.instanceMatrix.array as Float32Array;
    const ca = this.fx.instanceColor!.array as Float32Array;
    let any = false;
    const pos = this.fxPos;
    const vel = this.fxVel;
    for (let i = 0; i < FX_N; i++) {
      if (!this.fxAlive[i]) continue;
      any = true;
      if (this.fxDelay[i] > 0) {
        this.fxDelay[i] -= dt;
        continue;
      }
      const age = (this.fxAge[i] += dt);
      const life = this.fxLife[i];
      if (age >= life) {
        this.fxAlive[i] = 0;
        zeroMat(m, i);
        continue;
      }
      const t = age / life;
      const k = Math.exp(-this.fxDrag[i] * dt);
      const i3 = i * 3;
      vel[i3] *= k;
      vel[i3 + 1] = vel[i3 + 1] * k - this.fxG[i] * dt;
      vel[i3 + 2] *= k;
      if (this.fxFlat[i]) {
        // paper sways side to side as it falls
        vel[i3] += Math.sin(age * 5 + i * 1.3) * 5.5 * dt;
        vel[i3 + 2] += Math.cos(age * 4.3 + i * 0.9) * 5.5 * dt;
      }
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      const e = 1 - (1 - t) * (1 - t);
      let s = this.fxS0[i] + (this.fxS1[i] - this.fxS0[i]) * e;
      const fs = this.fxFlat[i] ? 0.86 : 0.55; // paper keeps its size until the very end
      if (t > fs) {
        const u = (t - fs) / (1 - fs);
        s *= 1 - u * u;
      }
      if (this.fxFlick[i]) s *= 0.7 + 0.3 * Math.sin(age * 48 + i * 1.7);
      const o = i * 16;
      const sk = this.fxStreak[i];
      const vx = vel[i3];
      const vy = vel[i3 + 1];
      const vz = vel[i3 + 2];
      const spd = sk > 0 ? Math.sqrt(vx * vx + vy * vy + vz * vz) : 0;
      if (this.fxFlat[i]) {
        // paper: a thin flake that spins and tilts back and forth as it flutters down
        const ph = i * 1.713;
        const a = age * (3 + (i % 5) * 1.1) + ph;
        const b = Math.sin(age * (5 + (i % 3)) + ph * 1.7);
        const ca2 = Math.cos(a);
        const sa2 = Math.sin(a);
        const cb = Math.cos(b);
        const sb = Math.sin(b);
        const lx = s * 1.7;
        const ly = s * 0.14;
        const lz = s * 1.1;
        m[o] = ca2 * lx;
        m[o + 1] = 0;
        m[o + 2] = -sa2 * lx;
        m[o + 3] = 0;
        m[o + 4] = sa2 * sb * ly;
        m[o + 5] = cb * ly;
        m[o + 6] = ca2 * sb * ly;
        m[o + 7] = 0;
        m[o + 8] = sa2 * cb * lz;
        m[o + 9] = -sb * lz;
        m[o + 10] = ca2 * cb * lz;
        m[o + 11] = 0;
      } else if (spd > 1.2) {
        // stretch the cube along its velocity => a glowing streak
        const inv = 1 / spd;
        const dx = vx * inv;
        const dy = vy * inv;
        const dz = vz * inv;
        let bx = -dz;
        let bz = dx;
        const bl = Math.sqrt(bx * bx + bz * bz);
        if (bl < 1e-3) {
          bx = 1;
          bz = 0;
        } else {
          bx /= bl;
          bz /= bl;
        }
        const cx = dy * bz;
        const cy = dz * bx - dx * bz;
        const cz = -dy * bx;
        const len = s * (1 + sk * Math.min(5, spd * 0.13));
        const th = s * 0.8;
        m[o] = dx * len;
        m[o + 1] = dy * len;
        m[o + 2] = dz * len;
        m[o + 3] = 0;
        m[o + 4] = bx * th;
        m[o + 5] = 0;
        m[o + 6] = bz * th;
        m[o + 7] = 0;
        m[o + 8] = cx * th;
        m[o + 9] = cy * th;
        m[o + 10] = cz * th;
        m[o + 11] = 0;
      } else {
        m[o] = s;
        m[o + 1] = 0;
        m[o + 2] = 0;
        m[o + 3] = 0;
        m[o + 4] = 0;
        m[o + 5] = s;
        m[o + 6] = 0;
        m[o + 7] = 0;
        m[o + 8] = 0;
        m[o + 9] = 0;
        m[o + 10] = s;
        m[o + 11] = 0;
      }
      m[o + 12] = pos[i3];
      m[o + 13] = pos[i3 + 1];
      m[o + 14] = pos[i3 + 2];
      m[o + 15] = 1;
      const q = Math.pow(t, 0.7);
      let cr = this.fxC0[i3] + (this.fxC1[i3] - this.fxC0[i3]) * q;
      let cg = this.fxC0[i3 + 1] + (this.fxC1[i3 + 1] - this.fxC0[i3 + 1]) * q;
      let cb = this.fxC0[i3 + 2] + (this.fxC1[i3 + 2] - this.fxC0[i3 + 2]) * q;
      // smoke / dust / paper are unlit, so at night they must be darkened; glowing colours (>1) are left alone
      if (cr < 1.05 && cg < 1.05 && cb < 1.05) {
        cr *= this.fxDim[0];
        cg *= this.fxDim[1];
        cb *= this.fxDim[2];
      }
      ca[i3] = cr;
      ca[i3 + 1] = cg;
      ca[i3 + 2] = cb;
    }
    if (any || this.fxWasAny) {
      this.fx.instanceMatrix.needsUpdate = true;
      this.fx.instanceColor!.needsUpdate = true;
    }
    this.fxWasAny = any;
  }

  /* =============================================================== debris */

  private allocDebris(): number {
    if (this.dFree.length > 0) return this.dFree.pop()!;
    const i = this.dSteal;
    this.dSteal = (this.dSteal + 1) % DEB_N;
    return i;
  }

  private spawnDebris(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    hex: number,
    bounce = 0
  ) {
    const i = this.allocDebris();
    const i3 = i * 3;
    this.dPos[i3] = x;
    this.dPos[i3 + 1] = y;
    this.dPos[i3 + 2] = z;
    this.dVel[i3] = vx;
    this.dVel[i3 + 1] = vy;
    this.dVel[i3 + 2] = vz;
    // random quaternion
    const u1 = Math.random();
    const u2 = Math.random() * Math.PI * 2;
    const u3 = Math.random() * Math.PI * 2;
    const a = Math.sqrt(1 - u1);
    const b = Math.sqrt(u1);
    this.dQ[i * 4] = a * Math.sin(u2);
    this.dQ[i * 4 + 1] = a * Math.cos(u2);
    this.dQ[i * 4 + 2] = b * Math.sin(u3);
    this.dQ[i * 4 + 3] = b * Math.cos(u3);
    const av = rr(5, 14);
    this.dAv[i3] = rr(-1, 1) * av;
    this.dAv[i3 + 1] = rr(-1, 1) * av;
    this.dAv[i3 + 2] = rr(-1, 1) * av;
    this.dSize[i] = size;
    this.dBounce[i] = bounce;
    this.dState[i] = 1;
    this.dT[i] = 0;
    if (i + 1 > this.dHW) this.dHW = i + 1;
    _c.setHex(hex);
    const ca = this.deb.instanceColor!.array as Float32Array;
    this.dColorDirty = true;
    ca[i3] = _c.r;
    ca[i3 + 1] = _c.g;
    ca[i3 + 2] = _c.b;
  }

  private killDebris(i: number, m: Float32Array) {
    this.dState[i] = 0;
    zeroMat(m, i);
    this.dFree.push(i);
  }

  private updateDebris(dt: number) {
    const m = this.deb.instanceMatrix.array as Float32Array;
    const w = this.world;
    const P = this.dPos;
    const V = this.dVel;
    const Q = this.dQ;
    const A = this.dAv;
    let any = false;
    let hw = 0;
    for (let i = 0; i < this.dHW; i++) {
      const st = this.dState[i];
      if (st === 0) continue;
      any = true;
      hw = i + 1;
      const i3 = i * 3;
      const i4 = i * 4;
      const size = this.dSize[i];
      if (st === 1) {
        const half = size * 0.5;
        V[i3 + 1] -= GRAV * dt;
        if (this.attr.on) {
          // black hole: rubble is pulled in and swirls around it
          const gx = this.attr.x - P[i3];
          const gy = this.attr.y - P[i3 + 1];
          const gz = this.attr.z - P[i3 + 2];
          const gd = Math.sqrt(gx * gx + gy * gy + gz * gz) + 0.001;
          if (gd < this.attr.r) {
            if (gd < 0.9) {
              // swallowed
              this.dState[i] = 3;
              this.dT[i] = 0.25;
              continue;
            }
            const f = this.attr.k * dt * Math.min(2.7, 6 / gd + 0.7);
            V[i3] += (gx / gd) * f - (gz / gd) * f * 0.8;
            V[i3 + 1] += (gy / gd) * f + GRAV * dt * 0.85;
            V[i3 + 2] += (gz / gd) * f + (gx / gd) * f * 0.8;
            const damp = Math.exp(-0.9 * dt);
            V[i3] *= damp;
            V[i3 + 1] *= damp;
            V[i3 + 2] *= damp;
          }
        }
        let x = P[i3];
        let y = P[i3 + 1];
        let z = P[i3 + 2];
        const nx = x + V[i3] * dt;
        if (w.solidAt(Math.floor(nx + OFF_X), Math.floor(y + OFF_Y), Math.floor(z + OFF_Z))) {
          V[i3] *= -(this.dBounce[i] || 0.35);
        } else x = nx;
        const nz = z + V[i3 + 2] * dt;
        if (w.solidAt(Math.floor(x + OFF_X), Math.floor(y + OFF_Y), Math.floor(nz + OFF_Z))) {
          V[i3 + 2] *= -(this.dBounce[i] || 0.35);
        } else z = nz;
        const ny = y + V[i3 + 1] * dt;
        let landed = false;
        if (V[i3 + 1] < 0) {
          const cx = Math.floor(x + OFF_X);
          const cz = Math.floor(z + OFF_Z);
          const cy = Math.floor(ny - half + OFF_Y);
          if (w.solidAt(cx, cy, cz)) {
            y = cy + 1 - OFF_Y + half;
            const rb = this.dBounce[i] || 0.42;
            V[i3 + 1] = -V[i3 + 1] * rb;
            V[i3] *= this.dBounce[i] ? 0.93 : 0.8;
            V[i3 + 2] *= this.dBounce[i] ? 0.93 : 0.8;
            A[i3] *= 0.6;
            A[i3 + 1] *= 0.6;
            A[i3 + 2] *= 0.6;
            if (Math.abs(V[i3 + 1]) < (this.dBounce[i] ? 0.75 : 1.9)) landed = true;
          } else y = ny;
        } else {
          if (
            w.solidAt(Math.floor(x + OFF_X), Math.floor(ny + half + OFF_Y), Math.floor(z + OFF_Z))
          ) {
            V[i3 + 1] = -V[i3 + 1] * (this.dBounce[i] || 0.3);
          } else y = ny;
        }
        P[i3] = x;
        P[i3 + 1] = y;
        P[i3 + 2] = z;
        if (y < -32) {
          this.killDebris(i, m);
          continue;
        }
        if (landed) {
          this.dState[i] = 2;
          this.dT[i] = rr(1.8, 4);
          const ang = Math.floor(Math.random() * 4) * (Math.PI / 2) + rr(-0.15, 0.15);
          Q[i4] = 0;
          Q[i4 + 1] = Math.sin(ang / 2);
          Q[i4 + 2] = 0;
          Q[i4 + 3] = Math.cos(ang / 2);
          V[i3] = 0;
          V[i3 + 1] = 0;
          V[i3 + 2] = 0;
          writeMat(m, i * 16, x, y, z, 0, Q[i4 + 1], 0, Q[i4 + 3], size);
          continue;
        }
        // rotate
        let qx = Q[i4];
        let qy = Q[i4 + 1];
        let qz = Q[i4 + 2];
        let qw = Q[i4 + 3];
        const wx = A[i3] * dt * 0.5;
        const wy = A[i3 + 1] * dt * 0.5;
        const wz = A[i3 + 2] * dt * 0.5;
        const nqx = qx + (wx * qw + wy * qz - wz * qy);
        const nqy = qy + (wy * qw + wz * qx - wx * qz);
        const nqz = qz + (wz * qw + wx * qy - wy * qx);
        const nqw = qw + (-wx * qx - wy * qy - wz * qz);
        const inv = 1 / Math.hypot(nqx, nqy, nqz, nqw);
        qx = nqx * inv;
        qy = nqy * inv;
        qz = nqz * inv;
        qw = nqw * inv;
        Q[i4] = qx;
        Q[i4 + 1] = qy;
        Q[i4 + 2] = qz;
        Q[i4 + 3] = qw;
        writeMat(m, i * 16, x, y, z, qx, qy, qz, qw, size);
      } else if (st === 2) {
        this.dT[i] -= dt;
        if (this.dT[i] <= 0) {
          this.dState[i] = 3;
          this.dT[i] = 0.4;
        }
      } else {
        this.dT[i] -= dt;
        if (this.dT[i] <= 0) {
          this.killDebris(i, m);
          continue;
        }
        const s = size * (this.dT[i] / 0.4);
        writeMat(m, i * 16, P[i3], P[i3 + 1], P[i3 + 2], Q[i4], Q[i4 + 1], Q[i4 + 2], Q[i4 + 3], s);
      }
    }
    this.dHW = hw;
    if (any || this.dWasAny) this.deb.instanceMatrix.needsUpdate = true;
    if (this.dColorDirty) {
      // colours are written on spawn - they must be re-uploaded to the GPU
      this.deb.instanceColor!.needsUpdate = true;
      this.dColorDirty = false;
    }
    this.dWasAny = any;
  }

  /** blast existing debris & wake sleeping ones that lost their floor */
  private disturbDebris(
    cx: number,
    cy: number,
    cz: number,
    R: number,
    force: boolean,
    inFlight = false
  ) {
    const w = this.world;
    const reach = R * 1.5 + 2;
    for (let i = 0; i < this.dHW; i++) {
      const st = this.dState[i];
      if (st < (inFlight ? 1 : 2)) continue;
      const i3 = i * 3;
      const x = this.dPos[i3];
      const y = this.dPos[i3 + 1];
      const z = this.dPos[i3 + 2];
      const dx = x - cx;
      const dy = y - cy;
      const dz = z - cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const below = w.solidAt(
        Math.floor(x + OFF_X),
        Math.floor(y - this.dSize[i] * 0.5 - 0.05 + OFF_Y),
        Math.floor(z + OFF_Z)
      );
      if (force && d < reach) {
        const f = (1 - d / reach) * (4 + R * 1.4);
        const inv = 1 / (d + 0.01);
        this.dState[i] = 1;
        this.dVel[i3] = dx * inv * f;
        this.dVel[i3 + 1] = Math.abs(dy * inv * f) * 0.7 + f * 0.5 + 2;
        this.dVel[i3 + 2] = dz * inv * f;
        const av = rr(5, 12);
        this.dAv[i3] = rr(-1, 1) * av;
        this.dAv[i3 + 1] = rr(-1, 1) * av;
        this.dAv[i3 + 2] = rr(-1, 1) * av;
      } else if (!below) {
        this.dState[i] = 1;
        this.dVel[i3] = 0;
        this.dVel[i3 + 1] = 0;
        this.dVel[i3 + 2] = 0;
      }
    }
  }

  /* =============================================================== explosion */

  private floatWorld(
    x: number,
    y: number,
    z: number,
    text: string,
    kind: "coin" | "combo" | "chain" | "bonus",
    size: number
  ) {
    if (!this.hooks.onFloat) return;
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const sx = (v.x * 0.5 + 0.5) * this.container.clientWidth;
    const sy = (-v.y * 0.5 + 0.5) * this.container.clientHeight;
    this.hooks.onFloat(sx, sy, text, kind, size);
  }

  private vibrate(ms: number) {
    if (!store.getState().vibrate) return;
    const nav = navigator as Navigator & { userActivation?: { isActive: boolean } };
    if (nav.vibrate && nav.userActivation?.isActive) {
      try {
        nav.vibrate(ms);
      } catch {
        /* ignore */
      }
    }
  }

  private registerHit() {
    const st = store.getState();
    const combo = Math.min(100, st.combo + 1);
    const mult = 1 + combo * comboStep(st.levels.combo);
    this.comboT = 2.2;
    store.setState({ combo, comboMult: mult });
    return combo;
  }

  private explode(cx: number, cy: number, cz: number, R: number, o: ExplodeOpts) {
    const w = this.world;
    const carved = this.carved;
    const minor = !!o.minor;
    const st = store.getState();
    const ccy = cy - R * 0.1;
    const lvl = o.lvl ?? 1;
    const lk = (lvl - 1) / 9; // 0 at level 1 .. 1 at level 10

    this.blastGuards(cx, cy, cz, R, o.power);

    w.carve(cx, ccy, cz, R, this.seed++, carved);
    const n = carved.n;

    // ---- money
    const inc = incomeMult(st.levels.income);
    let coins = Math.floor(carved.coins * o.value * inc * st.comboMult);
    if (n > 0 && coins < 1) coins = 1;
    const combo = this.registerHit();
    if (coins > 0) {
      store.addMoney(coins);
      sfx.coin(combo - 1);
      // tiny rapid-fire blasts (fountain, gasing) don't spam the screen with numbers
      if (!minor || this.time - this.lastMinorFloat > 0.09) {
        if (minor) this.lastMinorFloat = this.time;
        this.floatWorld(
          cx,
          cy + 1.0 + R * 0.35,
          cz,
          `+${fmt(coins)}`,
          "coin",
          minor ? 0.8 : Math.min(1.8, 1 + R * 0.06)
        );
      }
    }
    if (combo > 1 && combo % 10 === 0) {
      this.floatWorld(cx, cy + 3 + R * 0.4, cz, `KOMBO x${combo}!`, "combo", 1.2);
    }

    // ---- debris: the closer to the core, the harder & farther it is thrown
    // higher level = more debris, thrown harder and farther
    const maxDeb = minor ? 56 : 340 + R * 40 + lk * 280;
    const pieces = n * 2 <= maxDeb ? 2 : 1;
    const keep = Math.min(1, maxDeb / Math.max(1, n * pieces));
    const tmp = new THREE.Vector3();
    const baseSp = (7 + R * 1.1 + o.power * 6) * (1 + 0.3 * lk);
    const baseUp = (9 + R * 1.2 + o.power * 7) * (1 + 0.22 * lk);
    for (let k = 0; k < n; k++) {
      if (keep < 1 && Math.random() > keep) continue;
      const c = carved.cells[k];
      w.cellWorld(c, tmp);
      let dx = tmp.x - cx;
      let dy = tmp.y - ccy;
      let dz = tmp.z - cz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001;
      dx /= dist;
      dy /= dist;
      dz /= dist;
      const near = 1 - Math.min(1, dist / (R + 1)); // 1 at the core, 0 at the rim
      const sp = baseSp * (0.3 + 0.85 * near) * rr(0.65, 1.3);
      const up = baseUp * (0.4 + 0.7 * near) * rr(0.5, 1.3);
      for (let p = 0; p < pieces; p++) {
        const j = p === 0 ? 0 : 0.3;
        const chunk = Math.random() < 0.08; // a few bigger lumps for realism
        this.spawnDebris(
          tmp.x + rr(-j, j),
          tmp.y + rr(-j, j),
          tmp.z + rr(-j, j),
          dx * sp * rr(0.8, 1.2),
          (dy * sp * 0.5 + up) * rr(0.85, 1.15),
          dz * sp * rr(0.8, 1.2),
          chunk ? rr(0.4, 0.56) : rr(0.13, 0.34),
          w.col[c],
          w.flag[c] & F_BOUNCY ? 0.82 : 0
        );
      }
    }
    // gravel: tiny fast shards that fly low and far, like shrapnel
    if (n > 0) {
      const nGrav = minor ? 6 : Math.floor(26 + R * 9);
      for (let i = 0; i < nGrav; i++) {
        const a = Math.random() * Math.PI * 2;
        const el = rr(0.15, 1.1);
        const s = baseSp * rr(0.9, 1.7);
        const cell = carved.cells[Math.floor(Math.random() * n)];
        this.spawnDebris(
          cx + rr(-0.4, 0.4),
          ccy + rr(0, 0.5),
          cz + rr(-0.4, 0.4),
          Math.cos(a) * Math.cos(el) * s,
          Math.sin(el) * s * 0.9 + 3,
          Math.sin(a) * Math.cos(el) * s,
          rr(0.08, 0.15),
          w.col[cell],
          w.flag[cell] & F_BOUNCY ? 0.82 : 0
        );
      }
    }
    // the casing of the cracker itself blows apart
    if (o.shell && o.shell.length) {
      const nShell = minor ? 4 : 14;
      for (let i = 0; i < nShell; i++) {
        const a = Math.random() * Math.PI * 2;
        const el = rr(0.2, 1.3);
        const s = baseSp * rr(0.7, 1.4);
        this.spawnDebris(
          cx,
          cy,
          cz,
          Math.cos(a) * Math.cos(el) * s,
          Math.sin(el) * s + 4,
          Math.sin(a) * Math.cos(el) * s,
          rr(0.14, 0.28),
          o.shell[i % o.shell.length]
        );
      }
    }
    // paper: flat flakes that tumble, flutter and drift down. More at higher levels,
    // and the paper cracker goes absolutely wild with a rainbow of colours.
    const cf = o.confetti ?? 0;
    if (cf > 0) {
      const own: Rgb[] = o.paper && o.paper.length ? o.paper.map((h) => rgbG(h, 1.12)) : CONFETTI;
      const pal = lvl >= 5 ? CONFETTI : own;
      const nConf = minor
        ? 6
        : cf > 0
          ? Math.floor(150 + R * 22 + lvl * 26)
          : Math.floor((26 + R * 3) * (1 + lk * 2.4));
      this.confetti(cx, cy, cz, nConf, R, pal);
    }

    // ---- fx
    const ks = Math.min(1.6, 0.4 + R * 0.12);
    const nFire = minor ? 8 : Math.floor((22 + R * 10) * (o.confetti ? 0.55 : 1));
    for (let i = 0; i < nFire; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(rr(-0.4, 1));
      const rad = Math.random() * R * 0.45;
      const sp = rr(1.5, 3.5 + R * 1.1);
      const dxv = Math.sin(ph) * Math.cos(th);
      const dyv = Math.cos(ph);
      const dzv = Math.sin(ph) * Math.sin(th);
      this.spawnFx(
        cx + dxv * rad,
        cy + dyv * rad * 0.8,
        cz + dzv * rad,
        dxv * sp,
        dyv * sp + 1,
        dzv * sp,
        rr(0.3, 0.7),
        ks * rr(0.32, 0.6),
        ks * rr(0.55, 0.95),
        -1.5,
        3.2,
        FIRE0,
        FIRE1
      );
    }
    // core pop
    for (let i = 0; i < (minor ? 3 : 9); i++) {
      this.spawnFx(
        cx + rr(-0.5, 0.5) * ks,
        cy + rr(-0.5, 0.5) * ks,
        cz + rr(-0.5, 0.5) * ks,
        0,
        0,
        0,
        minor ? 0.1 : 0.15,
        ks * 0.75,
        ks * 1.3,
        0,
        0,
        WHITE,
        FIRE0
      );
    }

    const nSmoke = minor ? 4 : Math.floor(12 + R * 4.5);
    for (let i = 0; i < nSmoke; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rr(0.3, 1.2 + R * 0.35);
      this.spawnFx(
        cx + rr(-1, 1) * R * 0.3,
        cy + rr(0, 1) * R * 0.3,
        cz + rr(-1, 1) * R * 0.3,
        Math.cos(a) * sp,
        rr(1.2, 3 + R * 0.4),
        Math.sin(a) * sp,
        rr(0.8, 1.7),
        ks * 0.3,
        ks * rr(0.6, 0.95),
        -0.8,
        1.6,
        SMOKE0,
        SMOKE1,
        rr(0.05, 0.2)
      );
    }
    if (!minor) {
      // fire jet shooting straight up out of the crater
      const nJet = Math.floor(9 + R * 2.5);
      for (let i = 0; i < nJet; i++) {
        this.spawnFx(
          cx + rr(-0.25, 0.25),
          cy,
          cz + rr(-0.25, 0.25),
          rr(-1.4, 1.4),
          rr(7, 12 + R * 0.8),
          rr(-1.4, 1.4),
          rr(0.28, 0.5),
          ks * 0.5,
          ks * 0.9,
          -2,
          2.4,
          FIRE0,
          FIRE1
        );
      }
    }
    // golden sparks: stretched into glowing streaks by updateFx
    const nSpark = minor ? 8 : Math.floor((30 + R * 8) * (1 + 0.9 * lk));
    for (let i = 0; i < nSpark; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(rr(-0.2, 1));
      const sp = rr(7, 17 + R * 0.6);
      this.spawnFx(
        cx,
        cy,
        cz,
        Math.sin(ph) * Math.cos(th) * sp,
        Math.cos(ph) * sp,
        Math.sin(ph) * Math.sin(th) * sp,
        rr(0.5, 1.25),
        rr(0.13, 0.22),
        0.04,
        18,
        0.55,
        SPARK0,
        SPARK1
      );
    }
    // embers that hang in the air and drift down, glowing - gorgeous at night
    const nEmber = minor ? 3 : Math.floor((24 + R * 4) * (1 + 0.9 * lk));
    for (let i = 0; i < nEmber; i++) {
      const sp = 1 + R * 0.1;
      this.spawnFx(
        cx + rr(-1, 1) * R * 0.3,
        cy + rr(0, 1) * R * 0.35,
        cz + rr(-1, 1) * R * 0.3,
        rr(-3, 3) * sp,
        rr(2, 7 + R * 0.5),
        rr(-3, 3) * sp,
        rr(1.0, 2.5),
        rr(0.09, 0.17),
        0.02,
        1.7,
        1.7,
        EMBER0,
        EMBER1,
        rr(0, 0.12)
      );
    }
    this.blastGlow(cx, cy, cz, R, minor);
    if (!minor) this.signatureBurst(o.style, cx, cy, cz, R, lvl);
    if (!minor && lvl >= 4) {
      // festive: 1 firework at level 4-6, 2 at 7-9, 3 at level 10
      const nFw = 1 + Math.floor((lvl - 4) / 3);
      for (let k = 0; k < nFw; k++) {
        this.fireworkBurst(
          cx + rr(-1, 1) * R * 0.3,
          cy + R * 0.45 + 3 + k * 1.3,
          cz + rr(-1, 1) * R * 0.3,
          64,
          6 + R * 0.3,
          0.12 + k * 0.17
        );
      }
    }

    if (!minor) {
      const nDust = Math.floor(20 + R * 8);
      for (let i = 0; i < nDust; i++) {
        const a = (i / nDust) * Math.PI * 2 + Math.random() * 0.3;
        const sp = rr(6, 11) + R * 0.7;
        let c0 = DUST0;
        let c1 = DUST1;
        if (n > 0 && i % 2 === 0) {
          const cc = carved.cells[Math.floor(Math.random() * n)];
          const r2 = rgb(w.col[cc]);
          c0 = r2;
          c1 = [r2[0] * 0.55, r2[1] * 0.55, r2[2] * 0.55];
        }
        this.spawnFx(
          cx,
          ccy + R * 0.15,
          cz,
          Math.cos(a) * sp,
          rr(0.3, 1.5),
          Math.sin(a) * sp,
          rr(0.45, 0.8),
          ks * 0.38,
          ks * 0.62,
          0,
          3.6,
          c0,
          c1
        );
      }
    }

    if (o.nuke) this.mushroom(cx, cy, cz, R, ks);

    // ---- light / camera / time
    this.flashLight.position.set(cx, cy + 1.5, cz);
    this.flashLight.color.setHex(0xffa24a);
    this.flashI = Math.max(this.flashI, (30 + 10 * R) * (minor ? 0.3 : 1));
    const add = minor ? 0.05 : 0.2 + 0.2 * o.power + R * 0.03 + lk * 0.12;
    this.trauma = Math.max(this.trauma, Math.min(0.9, this.trauma + add));
    this.punch = Math.max(this.punch, minor ? 0.1 : 0.4 + R * 0.04);
    if (!minor && R >= 5) {
      this.slowT = Math.max(this.slowT, o.nuke ? 0.45 : 0.06 + R * 0.008);
    } else if (!minor && this.time > this.slowCool) {
      // a tiny freeze-frame on impact makes even small bangs hit hard
      this.slowT = Math.max(this.slowT, 0.04 + 0.03 * o.power);
      this.slowCool = this.time + 0.4;
    }
    if (o.nuke) this.hooks.onFlash?.(0.6);
    else if (!minor && R >= 6) this.hooks.onFlash?.(0.22);
    else if (!minor && R >= 4) this.hooks.onFlash?.(0.08);

    // ---- sound
    if (o.snd === "crack" || (minor && o.snd !== "boom")) sfx.crack(rr(0.8, 1.4));
    else sfx.boom(R, o.power, lvl);
    if (cf > 0 && !minor) sfx.confetti(lvl);
    this.vibrate(minor ? 8 : Math.min(60, 16 + R * 3));

    // ---- world reaction
    if (n > 0) {
      this.disturbDebris(cx, ccy, cz, R, true);
      this.queueCollapse();
    }
    // sympathetic detonation
    if (!minor) {
      for (const c of this.crackers) {
        if (c.active) continue;
        const dx = c.x - cx;
        const dy = c.y - cy;
        const dz = c.z - cz;
        if (dx * dx + dy * dy + dz * dz < R * R * 1.1 && c.age < c.fuse - 0.1) {
          c.age = c.fuse - 0.06 - Math.random() * 0.08;
        }
      }
    }
    // chain reaction from explosive barrels
    if (carved.exCount > 0 && (o.chain ?? 0) < 4) {
      const ex = carved.exX;
      const ey = carved.exY;
      const ez = carved.exZ;
      const depth = (o.chain ?? 0) + 1;
      const cr = Math.max(3.4, Math.min(9, R * 0.55 + 1.5));
      this.schedule(0.14, () => {
        if (this.phase !== "play") return;
        this.floatWorld(ex, ey + 2.4, ez, "CHAIN!", "chain", 1.2);
        this.explode(ex, ey, ez, cr, {
          value: 1.6,
          power: 0.55,
          chain: depth,
          snd: "boom",
        });
      });
    }

    this.checkStage();
  }

  /** A recognisable silhouette and colour language for every final explosion. */
  private signatureBurst(style: string | undefined, x: number, y: number, z: number, R: number, lvl: number) {
    if (!style) return;
    const lk = (lvl - 1) / 9;
    const radial = (count: number, c0: Rgb, c1: Rgb, vertical: number, spin = 0) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const sp = rr(5, 9 + R * 0.45) * (1 + lk * 0.25);
        this.spawnFx(
          x, y, z,
          Math.cos(a) * sp - Math.sin(a) * spin,
          rr(-vertical, vertical) + Math.abs(vertical) * 0.35,
          Math.sin(a) * sp + Math.cos(a) * spin,
          rr(0.7, 1.35), 0.18, 0.035, 7, 1.2, c0, c1
        );
      }
    };
    const sphere = (count: number, speed: number, c0: Rgb, c1: Rgb, delay = 0) => {
      for (let i = 0; i < count; i++) {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(rr(-1, 1));
        const sp = speed * rr(0.82, 1.08) * (1 + lk * 0.18);
        this.spawnFx(
          x, y, z,
          Math.sin(ph) * Math.cos(th) * sp,
          Math.cos(ph) * sp,
          Math.sin(ph) * Math.sin(th) * sp,
          rr(1.1, 1.9), 0.19, 0.03, 7, 1.1, c0, c1, delay
        );
      }
    };
    switch (style) {
      case "cabe":
        radial(34 + lvl * 3, CONFETTI[0], SPARK1, 3.5);
        break;
      case "kertas":
        // the confetti system is the signature; add a champagne-like vertical fan
        for (let i = 0; i < 28 + lvl * 3; i++)
          this.spawnFx(x, y, z, rr(-4, 4), rr(9, 17), rr(-4, 4), 1.2, .16, .04, 8, 1, GLINT, CONFETTI[i % CONFETTI.length]);
        break;
      case "bambu":
        // a tall, narrow golden pressure column
        for (let i = 0; i < 55 + lvl * 4; i++)
          this.spawnFx(x, y, z, rr(-2.3, 2.3), rr(10, 22 + R), rr(-2.3, 2.3), 1.1, .2, .035, 13, 1.1, SPARK0, FIRE1);
        break;
      case "tnt": {
        // six hard, cubic jets along the world axes
        const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        for (const d of dirs) for (let i = 0; i < 18 + lvl; i++) {
          const sp = rr(8, 18 + R);
          this.spawnFx(x, y, z, d[0] * sp + rr(-2,2), d[1] * sp + rr(-2,2), d[2] * sp + rr(-2,2), .9, .24, .04, 12, 1.2, FIRE0, FIRE1);
        }
        break;
      }
      case "gasing":
        radial(55 + lvl * 4, SOFT_PALETTES[2][0], SPARK0, 2.5, 7 + lvl);
        break;
      case "kodok":
        // premium peony: three precise expanding shells, then a gold glitter core
        sphere(46 + lvl * 3, 7 + R * .22, SOFT_PALETTES[3][0], SOFT_PALETTES[3][1]);
        sphere(38 + lvl * 2, 9.5 + R * .25, SOFT_PALETTES[2][0], SOFT_PALETTES[2][1], .09);
        sphere(30 + lvl * 2, 12 + R * .3, SOFT_PALETTES[1][0], SOFT_PALETTES[1][1], .18);
        for (let i = 0; i < 32 + lvl * 3; i++)
          this.spawnFx(x, y, z, rr(-5,5), rr(5,14), rr(-5,5), 1.8, .11, .02, 2.5, 1.7, SPARK0, EMBER1, .22);
        break;
      case "petir":
        for (let i = 0; i < 5 + Math.floor(lvl / 2); i++) this.arc(x, y + 1, z, 3 + R * .35);
        break;
      case "lubang":
        // galaxy: two spiral arms, blue-violet nebula, white star core and an equatorial ring
        for (let arm = 0; arm < 2; arm++) {
          for (let i = 0; i < 85 + lvl * 6; i++) {
            const q = i / (85 + lvl * 6);
            const a = arm * Math.PI + q * Math.PI * 5 + rr(-.12, .12);
            const sp = 2.5 + q * (11 + R * .25);
            const pal = q < .45 ? SOFT_PALETTES[4] : SOFT_PALETTES[2];
            this.spawnFx(x, y, z, Math.cos(a) * sp, rr(-1.1,1.1) + (q-.5)*2, Math.sin(a) * sp, rr(1.5,2.7), .17, .025, 2.5, 1.25, pal[0], pal[1], q * .16);
          }
        }
        radial(70 + lvl * 4, VOID0, SOFT_PALETTES[2][0], .55, -(11 + lvl));
        sphere(30 + lvl * 3, 8, WHITE, VOID0, .12);
        break;
      case "ufo":
        // pure blue-neon laser supernova: concentric discs, vertical beams and a cyan core
        for (let ring = 0; ring < 4; ring++) {
          const count = 44 + ring * 10 + lvl * 2;
          const c0 = ring % 2 ? BOLT0 : SOFT_PALETTES[2][0];
          const c1 = ring % 2 ? BOLT1 : SOFT_PALETTES[2][1];
          for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            const sp = 5 + ring * 2.7 + R * .18;
            this.spawnFx(x, y, z, Math.cos(a)*sp, (ring-1.5)*.38, Math.sin(a)*sp, 1.2, .16, .025, 3, 1.4, c0, c1, ring*.07);
          }
        }
        sphere(48 + lvl * 3, 8 + R * .25, BOLT0, BOLT1, .13);
        for (let i = 0; i < 42 + lvl * 3; i++) {
          const a = (i / (42 + lvl * 3)) * Math.PI * 2;
          this.spawnFx(x, y, z, Math.cos(a)*rr(2,5), rr(-18,18), Math.sin(a)*rr(2,5), .75, .13, .025, 4, 1.2, i%3 ? BOLT0 : WHITE, BOLT1, .08);
        }
        break;
      case "gorilla":
        // stone-grey ground crown with green Hulk-style energy vents
        radial(56 + lvl * 4, rgbG(0x9ca3af, 1.18), rgb(0x303640), 5.5);
        for (let i = 0; i < 45 + lvl * 3; i++) this.spawnFx(x, y, z, rr(-9,9), rr(7,18), rr(-9,9), 1.1, .17, .035, 13, 1.1, SOFT_PALETTES[3][0], SPARK1);
        break;
      case "semut":
        radial(42 + lvl * 4, rgbG(0xef4444, 1.15), rgb(0x171717), 2.2, 4);
        break;
      case "naga":
        // the tail-to-head chain is the signature; head finishes in a warm fire crown
        radial(38 + lvl * 3, FIRE0, CONFETTI[0], 8);
        break;
      case "disco":
        for (let k = 0; k < 3; k++) radial(30 + lvl * 2, SOFT_PALETTES[k * 2][0], SOFT_PALETTES[k * 2][1], k * 3 + .5, k * 2);
        break;
      case "air":
        // a crown: narrow upward rays rather than a spherical bomb
        for (let i = 0; i < 50 + lvl * 4; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = rr(4, 10);
          const p = SOFT_PALETTES[i % SOFT_PALETTES.length];
          this.spawnFx(x, y, z, Math.cos(a) * sp, rr(8, 18), Math.sin(a) * sp, 1.2, .17, .04, 12, .9, p[0], p[1]);
        }
        break;
      case "drill":
        // underground pressure vents upward as a tight corkscrew geyser
        for (let i = 0; i < 80 + lvl * 5; i++) {
          const q = i / (80 + lvl * 5);
          const a = q * Math.PI * 12;
          const r = .5 + q * (2.4 + R * .15);
          this.spawnFx(x, y, z, Math.cos(a)*r*2, rr(10,20+R), Math.sin(a)*r*2, 1.2, .18, .035, 15, 1.1, i%3 ? SPARK0 : SOFT_PALETTES[2][0], FIRE1, q*.08);
        }
        break;
      case "atom":
        // mushroom cloud is already uniquely generated by mushroom()
        break;
    }
  }

  private mushroom(cx: number, cy: number, cz: number, R: number, ks: number) {
    const stemH = R * 1.8;
    for (let i = 0; i < 70; i++) {
      const t = i / 70;
      const hot = t < 0.5;
      this.spawnFx(
        cx + rr(-1, 1) * R * 0.14,
        cy + t * stemH * 0.5,
        cz + rr(-1, 1) * R * 0.14,
        rr(-0.5, 0.5),
        rr(5, 9) + R * 0.4,
        rr(-0.5, 0.5),
        rr(1.0, 1.6),
        ks * 0.42,
        ks * 0.75,
        0,
        1.1,
        hot ? FIRE0 : SMOKE0,
        hot ? FIRE1 : SMOKE1,
        t * 0.25
      );
    }
    const capY = cy + stemH;
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rr(2.5, 5 + R * 0.5);
      const hot = Math.random() < 0.55;
      this.spawnFx(
        cx + Math.cos(a) * R * 0.2,
        capY + rr(-1, 1) * R * 0.15,
        cz + Math.sin(a) * R * 0.2,
        Math.cos(a) * sp,
        rr(0.5, 2.5),
        Math.sin(a) * sp,
        rr(1.5, 2.3),
        ks * 0.5,
        ks * 1.05,
        -0.3,
        1.5,
        hot ? FIRE0 : SMOKE0,
        hot ? FIRE1 : SMOKE1,
        0.3 + Math.random() * 0.25
      );
    }
    for (let i = 0; i < 36; i++) {
      this.spawnFx(
        cx + rr(-1, 1) * R * 0.35,
        capY + rr(0.2, 1.4) * R * 0.3,
        cz + rr(-1, 1) * R * 0.35,
        rr(-1, 1),
        rr(1, 3),
        rr(-1, 1),
        rr(1.6, 2.4),
        ks * 0.6,
        ks * 1.25,
        -0.2,
        1.2,
        SMOKE0,
        SMOKE1,
        0.45 + Math.random() * 0.3
      );
    }
  }

  /* =============================================================== collapse */

  private queueCollapse() {
    if (this.collapseQueued) return;
    this.collapseQueued = true;
    this.schedule(0.2, () => {
      this.collapseQueued = false;
      this.collapse();
    });
  }

  private collapse() {
    if (this.phase !== "play") return;
    const w = this.world;
    const cr = this.carved2;
    w.findUnsupported(cr);
    if (cr.n === 0) return;
    const n = cr.n;
    w.removeCells(cr);
    const st = store.getState();
    const coins = Math.floor(cr.coins * 0.9 * incomeMult(st.levels.income) * st.comboMult);
    const tmp = new THREE.Vector3();
    const keep = Math.min(1, 420 / n);
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let cnt = 0;
    for (let k = 0; k < n; k++) {
      const c = cr.cells[k];
      w.cellWorld(c, tmp);
      sx += tmp.x;
      sy += tmp.y;
      sz += tmp.z;
      cnt++;
      if (Math.random() < keep) {
        this.spawnDebris(
          tmp.x,
          tmp.y,
          tmp.z,
          rr(-2.5, 2.5),
          rr(0, 3),
          rr(-2.5, 2.5),
          rr(0.22, 0.5),
          w.col[c]
        );
      }
      if (k % 14 === 0) {
        this.spawnFx(
          tmp.x,
          tmp.y,
          tmp.z,
          rr(-1.5, 1.5),
          rr(0.5, 2),
          rr(-1.5, 1.5),
          rr(0.5, 1.0),
          0.5,
          1.1,
          0,
          2.5,
          DUST0,
          DUST1
        );
      }
    }
    const mx = sx / cnt;
    const my = sy / cnt;
    const mz = sz / cnt;
    if (coins > 0) {
      store.addMoney(coins);
      sfx.coin(Math.min(15, st.combo));
      this.floatWorld(mx, my + 1.5, mz, `+${fmt(coins)}`, "coin", 0.9);
    }
    if (n > 8) {
      sfx.boom(Math.min(6, 1.5 + n / 40), 0.25);
      this.trauma = Math.min(1, this.trauma + Math.min(0.35, 0.08 + n / 500));
      this.flashLight.position.set(mx, my + 1, mz);
      this.flashI = Math.max(this.flashI, 40);
    }
    if (cr.exCount > 0) {
      const ex = cr.exX;
      const ey = cr.exY;
      const ez = cr.exZ;
      this.schedule(0.1, () => {
        this.floatWorld(ex, ey + 2, ez, "CHAIN!", "chain", 1.2);
        this.explode(ex, ey, ez, 4.2, {
          value: 1.6,
          power: 0.5,
          chain: 2,
          snd: "boom",
        });
      });
    }
    this.disturbDebris(mx, my, mz, 1, false);
    this.queueCollapse();
    this.checkStage();
  }

  /* =============================================================== stage flow */

  private checkStage() {
    const w = this.world;
    const clearPoint = w.missionTotal * 0.08;
    const done = w.missionTotal - w.missionAlive;
    const pr = Math.max(0, Math.min(1, done / Math.max(1, w.missionTotal - clearPoint)));
    if (Math.abs(pr - this.lastProgress) > 0.008 || pr >= 1) {
      this.lastProgress = pr;
      store.setState({ progress: pr });
    }
    if (this.phase === "play" && w.missionAlive <= clearPoint) this.startClear();
  }

  private startClear() {
    this.phase = "clear";
    this.phaseT = 0;
    const w = this.world;
    const st = store.getState();
    // wipe pending stuff
    for (const c of this.crackers) {
      this.scene.remove(c.group);
      for (const seg of c.tail) this.scene.remove(seg);
    }
    this.crackers.length = 0;
    this.attr.on = false;
    this.comets.length = 0;
    this.events.length = 0;
    this.collapseQueued = false;

    const bonus = Math.round(220 * Math.pow(1.22, st.stage - 1) * incomeMult(st.levels.income));
    store.showBanner(`STAGE ${st.stage} BERSIH!`, `Bonus +${fmt(bonus)}`);
    sfx.fanfare();
    this.hooks.onFlash?.(0.3);

    // finale: leftover props pop into the sky
    const cr = this.carved2;
    w.collectProps(cr);
    const n = cr.n;
    const tmp = new THREE.Vector3();
    const keep = Math.min(1, 480 / Math.max(1, n));
    w.removeCells(cr);
    for (let k = 0; k < n; k++) {
      if (Math.random() > keep) continue;
      const c = cr.cells[k];
      w.cellWorld(c, tmp);
      this.spawnDebris(
        tmp.x,
        tmp.y,
        tmp.z,
        rr(-5, 5),
        rr(9, 18),
        rr(-5, 5),
        rr(0.2, 0.46),
        w.col[c]
      );
    }
    for (let i = 0; i < 200; i++) {
      const pal = BURST_PALETTES[i % BURST_PALETTES.length];
      const a = Math.random() * Math.PI * 2;
      const sp = rr(3, 12);
      this.spawnFx(
        rr(-6, 6),
        rr(2, 6),
        rr(-6, 6),
        Math.cos(a) * sp,
        rr(6, 16),
        Math.sin(a) * sp,
        rr(1.2, 2.2),
        0.3,
        0.12,
        10,
        0.8,
        pal[0],
        pal[1]
      );
    }
    this.trauma = Math.min(1, this.trauma + 0.5);
    store.addMoney(bonus);
    this.floatWorld(0, 4, 0, `+${fmt(bonus)}`, "bonus", 1.6);
    this.vibrate(80);
    this.phaseT = 0;
  }

  private updatePhase(rdt: number) {
    if (this.phase === "play") return;
    this.phaseT += rdt;
    const g = this.world.group;
    if (this.phase === "clear") {
      if (this.phaseT > 1.5) {
        this.phase = "out";
        this.phaseT = 0;
        sfx.whoosh();
      }
    } else if (this.phase === "out") {
      const k = Math.min(1, this.phaseT / 0.75);
      g.position.y = -60 * k * k;
      if (k >= 1) {
        const stage = store.getState().stage + 1;
        store.setState({ stage, progress: 0 });
        this.lastProgress = 0;
        this.world.generate(stage);
        this.resetGuards();
        this.pushTheme();
        g.position.y = -60;
        this.phase = "in";
        this.phaseT = 0;
        sfx.whoosh();
      }
    } else if (this.phase === "in") {
      const k = Math.min(1, this.phaseT / 1.0);
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const e = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
      g.position.y = -60 * (1 - e);
      if (k >= 1) {
        g.position.y = 0;
        this.phase = "play";
        this.trauma = Math.min(1, this.trauma + 0.55);
        this.punch = Math.max(this.punch, 0.6);
        sfx.boom(4, 0.5);
        for (let i = 0; i < 70; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = rr(6, 14);
          this.spawnFx(
            Math.cos(a) * 11,
            0.5,
            Math.sin(a) * 11,
            Math.cos(a) * sp,
            rr(0.5, 3),
            Math.sin(a) * sp,
            rr(0.5, 0.9),
            0.6,
            1.2,
            0,
            3,
            DUST0,
            DUST1
          );
        }
        const s = store.getState();
        store.showBanner(`MISI ${s.stage}`, this.world.theme.mission);
      }
    }
  }

  /* =============================================================== auto fire */

  private autoFire() {
    if (this.crackers.length > 60) return;
    let bestY = -1;
    let bx = 0;
    let bz = 0;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 15.5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const ty = this.world.topY(Math.floor(x + OFF_X), Math.floor(z + OFF_Z));
      if (ty > bestY) {
        bestY = ty;
        bx = x;
        bz = z;
      }
    }
    if (bestY < 0) return;
    this.launch(
      new THREE.Vector3(bx, bestY + 1 - OFF_Y, bz),
      { x: 0, y: 1, z: 0 },
      store.getState().throwMode
    );
  }

  /* =============================================================== main loop */

  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = t / 1000;
    const rdt = Math.min(0.05, Math.max(0, now - this.last));
    this.last = now;

    if (this.slowT > 0) {
      this.slowT -= rdt;
      this.ts = 0.2;
    } else {
      this.ts += (1 - this.ts) * Math.min(1, rdt * 9);
    }
    const dt = rdt * this.ts;
    this.update(dt, rdt);

    if (this.contextLost) return;

    if (this.composer) {
      try {
        this.composer.render(rdt);
      } catch (err) {
        console.warn("Bloom gagal, kembali ke render biasa:", err);
        this.composer = null;
        this.bloom = null;
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
      }
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private update(dt: number, rdt: number) {
    this.time += rdt;
    const st = store.getState();

    if (st.glow !== this.lastGlow) {
      this.lastGlow = st.glow;
      this.applyLook();
    }

    // day <-> night: ease every light / sky / glow value over ~0.45s
    const wantNight = st.night ? 1 : 0;
    if (this.nightT !== wantNight) {
      const step = rdt * 2.2;
      this.nightT =
        this.nightT < wantNight
          ? Math.min(wantNight, this.nightT + step)
          : Math.max(wantNight, this.nightT - step);
      this.applyLook();
    }
    if (this.nightT > 0.02) {
      const tw = this.time * 1.9;
      (this.starsA.material as THREE.PointsMaterial).opacity = this.nightT * (0.7 + 0.3 * Math.sin(tw));
      (this.starsB.material as THREE.PointsMaterial).opacity =
        this.nightT * (0.7 + 0.3 * Math.sin(tw + Math.PI));
    }

    // scheduled events
    if (this.events.length) {
      const due: (() => void)[] = [];
      for (let i = this.events.length - 1; i >= 0; i--) {
        const e = this.events[i];
        e.t -= dt;
        if (e.t <= 0) {
          due.push(e.fn);
          this.events.splice(i, 1);
        }
      }
      for (let i = due.length - 1; i >= 0; i--) due[i]();
    }

    this.updateCrackers(dt);
    this.updateGuards(dt);
    this.updateGlowLights();
    this.tension += (this.tensionTarget - this.tension) * Math.min(1, rdt * 7);
    if (this.tension > 0.3) this.trauma = Math.max(this.trauma, 0.04 + 0.1 * this.tension);
    this.updateComets(dt);
    this.updateDebris(dt);
    this.updateFx(dt);
    this.updateBlastMeshes(dt);
    this.updateSnow(dt);
    this.world.flush();

    // glare limiter: the more bright particles recently spawned, the softer the bloom
    this.glare *= Math.exp(-2.4 * rdt);
    if (this.bloom) this.bloom.strength = this.bloomBase / (1 + this.glare * 0.004);

    // flash light
    this.flashI *= Math.exp(-9 * dt);
    if (this.flashI < 0.5) this.flashI = 0;
    this.flashLight.intensity = this.flashI;

    // combo decay
    if (st.combo > 0) {
      this.comboT -= rdt;
      if (this.comboT <= 0) store.setState({ combo: 0, comboMult: 1 });
    }

    // auto
    const al = st.levels.auto;
    if (al > 0 && this.phase === "play") {
      this.autoT += rdt;
      if (this.autoT >= autoInterval(al)) {
        this.autoT = 0;
        this.autoFire();
      }
    }

    this.updatePhase(rdt);

    // clouds
    this.clouds.rotation.y += rdt * 0.015;
    this.clouds.position.y = Math.sin(this.time * 0.4) * 0.7;

    // camera
    this.userIdle += rdt;
    if (this.userIdle > 4) this.yaw += rdt * 0.04;
    const dist = this.fitDist * this.zoom;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const cam = this.camera;
    cam.position.set(
      this.target.x + dist * cp * Math.sin(this.yaw),
      this.target.y + dist * sp,
      this.target.z + dist * cp * Math.cos(this.yaw)
    );
    const tr = this.trauma * this.trauma;
    const shakeMode = st.cameraShake;
    const shakeOn = shakeMode === "comfort" ? tr > 0.004 : this.trauma > 0.46;
    if (shakeOn) {
      // Smooth, deterministic damped oscillation instead of per-frame random jitter.
      // Comfort keeps it tiny; Impact ignores small effects and only moves on major hits.
      const mul = shakeMode === "comfort" ? 0.34 : 0.72;
      const sx = Math.sin(this.time * 31) * tr * mul;
      const sy = Math.sin(this.time * 24 + 1.2) * tr * mul * 0.48;
      const sz = Math.sin(this.time * 27 + 2.4) * tr * mul;
      cam.position.x += sx;
      cam.position.y += sy;
      cam.position.z += sz;
    }
    cam.lookAt(this.target);
    if (shakeOn) cam.rotateZ(Math.sin(this.time * 20) * tr * (shakeMode === "comfort" ? 0.006 : 0.014));
    this.trauma = Math.max(0, this.trauma - rdt * 1.7);
    this.punch = Math.max(0, this.punch - rdt * 2.4);
    const fov = this.baseFov - this.punch * 2.6 - this.tension * 1.8;
    if (Math.abs(cam.fov - fov) > 0.001) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }
}
  