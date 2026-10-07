import { useState } from "react";
import {
  FIRE_TYPES,
  MAX_BLAST_RADIUS,
  MAX_LEVEL,
  fmt,
  levelCost,
  radiusOf,
  sizeOf,
  valueOf,
} from "../game/config";
import { fireLevel, levelUp, setState, useGame, wallet } from "../game/store";
import { sfx } from "../game/audio";
import { cn } from "../utils/cn";

function Row({
  icon,
  label,
  cur,
  next,
  frac,
  nextFrac,
  color,
}: {
  icon: string;
  label: string;
  cur: string;
  next: string | null;
  frac: number;
  nextFrac: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-black/25 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[17px] leading-none text-white">
          <span className="text-[20px]">{icon}</span>
          {label}
        </span>
        <span className="flex items-center gap-1.5 text-[18px] leading-none">
          <span className="text-white">{cur}</span>
          {next && (
            <>
              <span className="text-white/40">→</span>
              <span className="text-lime-300">{next}</span>
            </>
          )}
        </span>
      </div>
      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-black/40">
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-35"
          style={{ width: `${Math.min(1, nextFrac) * 100}%`, background: color }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{ width: `${Math.max(4, Math.min(1, frac) * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

/** Press a mercon -> this sheet: LEVEL UP makes it bigger and more destructive (max Lv 10). */
export default function LevelSheet() {
  const id = useGame((s) => s.levelSheet);
  const lvl = useGame((s) => (s.levelSheet ? fireLevel(s, s.levelSheet) : 1));
  const money = useGame((s) => wallet(s));
  const unlimited = useGame((s) => s.unlimited);
  const [bump, setBump] = useState(0);
  if (!id) return null;
  const t = FIRE_TYPES.find((f) => f.id === id);
  if (!t) return null;

  const close = () => setState({ levelSheet: null });
  const maxed = lvl >= MAX_LEVEL;
  const nl = Math.min(MAX_LEVEL, lvl + 1);
  const cost = levelCost(t, lvl);
  const can = !maxed && money >= cost;

  const size = sizeOf(t, lvl);
  const rad = radiusOf(t, lvl);
  const val = valueOf(t, lvl);
  const maxSize = sizeOf(t, MAX_LEVEL);
  const maxVal = valueOf(t, MAX_LEVEL);

  const doUp = () => {
    sfx.init();
    if (levelUp(t.id)) {
      sfx.buy();
      sfx.fanfare();
      setBump((b) => b + 1);
      try {
        navigator.vibrate?.(24);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-3 backdrop-blur-[2px] md:items-center"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-up relative w-full max-w-[430px] overflow-hidden rounded-[28px] border-[4px] border-[#7b4ae0] bg-gradient-to-b from-[#36197d] to-[#1a0e3d] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <button
          aria-label="Tutup"
          onClick={close}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-[18px] leading-none text-white active:translate-y-0.5"
        >
          ✕
        </button>

        {/* header */}
        <div className="flex items-center gap-4">
          <div className="relative grid h-[88px] w-[88px] shrink-0 place-items-center">
            <div
              className="absolute inset-0 rounded-full opacity-60 blur-xl"
              style={{ background: t.accent }}
            />
            <div
              className="relative grid h-[84px] w-[84px] place-items-center rounded-3xl border-[3px] border-[#1b0c3a] shadow-[inset_0_-6px_0_rgba(0,0,0,0.25)]"
              style={{ background: t.accent }}
            >
              <span className="pointer-events-none absolute inset-x-2 top-1 h-[38%] rounded-2xl bg-gradient-to-b from-white/50 to-white/0" />
              <span
                className="relative drop-shadow-[0_3px_0_rgba(0,0,0,0.3)] transition-transform duration-300"
                style={{
                  fontSize: 44,
                  transform: `scale(${0.75 + 0.45 * ((size - 1) / Math.max(0.01, maxSize - 1))})`,
                }}
              >
                {t.icon}
              </span>
            </div>
          </div>
          <div className="min-w-0 pr-8">
            <div className="txt-stroke-sm text-[22px] leading-tight text-white">{t.name}</div>
            <div
              key={bump}
              className="mt-1.5 inline-block rounded-full bg-yellow-300 px-3 py-1 text-[17px] leading-none text-amber-950"
              style={{ animation: bump ? "comboPop 0.3s ease-out" : undefined }}
            >
              LEVEL {lvl} / {MAX_LEVEL}
            </div>
          </div>
        </div>

        {/* level pips */}
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: MAX_LEVEL }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-3.5 flex-1 rounded-md border-2 border-[#1b0c3a]",
                i < lvl ? "" : i === lvl ? "pulse-soft bg-white/25" : "bg-black/35"
              )}
              style={i < lvl ? { background: t.accent } : undefined}
            />
          ))}
        </div>

        {/* stats */}
        <div className="mt-4 space-y-2">
          <Row
            icon="📏"
            label="Ukuran"
            cur={`×${size.toFixed(1)}`}
            next={maxed ? null : `×${sizeOf(t, nl).toFixed(1)}`}
            frac={size / maxSize}
            nextFrac={sizeOf(t, nl) / maxSize}
            color="#38bdf8"
          />
          <Row
            icon="💥"
            label="Radius ledakan"
            cur={rad.toFixed(1)}
            next={maxed ? null : radiusOf(t, nl).toFixed(1)}
            frac={rad / MAX_BLAST_RADIUS}
            nextFrac={radiusOf(t, nl) / MAX_BLAST_RADIUS}
            color="#fb923c"
          />
          <Row
            icon="💰"
            label="Cuan per voxel"
            cur={`×${val.toFixed(1)}`}
            next={maxed ? null : `×${valueOf(t, nl).toFixed(1)}`}
            frac={val / maxVal}
            nextFrac={valueOf(t, nl) / maxVal}
            color="#facc15"
          />
          <Row
            icon="🎉"
            label="Suara & kemeriahan"
            cur={`${100 + (lvl - 1) * 25}%`}
            next={maxed ? null : `${100 + (nl - 1) * 25}%`}
            frac={(lvl - 1) / (MAX_LEVEL - 1)}
            nextFrac={(nl - 1) / (MAX_LEVEL - 1)}
            color="#f472b6"
          />
        </div>

        <div className="mt-3 text-center font-sans text-[12px] font-bold leading-snug text-white/55">
          Level {MAX_LEVEL}: ukuran ×{maxSize.toFixed(0)}, radius {radiusOf(t, MAX_LEVEL).toFixed(1)}
        </div>

        {/* actions */}
        {maxed ? (
          <div className="mt-3 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 py-3.5 text-center text-[22px] leading-none text-amber-950 shadow-[0_5px_0_#92400e]">
            🏆 LEVEL MAKSIMAL
          </div>
        ) : (
          <button
            disabled={!can}
            onClick={doUp}
            className={cn(
              "relative mt-3 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 text-[24px] leading-none transition active:translate-y-[4px] active:shadow-none",
              can
                ? "shine pulse-soft bg-gradient-to-b from-lime-300 to-green-500 text-green-950 shadow-[0_5px_0_#166534]"
                : "bg-slate-600/80 text-slate-300 shadow-[0_5px_0_#334155]"
            )}
          >
            ⬆ LEVEL UP
            <span className="flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-[18px]">
              <i className="inline-block h-[18px] w-[18px] rounded-full border-2 border-amber-700 bg-gradient-to-b from-yellow-200 to-amber-400" />
              {fmt(cost)}
            </span>
          </button>
        )}
        {unlimited && !maxed && (
          <div className="mt-1.5 text-center font-sans text-[11px] font-extrabold text-lime-300/80">
            Uang unlimited aktif · tidak mengurangi saldo
          </div>
        )}
        <button
          onClick={() => setState({ levelSheet: null, tab: "fire", panelOpen: true })}
          className="mt-2 w-full rounded-2xl bg-white/10 py-2.5 text-[17px] leading-none text-white/90 active:translate-y-0.5"
        >
          🧨 Ganti mercon
        </button>
      </div>
    </div>
  );
}
