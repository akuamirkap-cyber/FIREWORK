import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { FireType, ModelId } from "../game/config";

type Part = [number, number, number, number, number, number, number];

/** Lazily mount WebGL previews so a long shop list never exhausts mobile GPU contexts. */
export default function FireVisual({ type }: { type: FireType }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "100px 0px" }
    );
    observer.observe(wrap.current!);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={wrap} className="fire-model-3d" aria-hidden="true">
      {visible && <ActualFireVisual type={type} />}
    </div>
  );
}

interface Preview {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  model: THREE.Group;
  pad: THREE.Mesh;
  started: number;
}

// One offscreen WebGL context serves every visible merchandise preview. Creating
// a context per row eventually evicted the main game context on mobile browsers.
let previewRenderer: THREE.WebGLRenderer | null = null;
let previewRaf = 0;
const previews = new Set<Preview>();

function getPreviewRenderer() {
  if (previewRenderer) return previewRenderer;
  previewRenderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
    preserveDrawingBuffer: true,
  });
  previewRenderer.setPixelRatio(1);
  previewRenderer.setSize(96, 76, false);
  previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
  previewRenderer.shadowMap.enabled = true;
  return previewRenderer;
}

function previewLoop(now: number) {
  const renderer = getPreviewRenderer();
  for (const p of previews) {
    const t = (now - p.started) / 1000;
    p.model.rotation.y = -0.55 + t * 0.45;
    p.model.position.y = Math.sin(t * 2.2) * 0.025;
    renderer.render(p.scene, p.camera);
    const ctx = p.canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 96, 76);
      ctx.drawImage(renderer.domElement, 0, 0, 96, 76);
    }
  }
  previewRaf = previews.size ? requestAnimationFrame(previewLoop) : 0;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach((m) => m.dispose());
  });
}

/** Actual 3D model, copied from the single shared renderer into this 2D canvas. */
function ActualFireVisual({ type }: { type: FireType }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 96 / 76, 0.1, 30);
    camera.position.set(3.2, 2.5, 4.6);
    camera.lookAt(0, 0.65, 0);
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x34205e, 2.1));
    const key = new THREE.DirectionalLight(0xfff3d2, 3.2);
    key.position.set(-3, 6, 4);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.PointLight(0x76e8ff, 10, 8);
    rim.position.set(3, 2, -3);
    scene.add(rim);
    const model = makeModel(type.model);
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    model.position.sub(center);
    model.position.y += size.y * 0.5;
    model.scale.setScalar(1.65 / Math.max(size.x, size.y, size.z));
    model.rotation.set(-0.1, -0.55, 0);
    scene.add(model);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.82, 0.09, 16),
      new THREE.MeshStandardMaterial({ color: 0x25124d, roughness: 0.55, metalness: 0.15 })
    );
    pad.position.y = -0.08;
    pad.receiveShadow = true;
    scene.add(pad);
    const entry: Preview = { canvas: canvas.current!, scene, camera, model, pad, started: performance.now() };
    previews.add(entry);
    if (!previewRaf) previewRaf = requestAnimationFrame(previewLoop);
    return () => {
      previews.delete(entry);
      disposeObject(model);
      disposeObject(pad);
    };
  }, [type.model]);
  return <canvas ref={canvas} width={96} height={76} className="h-full w-full" />;
}

function makeModel(id: ModelId) {
  const g = new THREE.Group();
  parts(id).forEach(([hex, sx, sy, sz, x, y, z]) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(sx, sy, sz),
      new THREE.MeshStandardMaterial({ color: hex, roughness: 0.48, metalness: 0.08 })
    );
    m.position.set(x, y + sy / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  });
  return g;
}

function parts(id: ModelId): Part[] {
  switch (id) {
    case "cabe": return [[0xe3262e,.36,.82,.36,0,0,0],[0xffc533,.4,.1,.4,0,.12,0],[0xffc533,.4,.1,.4,0,.58,0],[0xfff1c9,.22,.22,.38,0,.31,0],[0x3b2a1a,.07,.34,.07,0,.86,0]];
    case "kertas": return [[0xff3b6b,.38,.17,.38,0,0,0],[0xffd23f,.38,.17,.38,0,.17,0],[0x3bd6ff,.38,.17,.38,0,.34,0],[0x5dff7a,.38,.17,.38,0,.51,0],[0xc77dff,.38,.17,.38,0,.68,0],[0xffffff,.55,.08,.13,0,.85,0],[0x3b2a1a,.07,.3,.07,0,.91,0]];
    case "gasing": return [[0x6b7280,.1,.14,.1,0,0,0],[0x14b8a6,.3,.14,.3,0,.14,0],[0xf43f5e,.52,.14,.52,0,.28,0],[0xfacc15,.7,.12,.7,0,.42,0],[0x14b8a6,.82,.14,.82,0,.54,0],[0xffffff,.88,.15,.16,0,.535,0],[0xf43f5e,.56,.12,.56,0,.68,0],[0x3b2a1a,.07,.34,.07,0,.94,0]];
    case "bambu": return [[0xb9d24f,.64,.5,.64,0,0,0],[0x6f8f2a,.72,.1,.72,0,.5,0],[0xa9c640,.64,.45,.64,0,.6,0],[0x6f8f2a,.72,.1,.72,0,1.05,0],[0x3b2a1a,.08,.36,.08,0,1.15,0]];
    case "tnt": return [[0xd1281f,.28,.96,.28,-.3,0,0],[0xd1281f,.28,.96,.28,0,0,0],[0xd1281f,.28,.96,.28,.3,0,0],[0x262626,.94,.16,.34,0,.4,0],[0x3b2a1a,.07,.46,.07,0,.95,0]];
    case "rocket": return [[0xc9a26a,.07,1,.07,0,0,0],[0xf4f4f4,.3,.9,.3,0,.8,0],[0xe63946,.34,.18,.34,0,1.15,0],[0xe63946,.22,.2,.22,0,1.7,0],[0xe63946,.12,.16,.12,0,1.9,0],[0x2a9df4,.64,.18,.1,0,.8,0],[0x2a9df4,.1,.18,.64,0,.8,0]];
    case "nuke": return [[0x2d3748,1.1,.8,.9,0,.2,0],[0x2d3748,.9,.8,1.1,0,.2,0],[0x2d3748,.9,1.1,.9,0,.05,0],[0xffd60a,1.14,.16,1.14,0,.5,0],[0x8895a7,.5,.15,.5,0,1.15,0],[0x3b2a1a,.1,.55,.1,0,1.3,0]];
    case "fountain": return [[0x2563eb,.46,.58,.46,0,0,0],[0xfacc15,.5,.08,.5,0,.1,0],[0xfacc15,.5,.08,.5,0,.4,0],[0xe11d48,.32,.14,.32,0,.58,0],[0x3b2a1a,.06,.3,.06,.15,.7,0]];
    case "kodok": return [[0x4ade80,.66,.36,.66,0,.12,0],[0xd9f99d,.52,.16,.52,0,.12,.1],[0x22c55e,.52,.22,.52,0,.48,-.04],[0xffffff,.2,.2,.2,-.2,.62,.14],[0xffffff,.2,.2,.2,.2,.62,.14],[0x111111,.09,.09,.09,-.2,.68,.25],[0x111111,.09,.09,.09,.2,.68,.25],[0x16a34a,.18,.28,.42,-.4,0,-.1],[0x16a34a,.18,.28,.42,.4,0,-.1]];
    case "petir": return [[0x1e293b,.64,.2,.64,0,0,0],[0x334155,.36,.52,.36,0,.2,0],[0xfacc15,.46,.06,.46,0,.32,0],[0xfacc15,.46,.06,.46,0,.52,0],[0x38bdf8,.56,.1,.56,0,.72,0],[0x7dd3fc,.36,.36,.36,0,.82,0],[0xe0f2fe,.18,.18,.18,0,.92,0]];
    case "lubang": return [[0x0b0614,.64,.64,.64,0,.12,0],[0x4c1d95,.74,.14,.74,0,.38,0],[0xa855f7,1,.07,1,0,.42,0],[0x67e8f9,.11,.11,.11,.58,.4,0],[0xf0abfc,.11,.11,.11,-.58,.4,0]];
    case "ufo": return [[0x334155,.98,.18,.98,0,.12,0],[0x22d3ee,1.18,.1,.64,0,.26,0],[0xa5f3fc,.58,.32,.58,0,.36,0],[0xa3e635,.13,.13,.13,-.4,.25,.24],[0xe879f9,.13,.13,.13,0,.25,.32],[0xa3e635,.13,.13,.13,.4,.25,.24]];
    case "naga": return [[0xef4444,.58,.42,.58,.38,.12,0],[0xf97316,.46,.34,.46,-.1,.1,0],[0xf97316,.4,.3,.4,-.52,.08,0],[0xf97316,.34,.26,.34,-.88,.06,0],[0xffffff,.12,.12,.12,.55,.43,.22],[0xffffff,.12,.12,.12,.55,.43,-.22],[0x111111,.055,.055,.055,.59,.46,.28],[0x111111,.055,.055,.055,.59,.46,-.28],[0xf9a8d4,.3,.04,.06,.82,.2,0],[0x3b2a1a,.06,.28,.06,-1.08,.12,0]];
    case "disco": return [[0x64748b,.1,.45,.1,0,0,0],[0x334155,.52,.1,.52,0,0,0],[0xd946ef,.72,.72,.72,0,.45,0],[0x38bdf8,.22,.22,.74,0,.45,0],[0xfacc15,.74,.22,.22,0,.45,0],[0x4ade80,.36,.36,.76,0,.45,0]];
    case "drill": return [[0x475569,.66,.35,.66,0,.92,0],[0x22d3ee,.72,.08,.72,0,.96,0],[0xf59e0b,.7,.18,.7,0,.74,0],[0xfbbf24,.56,.2,.56,0,.54,0],[0xf59e0b,.42,.22,.42,0,.32,0],[0xd97706,.27,.24,.27,0,.08,0],[0x64748b,.12,.22,.12,0,-.14,0],[0x3b2a1a,.06,.3,.06,.2,1.28,0]];
    case "gorilla": return [[0x303640,.78,.65,.48,0,.75,0],[0x59616e,.62,.52,.52,0,1.25,.03],[0x8a929d,.42,.26,.5,0,1.16,.25],[0x15191f,.07,.07,.05,-.11,1.42,.3],[0x15191f,.07,.07,.05,.11,1.42,.3],[0x303640,.34,.92,.34,-.55,.55,0],[0x303640,.34,.92,.34,.55,.55,0],[0x20252c,.32,.72,.38,-.22,.05,0],[0x20252c,.32,.72,.38,.22,.05,0],[0x3b2a1a,.06,.28,.06,0,1.58,0]];
    case "ants": return [[0x171717,.32,.24,.32,-.32,.15,0],[0xef4444,.38,.28,.38,0,.15,0],[0x171717,.3,.25,.3,.34,.15,0],[0xfacc15,.07,.07,.07,.43,.25,.15],[0x171717,.5,.05,.05,0,.08,0],[0x171717,.05,.05,.5,0,.08,0],[0x3b2a1a,.05,.25,.05,-.4,.32,0]];
  }
}