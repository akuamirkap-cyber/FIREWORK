import { useEffect, useRef, useState } from "react";
import { Engine } from "../game/engine";
import { sfx } from "../game/audio";
import { getState, useGame } from "../game/store";

export default function GameCanvas() {
  const night = useGame((s) => s.night);
  const bgRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current!;
    sfx.muted = getState().muted;

    let engine: Engine;
    try {
      engine = new Engine(host);
    } catch (err) {
      console.error("Gagal memulai engine 3D:", err);
      setFailed(err instanceof Error ? err.message : String(err));
      return;
    }

    engine.hooks.onFloat = (x, y, text, kind, size) => {
      const layer = floatRef.current;
      if (!layer) return;
      while (layer.childElementCount > 36) layer.firstElementChild?.remove();
      const el = document.createElement("div");
      el.className = `float-text float-${kind}`;
      el.textContent = text;
      el.style.left = `${x + (Math.random() - 0.5) * 24}px`;
      el.style.top = `${y}px`;
      el.style.fontSize = `${Math.round(24 * size)}px`;
      el.addEventListener("animationend", () => el.remove());
      layer.appendChild(el);
    };

    engine.hooks.onFlash = (i) => {
      const el = flashRef.current;
      if (!el) return;
      i = Math.min(0.28, i); // never allow a flash overlay to white-out the game
      el.style.transition = "none";
      el.style.opacity = String(i);
      void el.offsetWidth;
      el.style.transition = `opacity ${0.25 + i * 0.5}s ease-out`;
      el.style.opacity = "0";
    };

    engine.hooks.onTheme = (bg) => {
      if (bgRef.current) {
        bgRef.current.style.background = `linear-gradient(180deg, ${bg[0]} 0%, ${bg[1]} 100%)`;
      }
    };
    engine.pushTheme();

    return () => engine.dispose();
  }, []);

  return (
    <>
      <div
        ref={bgRef}
        className="absolute inset-0 transition-[background] duration-700"
        style={{ background: "linear-gradient(180deg, #59c8ff 0%, #d9f6ff 100%)" }}
      />
      <div ref={hostRef} className="absolute inset-0" />
      {/* soft vignette (deeper at night to focus the eye on the glow) */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          background: night
            ? "radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0) 48%, rgba(8,4,34,0.62) 100%)"
            : "radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 58%, rgba(40,15,80,0.3) 100%)",
        }}
      />
      <div
        ref={floatRef}
        className="pointer-events-none absolute inset-0 overflow-hidden"
      />
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 bg-white opacity-0"
      />
      {failed && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#1d1240]/95 p-6 text-center">
          <div className="max-w-sm">
            <div className="text-[52px] leading-none">🧨</div>
            <div className="txt-stroke mt-3 text-[28px] leading-tight text-yellow-300">
              Grafik 3D tidak bisa dimulai
            </div>
            <p className="mt-3 font-sans text-[14px] font-bold leading-snug text-white/80">
              Game ini butuh WebGL. Coba aktifkan akselerasi hardware di
              browser, atau buka di Chrome/Safari terbaru.
            </p>
            <p className="mt-2 break-words font-sans text-[11px] text-white/45">
              {failed}
            </p>
            <button
              className="mt-4 rounded-xl bg-gradient-to-b from-lime-300 to-green-500 px-6 py-2.5 text-[19px] text-green-950 shadow-[0_4px_0_#166534] active:translate-y-[3px] active:shadow-none"
              onClick={() => window.location.reload()}
            >
              Coba lagi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
