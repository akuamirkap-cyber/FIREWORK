import type { ReactNode } from "react";
import {
  FIRE_TYPES,
  MAX_BLAST_RADIUS,
  MAX_LEVEL,
  UPGRADES,
  fmt,
  radiusOf,
  sizeOf,
  upgradeCost,
  valueOf,
  type FireType,
  type UpgradeDef,
} from "../game/config";
import {
  buyType,
  buyUpgrade,
  selectType,
  setState,
  useGame,
  wallet,
} from "../game/store";
import { sfx } from "../game/audio";
import { cn } from "../utils/cn";
import FireVisual from "./FireVisual";

function Tile({
  color,
  children,
  dim,
  badge,
  onClick,
}: {
  color: string;
  children: ReactNode;
  dim?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "relative grid h-[58px] w-[58px] shrink-0 place-items-center overflow-visible rounded-2xl border-[3px] border-[#1b0c3a] text-[30px] shadow-[inset_0_-6px_0_rgba(0,0,0,0.22),0_3px_0_rgba(0,0,0,0.3)]",
        onClick && "active:translate-y-0.5"
      )}
      style={{ background: color }}
    >
      <span className="pointer-events-none absolute inset-x-1 top-0.5 h-[40%] rounded-xl bg-gradient-to-b from-white/50 to-white/0" />
      <span className={cn("relative drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]", dim && "opacity-60 grayscale")}>
        {children}
      </span>
      {badge}
    </Tag>
  );
}

function CoinDot() {
  return (
    <i className="mr-1.5 inline-block h-[18px] w-[18px] rounded-full border-2 border-amber-700 bg-gradient-to-b from-yellow-200 to-amber-400 align-[-3px] shadow-[inset_0_-2px_0_rgba(180,83,9,0.4)]" />
  );
}

function BuyButton({
  cost,
  can,
  onClick,
}: {
  cost: number;
  can: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={!can}
      onClick={onClick}
      className={cn(
        "relative min-w-[104px] overflow-hidden rounded-xl px-3 py-2.5 text-[19px] leading-none transition active:translate-y-[3px] active:shadow-none",
        can
          ? "shine pulse-soft bg-gradient-to-b from-lime-300 to-green-500 text-green-950 shadow-[0_4px_0_#166534]"
          : "bg-slate-600/80 text-slate-300 shadow-[0_4px_0_#334155]"
      )}
    >
      <CoinDot />
      {fmt(cost)}
    </button>
  );
}

function StatBar({
  icon,
  value,
  color,
}: {
  icon: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-1 items-center gap-1">
      <span className="text-[12px] leading-none">{icon}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.max(6, Math.min(1, value) * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function UpgradeRow({
  def,
  level,
  money,
}: {
  def: UpgradeDef;
  level: number;
  money: number;
}) {
  const maxed = level >= def.max;
  const cost = upgradeCost(def, level);
  const can = !maxed && money >= cost;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 p-2.5 shadow-[0_4px_0_rgba(0,0,0,0.28)] transition",
        can
          ? "border-lime-300/70 bg-gradient-to-b from-lime-300/[0.18] to-white/[0.05]"
          : "border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.04]"
      )}
    >
      <Tile color={def.accent}>{def.icon}</Tile>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[19px] leading-none text-white">
            {def.name}
          </span>
          <span className="shrink-0 rounded-full bg-black/40 px-2 py-0.5 text-[12px] leading-none text-yellow-200">
            Lv {level}
          </span>
        </div>
        <div className="mt-1.5 truncate font-sans text-[12.5px] font-bold leading-none text-white/70">
          {def.effect(level)}
          {!maxed && (
            <span className="text-lime-300"> → {def.effect(level + 1)}</span>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: `${Math.max(3, (level / def.max) * 100)}%`,
              background: def.accent,
            }}
          />
        </div>
      </div>
      {maxed ? (
        <div className="min-w-[104px] rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-2.5 text-center text-[19px] leading-none text-amber-950 shadow-[0_4px_0_#92400e]">
          MAX
        </div>
      ) : (
        <BuyButton
          cost={cost}
          can={can}
          onClick={() => {
            sfx.init();
            if (buyUpgrade(def.id)) sfx.buy();
          }}
        />
      )}
    </div>
  );
}

function FireRow({
  type,
  owned,
  selected,
  level,
  money,
}: {
  type: FireType;
  owned: boolean;
  selected: boolean;
  level: number;
  money: number;
}) {
  const can = money >= type.cost;
  const design = useGame((s) => s.shopDesign);
  const openSheet = () => {
    sfx.init();
    sfx.tick();
    setState({ levelSheet: type.id });
  };
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border-2 p-2.5 shadow-[0_4px_0_rgba(0,0,0,0.28)] transition",
        selected
          ? "border-lime-300/80 bg-gradient-to-b from-lime-300/[0.2] to-white/[0.05]"
          : !owned && can
            ? "border-lime-300/50 bg-gradient-to-b from-lime-300/[0.12] to-white/[0.04]"
            : "border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.04]"
      )}
    >
      {design === "classic" ? (
        <Tile
          color={type.accent}
          dim={!owned}
          onClick={owned ? openSheet : undefined}
          badge={
            !owned ? (
              <span className="absolute bottom-0 right-0.5 text-[15px]">🔒</span>
            ) : (
              <span className="absolute -bottom-1.5 -right-1.5 rounded-full border-2 border-[#1b0c3a] bg-yellow-300 px-1.5 py-0.5 font-sans text-[11px] font-black leading-none text-amber-950">
                {level}
              </span>
            )
          }
        >
          {type.icon}
        </Tile>
      ) : (
        <button
          onClick={owned ? openSheet : undefined}
          className={cn(
            "relative -ml-2 grid h-[66px] w-[84px] shrink-0 place-items-center",
            !owned && "grayscale"
          )}
        >
          <FireVisual type={type} />
          <span className="absolute bottom-0 right-0 rounded-full border-2 border-[#1b0c3a] bg-yellow-300 px-1.5 py-0.5 font-sans text-[11px] font-black leading-none text-amber-950">
            {owned ? level : "🔒"}
          </span>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[19px] leading-none text-white">
            {type.name}
          </span>
          {type.trial && (
            <span className="shrink-0 rounded-md bg-pink-500 px-1.5 py-1 font-sans text-[10px] font-black leading-none text-white shadow-[0_2px_0_#9d174d]">
              BARU · GRATIS COBA
            </span>
          )}
        </div>
        <div className="mt-1 line-clamp-1 font-sans text-[12.5px] font-bold leading-tight text-white/70">
          {type.desc}
        </div>
        <div className="mt-2 flex gap-3">
          <StatBar icon="📏" value={(sizeOf(type, level) - 1) / 0.3} color="#38bdf8" />
          <StatBar icon="💥" value={radiusOf(type, level) / MAX_BLAST_RADIUS} color="#fb923c" />
          <StatBar icon="💰" value={valueOf(type, level) / 14} color="#facc15" />
        </div>
        {owned && (
          <button
            onClick={openSheet}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-yellow-300 px-2.5 py-1.5 text-[13px] leading-none text-amber-950 shadow-[0_3px_0_#92400e] active:translate-y-[2px] active:shadow-none"
          >
            ⬆ LEVEL UP
            <span className="rounded bg-black/15 px-1.5 py-0.5 font-sans text-[11px] font-black">
              {level}/{MAX_LEVEL}
            </span>
          </button>
        )}
      </div>
      {owned ? (
        selected ? (
          <div className="min-w-[96px] rounded-xl bg-gradient-to-b from-lime-200 to-lime-400 px-3 py-2.5 text-center text-[16px] leading-none text-green-950 shadow-[0_4px_0_#4d7c0f]">
            DIPAKAI ✓
          </div>
        ) : (
          <button
            onClick={() => {
              sfx.init();
              sfx.tick();
              selectType(type.id);
            }}
            className="min-w-[96px] rounded-xl bg-gradient-to-b from-sky-300 to-sky-500 px-3 py-2.5 text-[19px] leading-none text-sky-950 shadow-[0_4px_0_#075985] active:translate-y-[3px] active:shadow-none"
          >
            PAKAI
          </button>
        )
      ) : (
        <BuyButton
          cost={type.cost}
          can={can}
          onClick={() => {
            sfx.init();
            if (buyType(type.id)) sfx.buy();
          }}
        />
      )}
    </div>
  );
}

export default function Shop() {
  const tab = useGame((s) => s.tab);
  const open = useGame((s) => s.panelOpen);
  const money = useGame((s) => wallet(s));
  const levels = useGame((s) => s.levels);
  const fireLevels = useGame((s) => s.fireLevels);
  const owned = useGame((s) => s.owned);
  const selected = useGame((s) => s.selected);

  const canUp = UPGRADES.some(
    (u) => levels[u.id] < u.max && money >= upgradeCost(u, levels[u.id])
  );
  const canFire = FIRE_TYPES.some(
    (f) => !owned.includes(f.id) && money >= f.cost
  );

  const tabBtn = (id: "fire" | "upgrade", label: string, dot: boolean) => (
    <button
      onClick={() => setState({ tab: id, panelOpen: true })}
      className={cn(
        "relative flex-1 rounded-xl py-2.5 text-[18px] leading-none transition active:translate-y-[2px]",
        tab === id
          ? "bg-gradient-to-b from-yellow-300 to-amber-500 text-amber-950 shadow-[0_4px_0_#92400e]"
          : "bg-white/10 text-white/80 shadow-[0_4px_0_rgba(0,0,0,0.25)]"
      )}
    >
      {label}
      {dot && (
        <span className="dot-pulse absolute -right-1 -top-1.5 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-red-500 text-[12px] leading-none text-white">
          !
        </span>
      )}
    </button>
  );

  return (
    <aside
      className={cn(
        "relative z-10 flex shrink-0 flex-col rounded-t-[28px] border-t-[4px] border-[#7b4ae0] shadow-[0_-10px_30px_rgba(0,0,0,0.35)]",
        "md:h-full md:w-[390px] md:rounded-none md:border-l-[4px] md:border-t-0",
        open ? "h-[42dvh]" : "h-auto"
      )}
      style={{
        backgroundColor: "#1d0f45",
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 26px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 26px), linear-gradient(180deg, #31196e 0%, #1a0e3d 100%)",
      }}
    >
      <button
        aria-label="Buka/tutup toko"
        className="mx-auto mt-1.5 h-5 w-24 shrink-0 md:hidden"
        onClick={() => setState({ panelOpen: !open })}
      >
        <span className="mx-auto block h-1.5 w-12 rounded-full bg-white/30" />
      </button>

      <div className="hidden shrink-0 px-4 pt-4 md:block">
        <div className="txt-stroke text-center text-[32px] leading-none text-yellow-300">
          MERCON VOXEL
        </div>
        <div className="txt-stroke-sm mt-1.5 text-center text-[12px] tracking-[0.25em] text-white/80">
          LEDAKKAN · UPGRADE · ULANGI
        </div>
      </div>

      <div className="flex shrink-0 gap-2 px-3 pb-2.5 pt-1 md:pt-3">
        {tabBtn("fire", "🧨 MERCON", canFire)}
        {tabBtn("upgrade", "⬆️ UPGRADE", canUp)}
      </div>
      <div
        className={cn(
          "shop-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 pb-[max(14px,env(safe-area-inset-bottom))]",
          !open && "hidden md:block"
        )}
      >
        {tab === "upgrade"
          ? UPGRADES.map((u) => (
              <UpgradeRow key={u.id} def={u} level={levels[u.id]} money={money} />
            ))
          : FIRE_TYPES.map((f) => (
              <FireRow
                key={f.id}
                type={f}
                owned={owned.includes(f.id)}
                selected={selected === f.id}
                level={fireLevels[f.id] ?? 1}
                money={money}
              />
            ))}
        <div className="h-1" />
      </div>
    </aside>
  );
}
