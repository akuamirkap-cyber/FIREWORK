import { useEffect, useRef, useState } from "react";
import {
  FIRE_TYPES,
  MAX_LEVEL,
  fmt,
  levelCost,
  radiusOf,
  sizeOf,
} from "../game/config";
import {
  fireLevel,
  resetAll,
  setState,
  showBanner,
  useGame,
  wallet,
} from "../game/store";
import { THEMES } from "../game/voxelWorld";
import { sfx } from "../game/audio";
import { cn } from "../utils/cn";

export function Coin({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full border-[3px] border-amber-700 bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-500 text-amber-800 shadow-[inset_0_-3px_0_rgba(180,83,9,0.45)]"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      <span className="leading-none">$</span>
    </span>
  );
}

function Money() {
  const money = useGame((s) => s.money);
  const unlimited = useGame((s) => s.unlimited);
  const [disp, setDisp] = useState(money);
  const dispRef = useRef(money);
  const boxRef = useRef<HTMLDivElement>(null);
  const prev = useRef(money);

  useEffect(() => {
    if (money > prev.current && boxRef.current?.animate) {
      boxRef.current.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.12)" },
          { transform: "scale(1)" },
        ],
        { duration: 180, easing: "ease-out" }
      );
    }
    prev.current = money;
    let raf = 0;
    const tick = () => {
      const diff = money - dispRef.current;
      if (Math.abs(diff) < 1) {
        dispRef.current = money;
        setDisp(money);
        return;
      }
      dispRef.current += diff * 0.22 + Math.sign(diff) * 0.5;
      setDisp(dispRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [money]);

  return (
    <div
      ref={boxRef}
      className="relative flex items-center gap-2 overflow-hidden rounded-full border-[3px] border-[#2a1445] bg-gradient-to-b from-[#5a34a8] to-[#341a70] py-1 pl-1 pr-4 shadow-[0_4px_0_rgba(0,0,0,0.3)]"
    >
      <span className="pointer-events-none absolute inset-x-3 top-0.5 h-[38%] rounded-full bg-white/20" />
      <Coin size={34} />
      {unlimited ? (
        <span className="txt-stroke-sm min-w-[2ch] text-[34px] leading-[26px] text-yellow-300">
          ∞
        </span>
      ) : (
        <span className="txt-stroke-sm min-w-[3ch] text-[26px] leading-none text-yellow-300">
          {fmt(disp)}
        </span>
      )}
    </div>
  );
}

function StageBar() {
  const stage = useGame((s) => s.stage);
  const progress = useGame((s) => s.progress);
  const theme = THEMES[(stage - 1) % THEMES.length];
  return (
    <div className="flex w-full max-w-[260px] flex-col items-center gap-1">
      <div className="txt-stroke-sm flex items-center gap-2 text-[17px] leading-none text-white">
        <span>MISI {stage}</span>
        <span className="rounded-full bg-black/30 px-2 py-0.5 text-[12px] text-white/90">
          {theme.name}
        </span>
      </div>
      <div className="txt-stroke-sm max-w-[270px] truncate text-[11px] leading-none text-yellow-100">
        {theme.mission}
      </div>
      <div className="relative h-5 w-full overflow-hidden rounded-full border-[3px] border-[#2a1445] bg-[#2a1445]/75 shadow-[0_3px_0_rgba(0,0,0,0.25)]">
        <div
          className="relative h-full rounded-full bg-gradient-to-b from-lime-200 via-lime-400 to-green-500 transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(5, progress * 100)}%` }}
        >
          <span className="absolute inset-x-1.5 top-[2px] h-[3px] rounded-full bg-white/60" />
        </div>
        <span className="txt-stroke-sm absolute inset-0 grid place-items-center text-[11px] leading-none text-white">
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>
  );
}

function Combo() {
  const combo = useGame((s) => s.combo);
  const mult = useGame((s) => s.comboMult);
  if (combo < 2) return <div className="h-[52px]" />;
  const hot = combo >= 20;
  return (
    <div className="flex h-[52px] flex-col items-center">
      <div
        key={combo}
        className={`txt-stroke text-[30px] leading-none ${
          hot ? "text-orange-300" : "text-pink-200"
        }`}
        style={{ animation: "comboPop 0.18s ease-out" }}
      >
        KOMBO x{combo}
      </div>
      <div className="txt-stroke-sm mt-0.5 text-[13px] leading-none text-yellow-200">
        Cuan ×{mult.toFixed(2)}
      </div>
      <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-black/30">
        <div
          key={combo}
          className="h-full origin-left rounded-full bg-gradient-to-r from-yellow-300 to-orange-500"
          style={{ animation: "comboBar 2.2s linear forwards" }}
        />
      </div>
    </div>
  );
}

function Banner() {
  const banner = useGame((s) => s.banner);
  if (!banner) return null;
  return (
    <div
      key={banner.id}
      className="banner-pop pointer-events-none absolute inset-x-0 top-[26%] flex flex-col items-center gap-1 px-4 text-center"
    >
      <div className="txt-stroke text-[44px] leading-none text-yellow-300 sm:text-[56px]">
        {banner.text}
      </div>
      <div className="txt-stroke text-[24px] leading-none text-white">
        {banner.sub}
      </div>
    </div>
  );
}

function Tutorial() {
  const done = useGame((s) => s.tutorialDone);
  if (done) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[22%] flex flex-col items-center gap-2 px-4 text-center">
      <div className="tap-finger text-[56px] leading-none drop-shadow-[0_6px_0_rgba(0,0,0,0.25)]">
        👆
      </div>
      <div className="tap-hint txt-stroke rounded-2xl text-[28px] leading-none text-white">
        TAP untuk taruh mercon!
      </div>
      <div className="txt-stroke-sm text-[14px] leading-snug text-white/90">
        Geser = putar kamera · Pencet kartu mercon (kiri bawah) = LEVEL UP
      </div>
    </div>
  );
}

/** Bottom-left card: the mercon you are using. Press it to open LEVEL UP. */
function Loadout() {
  const selected = useGame((s) => s.selected);
  const lvl = useGame((s) => fireLevel(s, s.selected));
  const money = useGame((s) => wallet(s));
  const t = FIRE_TYPES.find((f) => f.id === selected) ?? FIRE_TYPES[0];
  const maxed = lvl >= MAX_LEVEL;
  const canUp = !maxed && money >= levelCost(t, lvl);
  return (
    <button
      aria-label="Level up mercon"
      onClick={() => {
        sfx.init();
        sfx.tick();
        setState({ levelSheet: t.id });
      }}
      className="pointer-events-auto absolute bottom-3 left-3 flex items-center gap-2 rounded-2xl border-[3px] border-[#2a1445] bg-gradient-to-b from-[#4a2a86] to-[#2d1766] py-1.5 pl-1.5 pr-3.5 text-left shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-0.5"
    >
      <span
        className="relative grid h-11 w-11 place-items-center rounded-xl border-2 border-black/30 text-[24px] shadow-[inset_0_-3px_0_rgba(0,0,0,0.22)]"
        style={{ background: t.accent }}
      >
        {t.icon}
        <span className="absolute -bottom-1.5 -right-1.5 rounded-full border-2 border-[#2a1445] bg-yellow-300 px-1.5 py-0.5 text-[11px] leading-none text-amber-950">
          {lvl}
        </span>
      </span>
      <span className="flex flex-col gap-1">
        <span className="txt-stroke-sm text-[15px] leading-none text-white">
          {t.name}
        </span>
        <span className="font-sans text-[11px] font-extrabold leading-none text-white/75">
          Lv {lvl}/{MAX_LEVEL} · ×{sizeOf(t, lvl).toFixed(1)} · R{radiusOf(t, lvl).toFixed(1)}
        </span>
      </span>
      {canUp && (
        <span className="dot-pulse absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-lime-500 text-[14px] leading-none text-white shadow">
          ⬆
        </span>
      )}
    </button>
  );
}

function ModeToggle() {
  const throwMode = useGame((s) => s.throwMode);
  return (
    <button
      aria-label="Ganti mode taruh atau lempar"
      onClick={() => {
        sfx.init();
        if (throwMode) sfx.tick();
        else sfx.swish();
        setState({ throwMode: !throwMode });
        showBanner(
          throwMode ? "MODE TARUH" : "MODE LEMPAR",
          throwMode ? "Mercon jatuh ke titik yang diketuk" : "Mercon dilempar dari kamera!"
        );
      }}
      className="pointer-events-auto absolute bottom-3 right-3 flex flex-col items-center gap-1 active:translate-y-0.5"
    >
      <span
        className={cn(
          "grid h-14 w-14 place-items-center rounded-full border-[3px] border-[#2a1445] text-[28px] leading-none shadow-[0_4px_0_rgba(0,0,0,0.3)]",
          throwMode
            ? "bg-gradient-to-b from-orange-300 to-rose-500"
            : "bg-gradient-to-b from-[#5a34a8] to-[#341a70]"
        )}
      >
        {throwMode ? "🤾" : "👇"}
      </span>
      <span className="txt-stroke-sm rounded-full bg-black/30 px-2 py-0.5 text-[11px] leading-none text-white">
        {throwMode ? "LEMPAR" : "TARUH"}
      </span>
    </button>
  );
}

function Settings() {
  const [open, setOpen] = useState(false);
  const muted = useGame((s) => s.muted);
  const vib = useGame((s) => s.vibrate);
  const night = useGame((s) => s.night);
  const unlimited = useGame((s) => s.unlimited);
  const glow = useGame((s) => s.glow);
  const shopDesign = useGame((s) => s.shopDesign);
  const cameraShake = useGame((s) => s.cameraShake);
  const glowName = ["MATI", "LEMBUT", "NORMAL"][glow];

  const btn =
    "grid h-11 w-11 place-items-center rounded-full border-[3px] border-[#2a1445] bg-[#3a1f66]/90 text-[20px] shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-0.5 backdrop-blur";

  return (
    <div className="relative flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          aria-label={night ? "Ganti ke mode siang" : "Ganti ke mode malam"}
          className={cn(
            btn,
            night
              ? "bg-gradient-to-b from-indigo-500 to-indigo-900"
              : "bg-gradient-to-b from-sky-300 to-amber-300"
          )}
          onClick={() => {
            sfx.init();
            sfx.tick();
            setState({ night: !night });
          }}
        >
          {night ? "🌙" : "☀️"}
        </button>
        <button
          aria-label="Suara"
          className={btn}
          onClick={() => {
            sfx.init();
            sfx.setMuted(!muted);
            setState({ muted: !muted });
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          aria-label="Pengaturan"
          className={btn}
          onClick={() => setOpen((o) => !o)}
        >
          ⚙️
        </button>
      </div>
      {open && (
        <div className="w-56 rounded-2xl border-[3px] border-[#2a1445] bg-[#2a1445]/95 p-2 text-white shadow-xl backdrop-blur">
          <button
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[16px] hover:bg-white/10"
            onClick={() => {
              sfx.init();
              sfx.tick();
              setState({ shopDesign: shopDesign === "model" ? "classic" : "model" });
            }}
          >
            <span>Tampilan katalog</span>
            <span className="text-cyan-300">
              {shopDesign === "model" ? "MODEL" : "KLASIK"}
            </span>
          </button>
          <button
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[16px] hover:bg-white/10"
            onClick={() => {
              sfx.init();
              sfx.tick();
              setState({ cameraShake: cameraShake === "comfort" ? "impact" : "comfort" });
            }}
          >
            <span>Getar kamera</span>
            <span className="text-cyan-300">
              {cameraShake === "comfort" ? "NYAMAN" : "PERLU SAJA"}
            </span>
          </button>
          <button
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[16px] hover:bg-white/10"
            onClick={() => {
              sfx.init();
              sfx.tick();
              setState({ glow: ((glow + 1) % 3) as 0 | 1 | 2 });
            }}
          >
            <span>Efek cahaya</span>
            <span className={glow === 0 ? "text-white/50" : "text-lime-300"}>
              {glowName}
            </span>
          </button>
          <button
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[16px] hover:bg-white/10"
            onClick={() => setState({ unlimited: !unlimited })}
          >
            <span>Uang unlimited</span>
            <span className={unlimited ? "text-lime-300" : "text-white/50"}>
              {unlimited ? "ON" : "OFF"}
            </span>
          </button>
          <button
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[16px] hover:bg-white/10"
            onClick={() => setState({ vibrate: !vib })}
          >
            <span>Getar</span>
            <span className={vib ? "text-lime-300" : "text-white/50"}>
              {vib ? "ON" : "OFF"}
            </span>
          </button>
          <button
            className="mt-1 w-full rounded-xl px-3 py-2 text-left text-[16px] text-red-300 hover:bg-white/10"
            onClick={() => {
              if (window.confirm("Reset semua progres dan mulai dari awal?")) resetAll();
            }}
          >
            Reset progres
          </button>
        </div>
      )}
    </div>
  );
}

export default function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto">
          <Money />
        </div>
        <div className="pointer-events-auto">
          <Settings />
        </div>
      </div>
      <div className="absolute inset-x-0 top-[66px] flex flex-col items-center gap-1 px-6 md:top-3">
        <StageBar />
      </div>
      <div className="absolute inset-x-0 top-[122px] flex justify-center md:top-[82px]">
        <Combo />
      </div>
      <Banner />
      <Tutorial />
      <Loadout />
      <ModeToggle />
    </div>
  );
}
