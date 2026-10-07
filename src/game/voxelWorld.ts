import * as THREE from "three";

export const W = 40;
export const D = 40;
export const H = 36;
export const T = 5; // top ground layer index
export const OFF_X = W / 2;
export const OFF_Y = T + 1;
export const OFF_Z = D / 2;
export const N = W * D * H;

export const F_PROP = 1;
export const F_EXPLOSIVE = 2;
export const F_BEDROCK = 4;
export const F_GLOW = 8; // self-lit at night (gold ore, lit windows, flames)
export const F_BOUNCY = 16; // rubber toys become high-restitution debris
export const F_MISSION = 32; // primary landmark that completes the stage mission

export interface Theme {
  name: string;
  bg: [string, string];
  night: [string, string, string]; // top, middle, horizon
  top: number[];
  dirt: number[];
  stone: number[];
  flowers: number[];
  wall: number;
  roof: number;
  leaf: number[];
  brick: number[];
  road: boolean;
  landmark: string;
  mission: string;
  fill: string[];
}

export const THEMES: Theme[] = [
  {
    name: "Istana Kerajaan",
    bg: ["#83ceff", "#ffe5bd"],
    night: ["#080b30", "#24266e", "#a84e8b"],
    top: [0x68be52, 0x73ca5b, 0x5db249],
    dirt: [0x946644, 0x85583a, 0xa6754e],
    stone: [0x9098a8, 0x818a9b],
    flowers: [0xffe14d, 0xff74ad, 0xffffff, 0x73d9ff],
    wall: 0xffe4a3,
    roof: 0x7c3aed,
    leaf: [0x31a852, 0x3db961, 0x269447],
    brick: [0xf1cf83, 0xe5bb69, 0xffdea0],
    road: false,
    landmark: "palace",
    mission: "Hancurkan Istana Kerajaan",
    fill: ["tree", "tree", "fountainGarden", "crates", "ball", "slime", "tower", "umbrella", "tires"],
  },
  {
    name: "Kampung",
    bg: ["#59c8ff", "#d9f6ff"],
    night: ["#050827", "#17195f", "#7a3fa6"],
    top: [0x5fc24a, 0x56b843, 0x69cd53],
    dirt: [0x9b6b43, 0x8a5c38, 0xa6744a],
    stone: [0x8d96a3, 0x7f8896],
    flowers: [0xffe14d, 0xff7aa8, 0xffffff],
    wall: 0xf4e6c4,
    roof: 0xd9453b,
    leaf: [0x2fa84f, 0x3bb85a, 0x27964a],
    brick: [0xc2452d, 0xb23a26, 0xd0603f],
    road: false,
    landmark: "monas",
    mission: "Runtuhkan Benteng Monas",
    fill: ["house", "tree", "tree", "crates", "melon", "cans", "tower", "tree", "house", "ball", "tires", "slime"],
  },
  {
    name: "Gurun",
    bg: ["#ff9f5a", "#ffe9bd"],
    night: ["#12062b", "#4a2166", "#e0605a"],
    top: [0xf0cf7d, 0xe9c46d, 0xf5d98b],
    dirt: [0xd9a95b, 0xcf9d50, 0xe0b36a],
    stone: [0xb08a5b, 0xa27d52],
    flowers: [0xff6fa5, 0xffffff],
    wall: 0xe8cf95,
    roof: 0xb5651d,
    leaf: [0x3fa34d, 0x35934a],
    brick: [0xd9b46a, 0xc9a25a, 0xe3c07a],
    road: false,
    landmark: "pyramid",
    mission: "Hancurkan Piramida Emas",
    fill: ["cactus", "cactus", "crates", "cans", "tower", "melon", "cactus", "cactus", "ball", "tires"],
  },
  {
    name: "Salju",
    bg: ["#8fa8ff", "#eaf2ff"],
    night: ["#050d30", "#123a7a", "#58a8d8"],
    top: [0xffffff, 0xf1f7ff, 0xe4eeff],
    dirt: [0x9a7352, 0x8a6648],
    stone: [0x8a9bb0, 0x7a8ca3],
    flowers: [0xbfe3ff, 0xffffff],
    wall: 0xdcecff,
    roof: 0x4a7fd1,
    leaf: [0x2f7a4f, 0x276a43],
    brick: [0x9fb7d6, 0x8aa5c8, 0xb4c8e2],
    road: false,
    landmark: "snowcastle",
    mission: "Hancurkan Kastel Salju",
    fill: ["pine", "pine", "pine", "crates", "house", "cans", "pine", "melon", "snowball", "slime"],
  },
  {
    name: "Kota",
    bg: ["#8b7bff", "#ffc9de"],
    night: ["#080521", "#2b0f66", "#c0409a"],
    top: [0x9aa2b1, 0xa7aebc, 0x8f97a6],
    dirt: [0x9096a6, 0x858c9d],
    stone: [0x7d869a, 0x727b8f],
    flowers: [0xffe14d, 0xffffff],
    wall: 0x9aa7c0,
    roof: 0x5a6a8a,
    leaf: [0x2fa84f, 0x3bb85a],
    brick: [0x8b93a8, 0x7e869b, 0x98a0b4],
    road: true,
    landmark: "sky",
    mission: "Runtuhkan Menara Kota",
    fill: ["sky", "sky", "crates", "tree", "crates", "cans", "tree", "tires", "ball", "trampoline"],
  },
  {
    name: "Pantai",
    bg: ["#42d7ff", "#fff0bd"],
    night: ["#031932", "#074d78", "#c16b8e"],
    top: [0xf3d58a, 0xeac979, 0xffdf98],
    dirt: [0xd3a95f, 0xc99a51],
    stone: [0x7ca4b0, 0x6c939f],
    flowers: [0xff6fa5, 0xffffff, 0x5de1ff],
    wall: 0xfff3cf,
    roof: 0x29a9c9,
    leaf: [0x35b85a, 0x27994d, 0x62c95d],
    brick: [0xe3c27a, 0xd7b56a, 0xf0d08b],
    road: false,
    landmark: "lighthouse",
    mission: "Runtuhkan Mercusuar",
    fill: ["palm", "palm", "ball", "ball", "umbrella", "crates", "melon", "trampoline", "tires"],
  },
  {
    name: "Taman Main",
    bg: ["#75d7ff", "#ffe3f2"],
    night: ["#09052d", "#392078", "#d8529d"],
    top: [0x77ce58, 0x68c34b, 0x85d968],
    dirt: [0x9d7049, 0x8d623f],
    stone: [0x8e94aa, 0x7f879e],
    flowers: [0xffdf4d, 0xff6fa5, 0x71d9ff],
    wall: 0xffe2a8,
    roof: 0xe84c8b,
    leaf: [0x3fbd5c, 0x2fa84f],
    brick: [0x8c6fe8, 0xf06f9f, 0x56bddd],
    road: false,
    landmark: "windmill",
    mission: "Hancurkan Menara Kincir",
    fill: ["ball", "slime", "trampoline", "tires", "tree", "umbrella", "crates", "ball", "slime"],
  },
];

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const idx = (x: number, y: number, z: number) => (y * D + z) * W + x;
export const inb = (x: number, y: number, z: number) =>
  x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D;

export interface Carved {
  n: number;
  cells: Int32Array;
  coins: number;
  props: number;
  exCount: number;
  exX: number;
  exY: number;
  exZ: number;
}

export function makeCarved(): Carved {
  return {
    n: 0,
    cells: new Int32Array(N),
    coins: 0,
    props: 0,
    exCount: 0,
    exX: 0,
    exY: 0,
    exZ: 0,
  };
}

export interface RayHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

export interface GuardSpawn {
  x: number;
  y: number;
  z: number;
  facing: number;
  role: "knight" | "orc";
}

export class VoxelWorld {
  readonly group = new THREE.Group();
  readonly solid = new Uint8Array(N);
  readonly col = new Uint32Array(N);
  readonly val = new Uint8Array(N);
  readonly flag = new Uint8Array(N);
  private instOfCell = new Int32Array(N).fill(-1);
  private cellOfInst = new Int32Array(0);
  private cap = 0;
  count = 0;
  mesh: THREE.InstancedMesh | null = null;
  propTotal = 1;
  propAlive = 1;
  missionTotal = 1;
  missionAlive = 1;
  theme: Theme = THEMES[0];
  guardSpawns: GuardSpawn[] = [];
  private dirty = false;
  night = true;
  private rnd: () => number = Math.random;
  private occ = new Uint8Array(W * D);
  private geo = new THREE.BoxGeometry(1, 1, 1);
  private mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  private tmpC = new THREE.Color();
  private visited = new Uint8Array(N);
  private stack = new Int32Array(N);

  /* ------------------------------------------------ generation */

  generate(stage: number) {
    this.solid.fill(0);
    this.col.fill(0);
    this.val.fill(0);
    this.flag.fill(0);
    this.occ.fill(0);
    this.guardSpawns.length = 0;
    this.rnd = mulberry32(stage * 92821 + 1337);
    this.theme = THEMES[(stage - 1) % THEMES.length];
    this.genTerrain();
    this.genProps(stage);

    let pt = 0;
    let mt = 0;
    let solidCount = 0;
    for (let i = 0; i < N; i++) {
      if (this.solid[i]) {
        solidCount++;
        if (this.flag[i] & F_PROP) pt++;
        if (this.flag[i] & F_MISSION) mt++;
      }
    }
    this.propTotal = Math.max(1, pt);
    this.propAlive = this.propTotal;
    this.missionTotal = Math.max(1, mt);
    this.missionAlive = this.missionTotal;
    this.buildMesh(solidCount);
  }

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rnd() * arr.length)];
  }

  private put(
    x: number,
    y: number,
    z: number,
    hex: number,
    v = 1,
    f = 0,
    jit = 0.09
  ) {
    if (!inb(x, y, z)) return;
    const i = idx(x, y, z);
    const k = 1 + (this.rnd() - 0.5) * 2 * jit;
    const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * k)));
    const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * k)));
    const b = Math.max(0, Math.min(255, Math.round((hex & 255) * k)));
    this.col[i] = (r << 16) | (g << 8) | b;
    this.solid[i] = 1;
    this.val[i] = v;
    this.flag[i] = f;
  }

  private genTerrain() {
    const th = this.theme;
    const cx = W / 2;
    const cz = D / 2;
    const R0 = 17.2;
    const p1 = this.rnd() * 6.28;
    const p2 = this.rnd() * 6.28;
    const p3 = this.rnd() * 6.28;
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const dx = x + 0.5 - cx;
        const dz = z + 0.5 - cz;
        const d = Math.pow(
          Math.pow(Math.abs(dx), 3) + Math.pow(Math.abs(dz), 3),
          1 / 3
        );
        const th2 = Math.atan2(dz, dx);
        const Rt =
          R0 +
          1.0 * Math.sin(2 * th2 + p1) +
          0.7 * Math.sin(3 * th2 + p2) +
          0.45 * Math.sin(5 * th2 + p3);
        const road = th.road && Math.abs(dz) < 2.1;
        for (let y = 0; y <= T; y++) {
          const ry = Rt - (T - y) * 0.95;
          if (d > ry) continue;
          if (y === T) {
            if (road) {
              const dash = Math.abs(dz) < 0.6 && (x % 4 < 2);
              this.put(x, y, z, dash ? 0xf5d35a : 0x586074, 1, 0, 0.05);
            } else if (this.rnd() < 0.05) {
              this.put(x, y, z, this.pick(th.flowers), 2);
            } else {
              this.put(x, y, z, this.pick(th.top), 1);
            }
          } else if (y >= T - 2) {
            if (this.rnd() < 0.015) this.put(x, y, z, 0xffd23f, 10, F_GLOW, 0.05);
            else this.put(x, y, z, this.pick(th.dirt), 1);
          } else if (y >= 1) {
            if (this.rnd() < 0.035) this.put(x, y, z, 0xffc61a, 14, F_GLOW, 0.05);
            else this.put(x, y, z, this.pick(th.stone), 1);
          } else {
            this.put(x, y, z, this.pick(th.stone), 1, F_BEDROCK);
          }
        }
      }
    }
  }

  private free(x0: number, z0: number, w: number, d: number): boolean {
    for (let x = x0 - 1; x < x0 + w + 1; x++) {
      for (let z = z0 - 1; z < z0 + d + 1; z++) {
        if (x < 0 || z < 0 || x >= W || z >= D) return false;
        if (!this.solid[idx(x, T, z)]) return false;
        if (this.occ[x + z * W]) return false;
      }
    }
    return true;
  }

  private mark(x0: number, z0: number, w: number, d: number) {
    for (let x = x0; x < x0 + w; x++)
      for (let z = z0; z < z0 + d; z++) this.occ[x + z * W] = 1;
  }

  private place(
    w: number,
    d: number,
    build: (x0: number, z0: number) => void,
    near = false
  ): boolean {
    for (let k = 0; k < 60; k++) {
      let x0: number;
      let z0: number;
      if (near && k < 30) {
        x0 = Math.round(W / 2 - w / 2 + (this.rnd() - 0.5) * 7);
        z0 = Math.round(D / 2 - d / 2 + (this.rnd() - 0.5) * 7);
      } else {
        x0 = Math.floor(2 + this.rnd() * (W - 4 - w));
        z0 = Math.floor(2 + this.rnd() * (D - 4 - d));
      }
      if (this.free(x0, z0, w, d)) {
        this.mark(x0, z0, w, d);
        build(x0, z0);
        return true;
      }
    }
    return false;
  }

  private genProps(stage: number) {
    const th = this.theme;
    const B = T + 1;
    const P = F_PROP;

    // road lane reserved so props don't block it
    if (th.road) {
      for (let x = 0; x < W; x++)
        for (let z = D / 2 - 3; z < D / 2 + 3; z++) this.occ[x + z * W] = 1;
    }

    const build: Record<string, [number, number, (x0: number, z0: number) => void]> = {
      palace: [
        15,
        15,
        (x0, z0) => {
          const gold = 0xffcf3f;
          const royal = 0x7138c7;
          const marble = 0xffe7b0;
          const window = 0x8ee5ff;
          // broad marble courtyard and a ceremonial path to the gate
          for (let x = 0; x < 15; x++)
            for (let z = 0; z < 15; z++) {
              if (z >= 9 || x === 7) this.put(x0 + x, B, z0 + z, (x + z) % 2 ? 0xeee3ce : 0xfff5df, 2, P, 0.025);
            }
          // central palace body, three storeys, arched-looking window rhythm
          for (let y = 0; y < 7; y++)
            for (let x = 2; x < 13; x++)
              for (let z = 1; z < 9; z++) {
                const shell = x === 2 || x === 12 || z === 1 || z === 8 || y === 0 || y === 6;
                if (!shell) continue;
                const gate = z === 8 && x >= 6 && x <= 8 && y <= 3;
                if (gate) continue;
                const win = y === 2 || y === 4;
                const windowSpot = win && (x % 3 === 1) && (z === 1 || z === 8);
                this.put(x0 + x, B + 1 + y, z0 + z, windowSpot ? window : marble, 5, windowSpot ? P | F_GLOW : P, 0.025);
              }
          // four corner towers
          for (const [tx, tz] of [[0, 0], [11, 0], [0, 6], [11, 6]]) {
            for (let y = 0; y < 10; y++)
              for (let x = 0; x < 4; x++)
                for (let z = 0; z < 4; z++) {
                  const edge = x === 0 || x === 3 || z === 0 || z === 3;
                  if (edge) this.put(x0 + tx + x, B + 1 + y, z0 + tz + z, y % 3 === 2 ? gold : marble, 5, P, 0.02);
                }
            for (let x = -1; x < 5; x++)
              for (let z = -1; z < 5; z++) this.put(x0 + tx + x, B + 11, z0 + tz + z, royal, 5, P, 0.025);
            for (let x = 0; x < 4; x++)
              for (let z = 0; z < 4; z++) this.put(x0 + tx + x, B + 12, z0 + tz + z, royal, 5, P, 0.025);
            this.put(x0 + tx + 1, B + 13, z0 + tz + 1, gold, 15, P | F_GLOW, 0.01);
            this.put(x0 + tx + 2, B + 13, z0 + tz + 2, gold, 15, P | F_GLOW, 0.01);
          }
          // stepped royal roof and golden crown
          for (let x = 3; x < 12; x++)
            for (let z = 1; z < 9; z++) this.put(x0 + x, B + 8, z0 + z, royal, 5, P, 0.02);
          for (let x = 4; x < 11; x++)
            for (let z = 2; z < 8; z++) this.put(x0 + x, B + 9, z0 + z, royal, 5, P, 0.02);
          for (let x = 5; x < 10; x++)
            for (let z = 3; z < 7; z++) this.put(x0 + x, B + 10, z0 + z, royal, 5, P, 0.02);
          this.put(x0 + 7, B + 11, z0 + 5, gold, 20, P | F_GLOW, 0.01);
          this.put(x0 + 7, B + 12, z0 + 5, gold, 20, P | F_GLOW, 0.01);
          // crenellated battlements along the front roofline
          for (let x = 2; x < 13; x++) {
            this.put(x0 + x, B + 8, z0 + 9, gold, 5, P, 0.02);
            if (x % 2 === 0) this.put(x0 + x, B + 9, z0 + 9, marble, 5, P, 0.02);
          }
          // balcony above the gate, with golden railing and supporting brackets
          for (let x = 5; x <= 9; x++) {
            this.put(x0 + x, B + 5, z0 + 9, 0xf5dfb3, 5, P, 0.02);
            if (x % 2 === 1) this.put(x0 + x, B + 6, z0 + 9, gold, 7, P, 0.015);
          }
          this.put(x0 + 5, B + 4, z0 + 9, marble, 5, P);
          this.put(x0 + 9, B + 4, z0 + 9, marble, 5, P);
          // deep gate, portcullis teeth and two hanging chains
          for (let y = 1; y <= 4; y++) {
            this.put(x0 + 5, B + y, z0 + 9, 0x665244, 4, P, 0.02);
            this.put(x0 + 9, B + y, z0 + 9, 0x665244, 4, P, 0.02);
          }
          for (const gx of [6, 7, 8]) {
            this.put(x0 + gx, B + 4, z0 + 8, 0x3c4658, 5, P, 0.01);
            if (gx !== 7) this.put(x0 + gx, B + 3, z0 + 8, 0x3c4658, 5, P, 0.01);
          }
          for (const gx of [5, 9])
            for (let y = 2; y <= 6; y += 2)
              this.put(x0 + gx, B + y, z0 + 10, 0xffcf3f, 6, P, 0.01);
          // shallow moat and a three-wide wooden drawbridge
          for (let x = 0; x < 15; x++)
            for (let z = 9; z <= 10; z++) {
              if (x >= 6 && x <= 8) this.put(x0 + x, B + 1, z0 + z, 0x9b6638, 3, P, 0.03);
              else this.put(x0 + x, B, z0 + z, (x + z) % 2 ? 0x3ba9d4 : 0x55c8ea, 3, P | F_GLOW, 0.02);
            }
          // stained-glass rose window over the balcony
          const glass = [0x45c8ff, 0xff5b8d, 0xffd23f, 0x8b5cf6];
          for (let x = 6; x <= 8; x++)
            for (let y = 6; y <= 7; y++)
              this.put(x0 + x, B + y, z0 + 9, glass[(x + y) % glass.length], 9, P | F_GLOW, 0.01);
          // heraldic banners flanking the central gate
          for (const bx of [3, 11]) {
            for (let y = 3; y <= 6; y++) this.put(x0 + bx, B + y, z0 + 9, royal, 5, P, 0.015);
            this.put(x0 + bx, B + 5, z0 + 10, gold, 8, P | F_GLOW, 0.01);
          }
          // knight statues on pedestals, guarding the bridge
          for (const sx of [3, 11]) {
            this.put(x0 + sx, B + 1, z0 + 11, 0xb8c1cf, 5, P);
            this.put(x0 + sx, B + 2, z0 + 11, 0xd5dce7, 6, P);
            this.put(x0 + sx, B + 3, z0 + 11, 0x909aaa, 6, P);
            this.put(x0 + sx + (sx < 7 ? 1 : -1), B + 2, z0 + 11, 0xb8c1cf, 5, P);
          }
          // tall flags above each corner tower
          for (const [fx, fz] of [[1, 1], [13, 1], [1, 8], [13, 8]]) {
            for (let y = 13; y <= 17; y++) this.put(x0 + fx, B + y, z0 + fz, 0x5b4633, 3, P, 0.01);
            for (let dx = 1; dx <= 3; dx++) {
              this.put(x0 + fx + (fx < 7 ? dx : -dx), B + 16, z0 + fz, royal, 5, P, 0.015);
              if (dx < 3) this.put(x0 + fx + (fx < 7 ? dx : -dx), B + 15, z0 + fz, gold, 5, P, 0.015);
            }
          }
          // garden hedges framing the guards
          for (let z = 10; z < 15; z++) {
            this.put(x0 + 1, B + 1, z0 + z, this.pick(th.leaf), 2, P);
            this.put(x0 + 13, B + 1, z0 + z, this.pick(th.leaf), 2, P);
          }
          // two rows of royal guards; these are physics actors, not destructible voxels
          const spots = [[4, 12], [7, 12], [10, 12], [2, 14], [5, 14], [9, 14], [12, 14]];
          spots.forEach(([gx, gz], i) => {
            this.guardSpawns.push({
              x: x0 + gx + 0.5 - OFF_X,
              y: B - OFF_Y,
              z: z0 + gz + 0.5 - OFF_Z,
              facing: 0,
              role: i % 3 === 1 || i === 5 ? "orc" : "knight",
            });
          });
        },
      ],
      fountainGarden: [
        5,
        5,
        (x0, z0) => {
          for (let x = 0; x < 5; x++)
            for (let z = 0; z < 5; z++) {
              const rim = x === 0 || x === 4 || z === 0 || z === 4;
              this.put(x0 + x, B, z0 + z, rim ? 0xf4e7cf : 0x48bfe3, 3, P, 0.02);
            }
          this.put(x0 + 2, B + 1, z0 + 2, 0xf4e7cf, 4, P);
          this.put(x0 + 2, B + 2, z0 + 2, 0x75dcff, 4, P | F_GLOW);
          this.put(x0 + 1, B + 1, z0 + 2, 0x75dcff, 3, P | F_GLOW);
          this.put(x0 + 3, B + 1, z0 + 2, 0x75dcff, 3, P | F_GLOW);
          this.put(x0 + 2, B + 1, z0 + 1, 0x75dcff, 3, P | F_GLOW);
          this.put(x0 + 2, B + 1, z0 + 3, 0x75dcff, 3, P | F_GLOW);
        },
      ],
      house: [
        5,
        5,
        (x0, z0) => {
          for (let y = 0; y < 3; y++)
            for (let x = 0; x < 5; x++)
              for (let z = 0; z < 5; z++) {
                const ring = x === 0 || x === 4 || z === 0 || z === 4;
                if (!ring) continue;
                if (x === 2 && z === 4 && y < 2) continue;
                const win =
                  y === 1 &&
                  (((x === 0 || x === 4) && z === 2) ||
                    (z === 0 && (x === 1 || x === 3)));
                this.put(x0 + x, B + y, z0 + z, win ? 0x9fd8ff : th.wall, 3, P);
              }
          for (let x = 0; x < 5; x++)
            for (let z = 0; z < 5; z++) this.put(x0 + x, B + 3, z0 + z, th.roof, 3, P);
          for (let x = 1; x < 4; x++)
            for (let z = 1; z < 4; z++) this.put(x0 + x, B + 4, z0 + z, th.roof, 3, P);
          this.put(x0 + 2, B + 5, z0 + 2, th.roof, 3, P);
        },
      ],
      tree: [
        5,
        5,
        (x0, z0) => {
          const h = 3 + Math.floor(this.rnd() * 2);
          for (let y = 0; y < h; y++) this.put(x0 + 2, B + y, z0 + 2, 0x7a4a2a, 2, P);
          const radii = [2.3, 2.6, 1.9, 1.1];
          for (let l = 0; l < radii.length; l++) {
            const r = radii[l];
            for (let dx = -2; dx <= 2; dx++)
              for (let dz = -2; dz <= 2; dz++) {
                if (dx * dx + dz * dz > r * r) continue;
                if (l === 0 && dx === 0 && dz === 0) continue;
                if (this.rnd() < 0.07) continue;
                this.put(x0 + 2 + dx, B + h - 1 + l, z0 + 2 + dz, this.pick(th.leaf), 2, P);
              }
          }
        },
      ],
      pine: [
        5,
        5,
        (x0, z0) => {
          this.put(x0 + 2, B, z0 + 2, 0x6b4426, 2, P);
          this.put(x0 + 2, B + 1, z0 + 2, 0x6b4426, 2, P);
          const radii = [2.4, 1.6, 2.0, 1.2, 1.5, 0.8, 0.4];
          for (let l = 0; l < radii.length; l++) {
            const r = radii[l];
            for (let dx = -2; dx <= 2; dx++)
              for (let dz = -2; dz <= 2; dz++) {
                if (dx * dx + dz * dz > r * r + 0.2) continue;
                const snow = l >= radii.length - 2 || (l % 2 === 1 && this.rnd() < 0.4);
                this.put(
                  x0 + 2 + dx,
                  B + 2 + l,
                  z0 + 2 + dz,
                  snow ? 0xf4f9ff : this.pick(th.leaf),
                  2,
                  P
                );
              }
          }
        },
      ],
      tower: [
        3,
        3,
        (x0, z0) => {
          const h = 7 + Math.floor(this.rnd() * 4);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < 3; x++)
              for (let z = 0; z < 3; z++) {
                if (y === h - 1 && (x + z) % 2 === 1) continue;
                this.put(
                  x0 + x,
                  B + y,
                  z0 + z,
                  th.brick[(x + z + y) % th.brick.length],
                  3,
                  P,
                  0.07
                );
              }
        },
      ],
      cans: [
        4,
        4,
        (x0, z0) => {
          const cols = [0xe63946, 0x2a9df4, 0xdfe6ee, 0xffd23f, 0x2ecc71];
          for (let l = 0; l < 4; l++) {
            const s = 4 - l;
            const off = Math.ceil(l / 2);
            for (let x = 0; x < s; x++)
              for (let z = 0; z < s; z++) {
                this.put(
                  x0 + x + off,
                  B + l,
                  z0 + z + off,
                  this.pick(cols),
                  4,
                  P,
                  0.04
                );
              }
          }
        },
      ],
      crates: [
        3,
        2,
        (x0, z0) => {
          for (let y = 0; y < 2; y++)
            for (let x = 0; x < 2; x++)
              for (let z = 0; z < 2; z++)
                this.put(
                  x0 + x,
                  B + y,
                  z0 + z,
                  (x + y + z) % 2 ? 0xc98b4a : 0xb67a3c,
                  3,
                  P
                );
          this.put(x0 + 2, B, z0, 0xc98b4a, 3, P);
          this.put(x0 + 2, B, z0 + 1, 0xb67a3c, 3, P);
          this.put(x0, B + 2, z0, 0xd29a58, 3, P);
        },
      ],
      barrels: [
        2,
        2,
        (x0, z0) => {
          const cells = [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ];
          cells.splice(Math.floor(this.rnd() * 4), 1);
          for (const [dx, dz] of cells) {
            this.put(x0 + dx, B, z0 + dz, 0xe03a2f, 6, P | F_EXPLOSIVE, 0.05);
            this.put(x0 + dx, B + 1, z0 + dz, 0xffb703, 6, P | F_EXPLOSIVE, 0.05);
          }
        },
      ],
      melon: [
        3,
        3,
        (x0, z0) => {
          for (let x = 0; x < 3; x++)
            for (let z = 0; z < 3; z++) {
              const edge = x !== 1 || z !== 1;
              this.put(x0 + x, B, z0 + z, (x + z) % 2 ? 0x2e9e3a : 0x1f7a2c, 8, P, 0.05);
              if (edge && !((x === 0 || x === 2) && (z === 0 || z === 2)))
                this.put(x0 + x, B + 1, z0 + z, 0x2e9e3a, 8, P, 0.05);
              else if (!edge) this.put(x0 + x, B + 1, z0 + z, 0xff4d5e, 12, P, 0.05);
            }
        },
      ],
      cactus: [
        3,
        3,
        (x0, z0) => {
          const g = th.leaf[0];
          for (let y = 0; y < 4; y++) this.put(x0 + 1, B + y, z0 + 1, g, 2, P);
          this.put(x0, B + 1, z0 + 1, g, 2, P);
          this.put(x0, B + 2, z0 + 1, g, 2, P);
          this.put(x0 + 2, B + 2, z0 + 1, g, 2, P);
          this.put(x0 + 2, B + 3, z0 + 1, g, 2, P);
          this.put(x0 + 1, B + 4, z0 + 1, 0xff6fa5, 6, P);
        },
      ],
      pyramid: [
        9,
        9,
        (x0, z0) => {
          const cols = th.brick;
          for (let t = 0; t < 5; t++) {
            const s = 9 - 2 * t;
            for (let h = 0; h < 2; h++)
              for (let x = 0; x < s; x++)
                for (let z = 0; z < s; z++) {
                  const gold = t === 4 && h === 1;
                  const door = t === 0 && x + t === 4 && z + t === 8 && h < 2;
                  this.put(
                    x0 + t + x,
                    B + t * 2 + h,
                    z0 + t + z,
                    gold ? 0xffcf33 : door ? 0x3b2f1f : cols[(x + z + h) % cols.length],
                    gold ? 30 : 3,
                    gold ? P | F_GLOW : P,
                    gold ? 0.03 : 0.07
                  );
                }
          }
        },
      ],
      monas: [
        7,
        7,
        (x0, z0) => {
          for (let x = 0; x < 7; x++)
            for (let z = 0; z < 7; z++) this.put(x0 + x, B, z0 + z, 0xe9e6dc, 3, P, 0.04);
          for (let x = 1; x < 6; x++)
            for (let z = 1; z < 6; z++) this.put(x0 + x, B + 1, z0 + z, 0xd9d5c9, 3, P, 0.04);
          for (let y = 2; y < 4; y++)
            for (let x = 2; x < 5; x++)
              for (let z = 2; z < 5; z++) this.put(x0 + x, B + y, z0 + z, 0xf4f1e8, 3, P, 0.04);
          for (let y = 4; y < 11; y++) {
            if (y === 7) {
              for (let x = 2; x < 5; x++)
                for (let z = 2; z < 5; z++) this.put(x0 + x, B + y, z0 + z, 0xb8b4a8, 4, P, 0.04);
            } else this.put(x0 + 3, B + y, z0 + 3, 0xf7f5ee, 3, P, 0.04);
          }
          this.put(x0 + 3, B + 11, z0 + 3, 0xffc61a, 30, P | F_GLOW, 0.03);
          this.put(x0 + 3, B + 12, z0 + 3, 0xffc61a, 30, P | F_GLOW, 0.03);
          this.put(x0 + 3, B + 13, z0 + 3, 0xff7a1a, 40, P | F_GLOW, 0.03);
        },
      ],
      snowman: [
        5,
        5,
        (x0, z0) => {
          const cx = x0 + 2;
          const cz = z0 + 2;
          const ball = (by: number, r: number) => {
            const R = Math.ceil(r);
            for (let dx = -R; dx <= R; dx++)
              for (let dy = -R; dy <= R; dy++)
                for (let dz = -R; dz <= R; dz++) {
                  if (dx * dx + dy * dy + dz * dz > r * r) continue;
                  if (by + dy < B) continue;
                  this.put(cx + dx, by + dy, cz + dz, 0xf4f9ff, 4, P, 0.04);
                }
          };
          ball(B + 1, 2.2);
          ball(B + 4, 1.7);
          ball(B + 6, 1.4);
          // face
          this.put(cx - 1, B + 6, cz + 1, 0x222222, 6, P, 0.02);
          this.put(cx + 1, B + 6, cz + 1, 0x222222, 6, P, 0.02);
          this.put(cx, B + 6, cz + 2, 0xff7a1a, 8, P, 0.02);
          // buttons
          this.put(cx, B + 4, cz + 2, 0x222222, 6, P, 0.02);
          this.put(cx, B + 3, cz + 2, 0x222222, 6, P, 0.02);
          // hat
          for (let dx = -1; dx <= 1; dx++)
            for (let dz = -1; dz <= 1; dz++) this.put(cx + dx, B + 8, cz + dz, 0x2b2b35, 6, P, 0.03);
          this.put(cx, B + 9, cz, 0xe63946, 6, P, 0.03);
          this.put(cx, B + 10, cz, 0x2b2b35, 6, P, 0.03);
        },
      ],
      snowcastle: [
        11,
        11,
        (x0, z0) => {
          const ice = 0xc9edff;
          const snow = 0xf7fbff;
          const blue = 0x78b9ef;
          // main keep with a dark arched gate and glowing ice windows
          for (let y = 0; y < 7; y++)
            for (let x = 2; x < 9; x++)
              for (let z = 2; z < 9; z++) {
                const shell = x === 2 || x === 8 || z === 2 || z === 8 || y === 0 || y === 6;
                if (!shell) continue;
                const gate = z === 8 && x >= 4 && x <= 6 && y < 4;
                if (gate) continue;
                const win = y === 3 && (x === 3 || x === 7) && (z === 2 || z === 8);
                this.put(x0 + x, B + y, z0 + z, win ? 0x72d9ff : (x + y + z) % 3 ? ice : snow, win ? 9 : 4, win ? P | F_GLOW : P, 0.02);
              }
          // four round-ish corner towers and icy battlements
          for (const [tx, tz] of [[0, 0], [7, 0], [0, 7], [7, 7]]) {
            for (let y = 0; y < 9; y++)
              for (let x = 0; x < 4; x++)
                for (let z = 0; z < 4; z++) {
                  if ((x === 0 || x === 3 || z === 0 || z === 3) && !((x === 0 || x === 3) && (z === 0 || z === 3)))
                    this.put(x0 + tx + x, B + y, z0 + tz + z, y % 3 === 2 ? blue : ice, 4, P, 0.02);
                }
            for (let x = 0; x < 4; x++)
              for (let z = 0; z < 4; z++)
                if ((x + z) % 2 === 0) this.put(x0 + tx + x, B + 9, z0 + tz + z, snow, 5, P);
          }
          // frozen throne crown
          for (let x = 3; x < 8; x++)
            for (let z = 3; z < 8; z++) this.put(x0 + x, B + 7, z0 + z, blue, 5, P, 0.02);
          this.put(x0 + 5, B + 8, z0 + 5, 0xa6f3ff, 18, P | F_GLOW, 0.01);
          this.put(x0 + 5, B + 9, z0 + 5, 0xe9fcff, 20, P | F_GLOW, 0.01);
          // frozen moat and bridge
          for (let x = 1; x < 10; x++) {
            this.put(x0 + x, B, z0 + 10, x >= 4 && x <= 6 ? 0xe7e1d2 : 0x8adcf3, 3, P | F_GLOW, 0.015);
          }
        },
      ],
      sky: [
        4,
        4,
        (x0, z0) => {
          const h = 11 + Math.floor(this.rnd() * 6);
          for (let y = 0; y < h; y++)
            for (let x = 0; x < 4; x++)
              for (let z = 0; z < 4; z++) {
                const corner = (x === 0 || x === 3) && (z === 0 || z === 3);
                const win = !corner && y % 2 === 1;
                const lit = this.rnd() < 0.5;
                this.put(
                  x0 + x,
                  B + y,
                  z0 + z,
                  win ? (lit ? 0xffe27a : 0x7fd0ff) : th.wall,
                  3,
                  win && lit ? P | F_GLOW : P,
                  0.05
                );
              }
          for (let x = 0; x < 4; x++)
            for (let z = 0; z < 4; z++) this.put(x0 + x, B + h, z0 + z, th.roof, 4, P);
          for (let y = 1; y <= 3; y++) this.put(x0 + 1, B + h + y, z0 + 1, y === 3 ? 0xff3b3b : 0xc7ccd6, 6, P);
        },
      ],
      ball: [
        3,
        3,
        (x0, z0) => {
          const C = [0xff4d6d, 0xffd23f, 0x38bdf8, 0x4ade80, 0xc77dff];
          const F = P | F_BOUNCY;
          // faceted beach ball: every voxel becomes a colourful rubber chunk
          for (let y = 0; y < 3; y++)
            for (let x = 0; x < 3; x++)
              for (let z = 0; z < 3; z++) {
                const corners = (x !== 1 ? 1 : 0) + (y !== 1 ? 1 : 0) + (z !== 1 ? 1 : 0);
                if (corners === 3) continue;
                this.put(x0 + x, B + y, z0 + z, C[(x + y * 2 + z * 3) % C.length], 5, F, 0.03);
              }
        },
      ],
      tires: [
        4,
        3,
        (x0, z0) => {
          const F = P | F_BOUNCY;
          for (let t = 0; t < 3; t++) {
            const ox = t === 2 ? 1 : t * 2;
            const oy = t === 2 ? 2 : 0;
            for (let y = 0; y < 2; y++)
              for (let z = 0; z < 3; z++) {
                if (y === 0 && z === 1) continue; // square voxel hole
                this.put(x0 + ox, B + oy + y, z0 + z, (y + z) % 2 ? 0x24242c : 0x383844, 4, F, 0.025);
              }
          }
        },
      ],
      slime: [
        3,
        3,
        (x0, z0) => {
          const F = P | F_BOUNCY;
          const col = this.pick([0x62e86f, 0x55dffc, 0xff6fb2, 0xb67aff]);
          for (let y = 0; y < 2; y++)
            for (let x = 0; x < 3; x++)
              for (let z = 0; z < 3; z++) this.put(x0 + x, B + y, z0 + z, col, 5, F, 0.025);
          this.put(x0 + 1, B + 2, z0 + 1, col, 5, F, 0.025);
          this.put(x0, B + 1, z0 + 2, 0xffffff, 7, F, 0.01);
          this.put(x0 + 2, B + 1, z0 + 2, 0xffffff, 7, F, 0.01);
          this.put(x0, B + 1, z0 + 2, 0x172033, 7, F, 0.01);
        },
      ],
      snowball: [
        3,
        3,
        (x0, z0) => {
          const F = P | F_BOUNCY;
          for (let y = 0; y < 3; y++)
            for (let x = 0; x < 3; x++)
              for (let z = 0; z < 3; z++) {
                const corners = (x !== 1 ? 1 : 0) + (y !== 1 ? 1 : 0) + (z !== 1 ? 1 : 0);
                if (corners === 3) continue;
                this.put(x0 + x, B + y, z0 + z, (x + z) % 2 ? 0xffffff : 0xd9efff, 4, F, 0.02);
              }
        },
      ],
      trampoline: [
        5,
        5,
        (x0, z0) => {
          const F = P | F_BOUNCY;
          for (let x = 0; x < 5; x++)
            for (let z = 0; z < 5; z++) {
              const rim = x === 0 || x === 4 || z === 0 || z === 4;
              this.put(x0 + x, B + 1, z0 + z, rim ? 0xf43f5e : 0x263d79, 4, F, 0.02);
            }
          for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]])
            this.put(x0 + x, B, z0 + z, 0x334155, 3, P, 0.02);
        },
      ],
      palm: [
        5,
        5,
        (x0, z0) => {
          for (let y = 0; y < 6; y++) this.put(x0 + 2 + (y > 3 ? 1 : 0), B + y, z0 + 2, 0xa46a32, 3, P);
          const cx = x0 + 3;
          for (let a = 0; a < 4; a++) {
            const dx = a < 2 ? (a ? -1 : 1) : 0;
            const dz = a >= 2 ? (a === 2 ? 1 : -1) : 0;
            for (let k = 1; k <= 3; k++)
              this.put(cx + dx * k, B + 6 - Math.floor(k / 3), z0 + 2 + dz * k, this.pick(th.leaf), 2, P);
          }
          this.put(cx - 1, B + 5, z0 + 2, 0x7a4a20, 6, P);
          this.put(cx + 1, B + 5, z0 + 2, 0x7a4a20, 6, P);
        },
      ],
      umbrella: [
        5,
        5,
        (x0, z0) => {
          for (let y = 0; y < 4; y++) this.put(x0 + 2, B + y, z0 + 2, 0xf2f2e8, 2, P);
          const cols = [0xff4d6d, 0xffd23f, 0x38bdf8, 0xffffff];
          for (let x = 0; x < 5; x++)
            for (let z = 0; z < 5; z++) {
              const edge = x === 0 || x === 4 || z === 0 || z === 4;
              if (edge && (x === 0 || x === 4) && (z === 0 || z === 4)) continue;
              this.put(x0 + x, B + 4 + (edge ? 0 : 1), z0 + z, cols[(x + z) % cols.length], 3, P, 0.025);
            }
        },
      ],
      lighthouse: [
        7,
        7,
        (x0, z0) => {
          for (let y = 0; y < 11; y++) {
            const r = y < 3 ? 2 : 1;
            for (let x = 3 - r; x <= 3 + r; x++)
              for (let z = 3 - r; z <= 3 + r; z++) {
                const stripe = Math.floor(y / 2) % 2 === 0;
                this.put(x0 + x, B + y, z0 + z, stripe ? 0xffffff : 0xef4444, 4, P, 0.025);
              }
          }
          for (let x = 1; x < 6; x++)
            for (let z = 1; z < 6; z++) this.put(x0 + x, B + 11, z0 + z, 0x1f2937, 5, P);
          for (let x = 2; x < 5; x++)
            for (let z = 2; z < 5; z++) this.put(x0 + x, B + 12, z0 + z, 0xfff1a8, 12, P | F_GLOW, 0.01);
          this.put(x0 + 3, B + 13, z0 + 3, 0xef4444, 6, P);
        },
      ],
      windmill: [
        7,
        7,
        (x0, z0) => {
          for (let y = 0; y < 7; y++)
            for (let x = 2; x < 5; x++)
              for (let z = 2; z < 5; z++) this.put(x0 + x, B + y, z0 + z, y % 2 ? 0xffe1a6 : 0xf4c77d, 4, P);
          this.put(x0 + 3, B + 7, z0 + 4, 0x6b4a2d, 5, P);
          for (let k = -3; k <= 3; k++) {
            this.put(x0 + 3 + k, B + 7, z0 + 5, k % 2 ? 0xffffff : 0xe84c8b, 4, P);
            this.put(x0 + 3, B + 7 + k, z0 + 5, k % 2 ? 0xffffff : 0x56bddd, 4, P);
          }
        },
      ],
    };

    // landmark
    const lm = build[th.landmark];
    this.place(lm[0], lm[1], lm[2], true);
    // The landmark is placed before every filler prop, so every current prop is
    // guaranteed to belong to the mission building.
    for (let i = 0; i < N; i++) {
      if (this.solid[i] && this.flag[i] & F_PROP) this.flag[i] |= F_MISSION;
    }

    // roads: cars
    if (th.road) {
      const carCols = [0xe63946, 0x2a9df4, 0xffd23f, 0x2ecc71, 0xffffff, 0xff8fab];
      const cz0 = D / 2 - 2;
      let lastX = 3;
      for (let k = 0; k < 3 + Math.min(2, Math.floor(stage / 3)); k++) {
        const x0 = lastX + Math.floor(this.rnd() * 3) + 2;
        lastX = x0 + 4;
        if (x0 + 4 >= W - 2) break;
        const lane = this.rnd() < 0.5 ? 0 : 2;
        const color = this.pick(carCols);
        for (let x = 0; x < 4; x++)
          for (let z = 0; z < 2; z++) {
            const gx = x0 + x;
            const gz = cz0 + lane + z;
            if (!this.solid[idx(gx, T, gz)]) continue;
            this.put(gx, B, gz, x === 0 || x === 3 ? 0x2b2b33 : color, 4, P, 0.04);
            this.put(gx, B + 1, gz, x === 1 || x === 2 ? 0x9bd6ff : color, 4, P, 0.04);
            if (x === 1 || x === 2) this.put(gx, B + 2, gz, color, 4, P, 0.04);
          }
      }
    }

    // barrels (explosive chain!) guaranteed
    const barrelCount = 3 + Math.min(3, Math.floor(stage / 4));
    for (let i = 0; i < barrelCount; i++) this.place(build.barrels[0], build.barrels[1], build.barrels[2]);

    // others
    const total = 12 + Math.min(8, Math.floor(stage / 2));
    for (let i = 0; i < total; i++) {
      const id = this.pick(th.fill);
      const b = build[id];
      this.place(b[0], b[1], b[2]);
    }
  }

  /* ------------------------------------------------ mesh management */

  private buildMesh(solidCount: number) {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.dispose();
      this.mesh = null;
    }
    this.cap = solidCount + 16;
    this.cellOfInst = new Int32Array(this.cap);
    this.instOfCell.fill(-1);
    const mesh = new THREE.InstancedMesh(this.geo, this.mat, this.cap);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.cap * 3), 3);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mesh = mesh;
    this.group.add(mesh);
    this.count = 0;
    for (let y = 0; y < H; y++)
      for (let z = 0; z < D; z++)
        for (let x = 0; x < W; x++) {
          const i = idx(x, y, z);
          if (this.solid[i] && this.exposed(x, y, z)) this.addInst(i);
        }
    this.dirty = true;
    this.flush();
  }

  private exposed(x: number, y: number, z: number): boolean {
    if (x === 0 || x === W - 1 || z === 0 || z === D - 1 || y === 0 || y === H - 1) return true;
    const i = idx(x, y, z);
    return (
      !this.solid[i - 1] ||
      !this.solid[i + 1] ||
      !this.solid[i - W] ||
      !this.solid[i + W] ||
      !this.solid[i - W * D] ||
      !this.solid[i + W * D]
    );
  }

  private writeInst(i: number, c: number) {
    const m = this.mesh!;
    const x = c % W;
    const z = Math.floor(c / W) % D;
    const y = Math.floor(c / (W * D));
    const a = m.instanceMatrix.array as Float32Array;
    const o = i * 16;
    a[o] = 1;
    a[o + 1] = 0;
    a[o + 2] = 0;
    a[o + 3] = 0;
    a[o + 4] = 0;
    a[o + 5] = 1;
    a[o + 6] = 0;
    a[o + 7] = 0;
    a[o + 8] = 0;
    a[o + 9] = 0;
    a[o + 10] = 1;
    a[o + 11] = 0;
    a[o + 12] = x + 0.5 - OFF_X;
    a[o + 13] = y + 0.5 - OFF_Y;
    a[o + 14] = z + 0.5 - OFF_Z;
    a[o + 15] = 1;
    this.tmpC.setHex(this.col[c]);
    // self-lit voxels (ore, windows, flames) are pushed into HDR at night so they bloom
    const glow = this.night && this.flag[c] & F_GLOW ? 2.3 : 1;
    const sh = this.shade(x, y, z) * glow;
    const ca = m.instanceColor!.array as Float32Array;
    ca[i * 3] = this.tmpC.r * sh;
    ca[i * 3 + 1] = this.tmpC.g * sh;
    ca[i * 3 + 2] = this.tmpC.b * sh;
  }

  /** soft baked ambient-occlusion + depth tint (never goes dark) */
  private shade(x: number, y: number, z: number): number {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (let dz = -1; dz <= 1; dz++) {
        const zz = z + dz;
        if (zz < 0 || zz >= D) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy && !dz) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          if (this.solid[idx(xx, yy, zz)]) n++;
        }
      }
    }
    const ao = Math.max(0.88, Math.min(1.1, 1 + (0.62 - n / 26) * 0.45));
    const depth = 0.9 + 0.1 * Math.min(1, y / T);
    return ao * depth;
  }

  private addInst(c: number) {
    if (this.count >= this.cap) return;
    const i = this.count++;
    this.instOfCell[c] = i;
    this.cellOfInst[i] = c;
    this.writeInst(i, c);
    this.dirty = true;
  }

  private removeInst(c: number) {
    const i = this.instOfCell[c];
    if (i < 0) return;
    const last = --this.count;
    if (i !== last) {
      const m = this.mesh!;
      const a = m.instanceMatrix.array as Float32Array;
      const ca = m.instanceColor!.array as Float32Array;
      for (let k = 0; k < 16; k++) a[i * 16 + k] = a[last * 16 + k];
      for (let k = 0; k < 3; k++) ca[i * 3 + k] = ca[last * 3 + k];
      const lc = this.cellOfInst[last];
      this.cellOfInst[i] = lc;
      this.instOfCell[lc] = i;
    }
    this.instOfCell[c] = -1;
    this.dirty = true;
  }

  flush() {
    if (!this.dirty || !this.mesh) return;
    const m = this.mesh;
    m.count = this.count;
    m.instanceMatrix.clearUpdateRanges();
    m.instanceMatrix.addUpdateRange(0, Math.max(1, this.count) * 16);
    m.instanceMatrix.needsUpdate = true;
    const ic = m.instanceColor!;
    ic.clearUpdateRanges();
    ic.addUpdateRange(0, Math.max(1, this.count) * 3);
    ic.needsUpdate = true;
    this.dirty = false;
  }

  /* ------------------------------------------------ queries */

  solidAt(x: number, y: number, z: number): boolean {
    return inb(x, y, z) && this.solid[idx(x, y, z)] === 1;
  }

  /** highest solid y at column or -1 */
  topY(x: number, z: number): number {
    if (x < 0 || z < 0 || x >= W || z >= D) return -1;
    for (let y = H - 1; y >= 0; y--) if (this.solid[idx(x, y, z)]) return y;
    return -1;
  }

  /** world-space ray (group offset ignored) */
  raycast(o: THREE.Vector3, d: THREE.Vector3): RayHit | null {
    const ox = o.x + OFF_X;
    const oy = o.y + OFF_Y;
    const oz = o.z + OFF_Z;
    const dx = d.x;
    const dy = d.y;
    const dz = d.z;
    let tmin = 0;
    let tmax = 1e9;
    const o3 = [ox, oy, oz];
    const d3 = [dx, dy, dz];
    const s3 = [W, H, D];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d3[a]) < 1e-8) {
        if (o3[a] < 0 || o3[a] > s3[a]) return null;
      } else {
        let t1 = (0 - o3[a]) / d3[a];
        let t2 = (s3[a] - o3[a]) / d3[a];
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    const t0 = tmin + 1e-4;
    const px = ox + dx * t0;
    const py = oy + dy * t0;
    const pz = oz + dz * t0;
    let ix = Math.min(W - 1, Math.max(0, Math.floor(px)));
    let iy = Math.min(H - 1, Math.max(0, Math.floor(py)));
    let iz = Math.min(D - 1, Math.max(0, Math.floor(pz)));
    const sx = dx > 0 ? 1 : -1;
    const sy = dy > 0 ? 1 : -1;
    const sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) < 1e-8 ? 1e9 : Math.abs(1 / dx);
    const tdy = Math.abs(dy) < 1e-8 ? 1e9 : Math.abs(1 / dy);
    const tdz = Math.abs(dz) < 1e-8 ? 1e9 : Math.abs(1 / dz);
    let tx = Math.abs(dx) < 1e-8 ? 1e9 : ((dx > 0 ? ix + 1 - px : px - ix) * tdx);
    let ty = Math.abs(dy) < 1e-8 ? 1e9 : ((dy > 0 ? iy + 1 - py : py - iy) * tdy);
    let tz = Math.abs(dz) < 1e-8 ? 1e9 : ((dz > 0 ? iz + 1 - pz : pz - iz) * tdz);
    let nx = 0;
    let ny = 1;
    let nz = 0;
    for (let s = 0; s < W + H + D + 8; s++) {
      if (this.solid[idx(ix, iy, iz)]) {
        return { x: ix, y: iy, z: iz, nx, ny, nz };
      }
      if (tx < ty && tx < tz) {
        ix += sx;
        tx += tdx;
        nx = -sx;
        ny = 0;
        nz = 0;
      } else if (ty < tz) {
        iy += sy;
        ty += tdy;
        nx = 0;
        ny = -sy;
        nz = 0;
      } else {
        iz += sz;
        tz += tdz;
        nx = 0;
        ny = 0;
        nz = -sz;
      }
      if (!inb(ix, iy, iz)) return null;
    }
    return null;
  }

  /* ------------------------------------------------ destruction */

  /** center in world space. Fills `out` with removed cells. */
  carve(cx: number, cy: number, cz: number, R: number, seed: number, out: Carved) {
    const gx = cx + OFF_X;
    const gy = cy + OFF_Y;
    const gz = cz + OFF_Z;
    const x0 = Math.max(0, Math.floor(gx - R - 1));
    const x1 = Math.min(W - 1, Math.ceil(gx + R + 1));
    const y0 = Math.max(1, Math.floor(gy - R - 1));
    const y1 = Math.min(H - 1, Math.ceil(gy + R + 1));
    const z0 = Math.max(0, Math.floor(gz - R - 1));
    const z1 = Math.min(D - 1, Math.ceil(gz + R + 1));
    out.n = 0;
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const i = idx(x, y, z);
          if (!this.solid[i] || this.flag[i] & F_BEDROCK) continue;
          const dx = x + 0.5 - gx;
          const dy = y + 0.5 - gy;
          const dz = z + 0.5 - gz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > (R + 1.2) * (R + 1.2)) continue;
          const h =
            ((Math.imul(x + seed, 73856093) ^
              Math.imul(y * 7 + seed, 19349663) ^
              Math.imul(z + seed * 3, 83492791)) >>>
              0) %
            1000;
          const thr = R * (0.82 + 0.36 * (h / 1000));
          if (d2 > thr * thr) continue;
          out.cells[out.n++] = i;
        }
    this.removeCells(out);
  }

  /** switch day/night: re-bake every visible voxel colour */
  setNight(night: boolean) {
    if (this.night === night) return;
    this.night = night;
    if (!this.mesh) return;
    for (let i = 0; i < this.count; i++) this.writeInst(i, this.cellOfInst[i]);
    this.dirty = true;
  }

  /* ---- destruction helpers ---- */

  /** remove all cells listed in out.cells[0..n) and fill stats */
  removeCells(out: Carved) {
    out.coins = 0;
    out.props = 0;
    out.exCount = 0;
    out.exX = 0;
    out.exY = 0;
    out.exZ = 0;
    for (let k = 0; k < out.n; k++) {
      const c = out.cells[k];
      out.coins += this.val[c];
      const f = this.flag[c];
      if (f & F_PROP) {
        out.props++;
        this.propAlive--;
      }
      if (f & F_MISSION) this.missionAlive--;
      if (f & F_EXPLOSIVE) {
        out.exCount++;
        out.exX += (c % W) + 0.5 - OFF_X;
        out.exY += Math.floor(c / (W * D)) + 0.5 - OFF_Y;
        out.exZ += (Math.floor(c / W) % D) + 0.5 - OFF_Z;
      }
      this.solid[c] = 0;
      this.removeInst(c);
    }
    if (out.exCount > 0) {
      out.exX /= out.exCount;
      out.exY /= out.exCount;
      out.exZ /= out.exCount;
    }
    // expose neighbours
    for (let k = 0; k < out.n; k++) {
      const c = out.cells[k];
      const x = c % W;
      const z = Math.floor(c / W) % D;
      const y = Math.floor(c / (W * D));
      this.tryExpose(x - 1, y, z);
      this.tryExpose(x + 1, y, z);
      this.tryExpose(x, y - 1, z);
      this.tryExpose(x, y + 1, z);
      this.tryExpose(x, y, z - 1);
      this.tryExpose(x, y, z + 1);
    }
    if (this.propAlive < 0) this.propAlive = 0;
    if (this.missionAlive < 0) this.missionAlive = 0;
  }

  private tryExpose(x: number, y: number, z: number) {
    if (!inb(x, y, z)) return;
    const i = idx(x, y, z);
    if (this.solid[i] && this.instOfCell[i] < 0) this.addInst(i);
  }

  /** cells not connected to bedrock */
  findUnsupported(out: Carved) {
    const vis = this.visited;
    vis.fill(0);
    const st = this.stack;
    let sp = 0;
    const layer = W * D;
    for (let i = 0; i < layer; i++) {
      if (this.solid[i]) {
        vis[i] = 1;
        st[sp++] = i;
      }
    }
    while (sp > 0) {
      const c = st[--sp];
      const x = c % W;
      const z = Math.floor(c / W) % D;
      const y = Math.floor(c / layer);
      if (x > 0 && this.solid[c - 1] && !vis[c - 1]) {
        vis[c - 1] = 1;
        st[sp++] = c - 1;
      }
      if (x < W - 1 && this.solid[c + 1] && !vis[c + 1]) {
        vis[c + 1] = 1;
        st[sp++] = c + 1;
      }
      if (z > 0 && this.solid[c - W] && !vis[c - W]) {
        vis[c - W] = 1;
        st[sp++] = c - W;
      }
      if (z < D - 1 && this.solid[c + W] && !vis[c + W]) {
        vis[c + W] = 1;
        st[sp++] = c + W;
      }
      if (y > 0 && this.solid[c - layer] && !vis[c - layer]) {
        vis[c - layer] = 1;
        st[sp++] = c - layer;
      }
      if (y < H - 1 && this.solid[c + layer] && !vis[c + layer]) {
        vis[c + layer] = 1;
        st[sp++] = c + layer;
      }
    }
    out.n = 0;
    for (let i = layer; i < N; i++) {
      if (this.solid[i] && !vis[i]) out.cells[out.n++] = i;
    }
  }

  collectProps(out: Carved) {
    out.n = 0;
    for (let i = 0; i < N; i++) {
      if (this.solid[i] && this.flag[i] & F_PROP) out.cells[out.n++] = i;
    }
  }

  cellWorld(c: number, out: THREE.Vector3) {
    out.set(
      (c % W) + 0.5 - OFF_X,
      Math.floor(c / (W * D)) + 0.5 - OFF_Y,
      (Math.floor(c / W) % D) + 0.5 - OFF_Z
    );
  }
}
