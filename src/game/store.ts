import { useSyncExternalStore } from "react";
import {
  FIRE_TYPES,
  MAX_LEVEL,
  UPGRADES,
  levelCost,
  upgradeCost,
  type UpgradeId,
} from "./config";

export interface Banner {
  id: number;
  text: string;
  sub: string;
}

export interface GameState {
  money: number;
  total: number;
  unlimited: boolean;
  levels: Record<UpgradeId, number>;
  fireLevels: Record<string, number>;
  owned: string[];
  selected: string;
  stage: number;
  progress: number;
  combo: number;
  comboMult: number;
  muted: boolean;
  vibrate: boolean;
  throwMode: boolean;
  night: boolean;
  glow: 0 | 1 | 2; // bloom level: 0 off, 1 soft, 2 normal
  cameraShake: "comfort" | "impact";
  shopDesign: "model" | "classic";
  tutorialDone: boolean;
  tab: "fire" | "upgrade";
  panelOpen: boolean;
  levelSheet: string | null; // id of the mercon whose level-up sheet is open
  banner: Banner | null;
}

const SAVE_KEY = "mercon-voxel-v2";
const OLD_KEY = "mercon-voxel-v1";

const defaultState = (): GameState => ({
  money: 0,
  total: 0,
  unlimited: true,
  levels: { income: 0, fuse: 0, auto: 0, combo: 0 },
  fireLevels: {},
  // the brand-new crackers are free to try from the start
  owned: ["cabe", ...FIRE_TYPES.filter((f) => f.cost === 0 && f.id !== "cabe").map((f) => f.id)],
  selected: "cabe",
  stage: 1,
  progress: 0,
  combo: 0,
  comboMult: 1,
  muted: false,
  vibrate: true,
  throwMode: false,
  night: true,
  glow: 1,
  cameraShake: "comfort",
  shopDesign: "model",
  tutorialDone: false,
  tab: "fire",
  panelOpen: true,
  levelSheet: null,
  banner: null,
});

function load(): GameState {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(OLD_KEY);
    if (!raw) return base;
    const d = JSON.parse(raw);
    const lv = d.levels || {};
    const fl: Record<string, number> = {};
    if (d.fireLevels && typeof d.fireLevels === "object") {
      for (const k of Object.keys(d.fireLevels)) {
        fl[k] = Math.max(1, Math.min(MAX_LEVEL, Number(d.fireLevels[k]) || 1));
      }
    }
    return {
      ...base,
      money: Number(d.money) || 0,
      total: Number(d.total) || 0,
      unlimited: d.unlimited !== false,
      levels: {
        income: Number(lv.income) || 0,
        fuse: Number(lv.fuse) || 0,
        auto: Number(lv.auto) || 0,
        combo: Number(lv.combo) || 0,
      },
      fireLevels: fl,
      // saves from before also get the free-to-try crackers
      owned: Array.from(
        new Set([
          ...(Array.isArray(d.owned) && d.owned.length ? d.owned : base.owned),
          ...base.owned,
        ])
      ),
      selected: typeof d.selected === "string" ? d.selected : base.selected,
      // Map revision 1 introduces the palace opening. Existing saves visit it once
      // without losing money, purchases or levels.
      stage: d.mapRevision === 1 ? Math.max(1, Number(d.stage) || 1) : 1,
      muted: !!d.muted,
      vibrate: d.vibrate !== false,
      throwMode: !!d.throwMode,
      night: d.night !== false, // night is the default
      glow: d.glow === 0 || d.glow === 2 ? d.glow : 1,
      cameraShake: d.cameraShake === "impact" ? "impact" : "comfort",
      shopDesign: d.shopDesign === "classic" ? "classic" : "model",
      tutorialDone: !!d.tutorialDone,
    };
  } catch {
    return base;
  }
}

let state: GameState = load();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

function save() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const s = state;
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          money: s.money,
          total: s.total,
          unlimited: s.unlimited,
          levels: s.levels,
          fireLevels: s.fireLevels,
          owned: s.owned,
          selected: s.selected,
          stage: s.stage,
          mapRevision: 1,
          muted: s.muted,
          vibrate: s.vibrate,
          throwMode: s.throwMode,
          night: s.night,
          glow: s.glow,
          cameraShake: s.cameraShake,
          shopDesign: s.shopDesign,
          tutorialDone: s.tutorialDone,
        })
      );
    } catch {
      /* ignore */
    }
  }, 400);
}

function emit() {
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function setState(patch: Partial<GameState>) {
  state = { ...state, ...patch };
  emit();
  save();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useGame<T>(selector: (s: GameState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/* ---------- helpers ---------- */

export const fireLevel = (s: GameState, id: string) => s.fireLevels[id] ?? 1;

/** spendable money (Infinity while unlimited mode is on) */
export const wallet = (s: GameState) => (s.unlimited ? Infinity : s.money);

function pay(cost: number) {
  return state.unlimited ? state.money : state.money - cost;
}

/* ---------- actions ---------- */

export function addMoney(n: number) {
  if (n <= 0) return;
  setState({ money: state.money + n, total: state.total + n });
}

export function buyUpgrade(id: UpgradeId): boolean {
  const def = UPGRADES.find((u) => u.id === id)!;
  const lvl = state.levels[id];
  if (lvl >= def.max) return false;
  const cost = upgradeCost(def, lvl);
  if (wallet(state) < cost) return false;
  setState({
    money: pay(cost),
    levels: { ...state.levels, [id]: lvl + 1 },
  });
  return true;
}

export function buyType(id: string): boolean {
  const t = FIRE_TYPES.find((f) => f.id === id);
  if (!t || state.owned.includes(id)) return false;
  if (wallet(state) < t.cost) return false;
  setState({
    money: pay(t.cost),
    owned: [...state.owned, id],
    selected: id,
  });
  return true;
}

export function levelUp(id: string): boolean {
  const t = FIRE_TYPES.find((f) => f.id === id);
  if (!t || !state.owned.includes(id)) return false;
  const lvl = fireLevel(state, id);
  if (lvl >= MAX_LEVEL) return false;
  const cost = levelCost(t, lvl);
  if (wallet(state) < cost) return false;
  setState({
    money: pay(cost),
    fireLevels: { ...state.fireLevels, [id]: lvl + 1 },
  });
  return true;
}

export function selectType(id: string) {
  if (!state.owned.includes(id)) return;
  setState({ selected: id });
}

let bannerId = 0;
export function showBanner(text: string, sub: string) {
  const id = ++bannerId;
  setState({ banner: { id, text, sub } });
  window.setTimeout(() => {
    if (state.banner && state.banner.id === id) setState({ banner: null });
  }, 2100);
}

export function resetAll() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}
