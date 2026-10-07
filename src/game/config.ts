export type FireKind =
  | "single"
  | "string"
  | "rocket"
  | "nuke"
  | "top"
  | "fountain"
  | "hopper"
  | "storm"
  | "hole"
  | "orbit"
  | "dragon"
  | "disco"
  | "drill"
  | "gorilla"
  | "ants";

export type ModelId =
  | "cabe"
  | "kertas"
  | "bambu"
  | "tnt"
  | "rocket"
  | "nuke"
  | "gasing"
  | "fountain"
  | "kodok"
  | "petir"
  | "lubang"
  | "ufo"
  | "naga"
  | "disco"
  | "drill"
  | "gorilla"
  | "ants";

export interface FireType {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: number;
  radius: number; // blast radius (voxels) at level 1
  radiusMax: number; // blast radius at level 10
  maxScale: number; // visual size multiplier at level 10 (1x at level 1)
  fuse: number; // seconds of burning fuse before it goes off / ignites
  kind: FireKind;
  value: number; // coin multiplier per voxel
  count: number; // string length / comet count / hops / lightning bolts
  power: number; // shake & sound strength 0..1+
  model: ModelId;
  accent: string; // css color
  dur?: number; // active time for gasing / air mancur / lubang hitam (seconds)
  shell?: number[]; // colours of the casing that flies apart
  paper?: number[]; // colours of paper scraps
  trial?: boolean; // brand new & free to try
  confetti?: number; // > 0: bursts into a storm of colourful paper
  lvlBase?: number; // base price of a level-up
}

const RAINBOW = [0xff3b6b, 0xffd23f, 0x3bd6ff, 0x5dff7a, 0xc77dff, 0xff9f1c];

export const FIRE_TYPES: FireType[] = [
  {
    id: "cabe",
    name: "Mercon Cabe Rawit",
    desc: "Satu tap, satu mercon. Makin tinggi level, makin GELEGAR!",
    icon: "🧨",
    cost: 0,
    radius: 2.3,
    radiusMax: 11,
    maxScale: 3,
    fuse: 1.55,
    kind: "single",
    value: 1,
    count: 1,
    power: 0.6,
    model: "cabe",
    accent: "#ff4d4d",
    shell: [0xe3262e, 0xffc533, 0xfff1c9],
    paper: [0xe3262e, 0xffc533, 0xff7a59],
  },
  {
    id: "kertas",
    name: "Mercon Kertas",
    desc: "Meletus jadi hujan kertas warna-warni yang berhamburan!",
    icon: "🎊",
    cost: 600,
    radius: 2.0,
    radiusMax: 8,
    maxScale: 3,
    fuse: 1.5,
    kind: "single",
    value: 1.15,
    count: 1,
    power: 0.55,
    model: "kertas",
    accent: "#ec4899",
    confetti: 1,
    shell: RAINBOW,
    paper: RAINBOW,
  },
  {
    id: "renteng",
    name: "Mercon Renteng",
    desc: "8 ledakan beruntun, bunyi tar-tar-tar!",
    icon: "🎆",
    cost: 450,
    radius: 1.9,
    radiusMax: 5.6,
    maxScale: 3,
    fuse: 1.4,
    kind: "string",
    value: 1.25,
    count: 8,
    power: 0.3,
    model: "cabe",
    accent: "#ff9f1c",
    shell: [0xe3262e, 0xffc533],
    paper: [0xe3262e, 0xffc533],
  },
  {
    id: "kodok",
    name: "Kodok Loncat",
    desc: "Loncat-loncat, tiap mendarat DOR kecil, lalu meledak besar!",
    icon: "🐸",
    cost: 0,
    trial: true,
    radius: 2.2,
    radiusMax: 8.5,
    maxScale: 3,
    fuse: 1.0,
    kind: "hopper",
    value: 1.5,
    count: 4,
    power: 0.65,
    model: "kodok",
    accent: "#22c55e",
    shell: [0x4ade80, 0x16a34a, 0xffffff],
    paper: [0x4ade80, 0xfacc15],
    lvlBase: 500,
  },
  {
    id: "petir",
    name: "Mercon Petir",
    desc: "Mengumpulkan listrik, lalu menyambar-nyambar dari langit!",
    icon: "🌩️",
    cost: 0,
    trial: true,
    radius: 2.6,
    radiusMax: 9.5,
    maxScale: 3,
    fuse: 1.1,
    kind: "storm",
    value: 1.8,
    count: 4,
    power: 0.8,
    model: "petir",
    accent: "#38bdf8",
    shell: [0x334155, 0x38bdf8, 0xfacc15],
    lvlBase: 700,
  },
  {
    id: "lubang",
    name: "Lubang Hitam",
    desc: "Menyedot serpihan, menggali tanah, lalu meledak balik!",
    icon: "🕳️",
    cost: 0,
    trial: true,
    radius: 3.4,
    radiusMax: 12.5,
    maxScale: 3,
    fuse: 1.2,
    dur: 2.7,
    kind: "hole",
    value: 2.2,
    count: 1,
    power: 1.0,
    model: "lubang",
    accent: "#7c3aed",
    shell: [0x1e1b4b, 0xa855f7, 0xf0abfc],
    lvlBase: 1000,
  },
  {
    id: "ufo",
    name: "UFO Orbit",
    desc: "Melayang, menembak laser melingkar, lalu jatuh menghantam pulau!",
    icon: "🛸",
    cost: 0,
    trial: true,
    radius: 2.8,
    radiusMax: 10.5,
    maxScale: 3,
    fuse: 1.15,
    dur: 2.8,
    kind: "orbit",
    value: 1.9,
    count: 5,
    power: 0.85,
    model: "ufo",
    accent: "#22d3ee",
    shell: [0x22d3ee, 0xa3e635, 0xe879f9],
    lvlBase: 850,
  },
  {
    id: "naga",
    name: "Ular Mercon",
    desc: "Meliuk ala Slither.io, memanjat blok, lalu meledak dari ekor ke kepala!",
    icon: "🐍",
    cost: 0,
    trial: true,
    radius: 2.5,
    radiusMax: 10,
    maxScale: 3,
    fuse: 1.2,
    dur: 3.1,
    kind: "dragon",
    value: 1.75,
    count: 1,
    power: 0.8,
    model: "naga",
    accent: "#f97316",
    shell: [0xef4444, 0xf97316, 0xfacc15],
    paper: [0xef4444, 0xfacc15],
    lvlBase: 800,
  },
  {
    id: "disco",
    name: "Disco Bomb",
    desc: "Berdetak, memancarkan gelombang warna, lalu finale 360 derajat!",
    icon: "🪩",
    cost: 0,
    trial: true,
    radius: 2.4,
    radiusMax: 9,
    maxScale: 3,
    fuse: 1.15,
    dur: 3.0,
    kind: "disco",
    value: 1.7,
    count: 6,
    power: 0.75,
    model: "disco",
    accent: "#d946ef",
    shell: RAINBOW,
    paper: RAINBOW,
    confetti: 0.55,
    lvlBase: 750,
  },
  {
    id: "gasing",
    name: "Mercon Gasing",
    desc: "Berputar liar menyemburkan api, ninggalin kawah, lalu GLEGAR!",
    icon: "🌀",
    cost: 1800,
    radius: 3.0,
    radiusMax: 9.5,
    maxScale: 3,
    fuse: 1.0,
    dur: 3.5,
    kind: "top",
    value: 1.6,
    count: 1,
    power: 0.7,
    model: "gasing",
    accent: "#14b8a6",
    shell: [0x14b8a6, 0xf43f5e, 0xfacc15],
    paper: [0x14b8a6, 0xfacc15],
  },
  {
    id: "gorilla",
    name: "Gorilla Smash",
    desc: "Melompat 4 detik, menghajar target, memanjat, lalu Hulk Smash!",
    icon: "🦍",
    cost: 0,
    trial: true,
    radius: 3.2,
    radiusMax: 12,
    maxScale: 1.3,
    fuse: 1.2,
    dur: 4,
    kind: "gorilla",
    value: 2.4,
    count: 1,
    power: 1.05,
    model: "gorilla",
    accent: "#64748b",
    shell: [0x303640, 0x59616e, 0x9ca3af],
    lvlBase: 1400,
  },
  {
    id: "semut",
    name: "Koloni Semut",
    desc: "Puluhan semut mercon kecil berlari cepat, menyebar, lalu meletus!",
    icon: "🐜",
    cost: 0,
    trial: true,
    radius: 1.25,
    radiusMax: 5.8,
    maxScale: 1.3,
    fuse: 1.05,
    dur: 3.4,
    kind: "ants",
    value: 1.5,
    count: 10,
    power: 0.5,
    model: "ants",
    accent: "#ef4444",
    shell: [0x171717, 0xef4444, 0xfacc15],
    lvlBase: 650,
  },
  {
    id: "drill",
    name: "Mercon Bor Bumi",
    desc: "Kerucut bor menembus lapisan tanah lalu meledak dari bawah!",
    icon: "🔻",
    cost: 18000,
    radius: 3.1,
    radiusMax: 11.5,
    maxScale: 3,
    fuse: 1.25,
    dur: 2.4,
    kind: "drill",
    value: 2.3,
    count: 1,
    power: 0.9,
    model: "drill",
    accent: "#f59e0b",
    shell: [0xf59e0b, 0x64748b, 0x22d3ee],
    lvlBase: 1400,
  },
  {
    id: "bambu",
    name: "Meriam Bambu",
    desc: "Long bumbung khas Ramadan. Gelegar!",
    icon: "🎋",
    cost: 3800,
    radius: 4.3,
    radiusMax: 13.5,
    maxScale: 3,
    fuse: 1.9,
    kind: "single",
    value: 1.8,
    count: 1,
    power: 0.8,
    model: "bambu",
    accent: "#7bd23b",
    shell: [0xb9d24f, 0x6f8f2a, 0xa9c640],
  },
  {
    id: "air",
    name: "Air Mancur",
    desc: "Semburan bunga api yang bikin kawah kecil bertubi-tubi.",
    icon: "⛲",
    cost: 9500,
    radius: 1.5,
    radiusMax: 6,
    maxScale: 3,
    fuse: 1.0,
    dur: 3.4,
    kind: "fountain",
    value: 1.1,
    count: 11,
    power: 0.45,
    model: "fountain",
    accent: "#f59e0b",
    shell: [0x2563eb, 0xfacc15, 0xe11d48],
  },
  {
    id: "roket",
    name: "Kembang Api Roket",
    desc: "Meluncur, meledak, lalu hujan meteor api.",
    icon: "🚀",
    cost: 24000,
    radius: 2.4,
    radiusMax: 7.5,
    maxScale: 3,
    fuse: 1.3,
    kind: "rocket",
    value: 2.4,
    count: 9,
    power: 0.7,
    model: "rocket",
    accent: "#38bdf8",
  },
  {
    id: "tnt",
    name: "Dinamit TNT",
    desc: "Satu bundel. Kawah raksasa.",
    icon: "🧱",
    cost: 150000,
    radius: 7.2,
    radiusMax: 16,
    maxScale: 3,
    fuse: 2.2,
    kind: "single",
    value: 4,
    count: 1,
    power: 1.0,
    model: "tnt",
    accent: "#e11d48",
    shell: [0xd1281f, 0x262626],
  },
  {
    id: "atom",
    name: "Bom Atom Mini",
    desc: "Awan jamur. Pulau rata dengan tanah.",
    icon: "☢️",
    cost: 1200000,
    radius: 11.5,
    radiusMax: 17,
    maxScale: 3,
    fuse: 2.7,
    kind: "nuke",
    value: 8,
    count: 1,
    power: 1.6,
    model: "nuke",
    accent: "#a855f7",
    shell: [0x2d3748, 0xffd60a],
  },
];

/* ------------------------------------------------------------------ */
/* Per-mercon levels: tap a mercon -> LEVEL UP -> bigger, more destructive, louder, more festive */

export const MAX_LEVEL = 10;
export const MAX_BLAST_RADIUS = 17;

const frac = (level: number) =>
  Math.max(0, Math.min(1, (level - 1) / (MAX_LEVEL - 1)));

/** visual size multiplier: globally capped at 1.3x at Lv10 */
export const sizeOf = (t: FireType, level: number) =>
  1 + (Math.min(1.3, t.maxScale) - 1) * frac(level);

/** blast radius in voxels */
export const radiusOf = (t: FireType, level: number) =>
  Math.min(MAX_BLAST_RADIUS, t.radius + (t.radiusMax - t.radius) * frac(level));

/** coin multiplier per voxel */
export const valueOf = (t: FireType, level: number) =>
  t.value * (1 + 0.28 * (level - 1));

/** price of going from `level` to `level + 1` */
export const levelCost = (t: FireType, level: number) =>
  Math.round(
    (t.lvlBase ?? (t.cost > 0 ? t.cost * 0.22 : 90)) * Math.pow(1.8, level - 1)
  );

/* ------------------------------------------------------------------ */
/* Global upgrades */

export type UpgradeId = "income" | "fuse" | "auto" | "combo";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  icon: string;
  base: number;
  growth: number;
  max: number;
  accent: string;
  effect: (level: number) => string;
}

export const incomeMult = (l: number) => 1 + 0.3 * l;
export const fuseMult = (l: number) => Math.max(0.3, Math.pow(0.9, l));
export const autoInterval = (l: number) =>
  l <= 0 ? Infinity : 4.2 * Math.pow(0.84, l - 1);
export const comboStep = (l: number) => 0.03 + 0.012 * l;

export const UPGRADES: UpgradeDef[] = [
  {
    id: "income",
    name: "Cuan Lebih",
    icon: "💰",
    base: 45,
    growth: 1.58,
    max: 60,
    accent: "#facc15",
    effect: (l) => `Uang ×${incomeMult(l).toFixed(1)}`,
  },
  {
    id: "fuse",
    name: "Sumbu Kilat",
    icon: "⚡",
    base: 70,
    growth: 1.75,
    max: 10,
    accent: "#38bdf8",
    effect: (l) => `Sumbu ×${fuseMult(l).toFixed(2)} waktu`,
  },
  {
    id: "auto",
    name: "Tukang Nyalain",
    icon: "🤖",
    base: 160,
    growth: 1.72,
    max: 20,
    accent: "#22c55e",
    effect: (l) =>
      l <= 0 ? "Belum aktif" : `Otomatis tiap ${autoInterval(l).toFixed(1)}d`,
  },
  {
    id: "combo",
    name: "Kombo Maut",
    icon: "🔥",
    base: 210,
    growth: 1.8,
    max: 15,
    accent: "#f97316",
    effect: (l) => `+${(comboStep(l) * 100).toFixed(0)}% per kombo`,
  },
];

export const upgradeCost = (u: UpgradeDef, level: number) =>
  Math.round(u.base * Math.pow(u.growth, level));

const SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc"];

export function fmt(n: number): string {
  if (!isFinite(n)) return "∞";
  n = Math.floor(n);
  if (n < 1000) return String(n);
  let tier = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(n) / 3));
  let scaled = n / Math.pow(1000, tier);
  if (scaled >= 999.5 && tier < SUFFIX.length - 1) {
    tier += 1;
    scaled = n / Math.pow(1000, tier);
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  let s = scaled.toFixed(digits);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  return s + SUFFIX[tier];
}
