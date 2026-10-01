"use client";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OC } from "three-stdlib";
import type { Snapshot } from "@/lib/snapshot";
import type { Product, Zone } from "@/lib/types";

export type Overlay = "none" | "heatmap" | "waste" | "dietary";
type Props = {
  data: Snapshot; zone: Zone | "overview"; overlay: Overlay; dietary: string; highlights: Map<string, number> | null;
  selected: string | null; onSelect: (id: string) => void;
};

const ZONES: Record<Zone, { origin: [number, number, number]; width: number; shelfY: number[]; slots: number; depth: number }> = {
  drink_fridge: { origin: [-6.2, 0, -1.6], width: 1.8, shelfY: [0.3, 1.0, 1.7, 2.4], slots: 3, depth: 0.75 },
  fresh_fridge: { origin: [-3.6, 0, -1.6], width: 1.8, shelfY: [0.3, 1.0, 1.7, 2.4], slots: 3, depth: 0.75 },
  pantry: { origin: [-1.3, 0, -1.7], width: 3.6, shelfY: [0.3, 0.9, 1.5, 2.1], slots: 6, depth: 0.45 },
  coffee_bar: { origin: [3.3, 0, -1.65], width: 2.1, shelfY: [0.92, 1.75], slots: 3, depth: 0.5 },
  fruit_bowl: { origin: [0.05, 0, 2.55], width: 1.1, shelfY: [1.02], slots: 3, depth: 0.5 },
  freezer: { origin: [6.2, 0, -1.25], width: 1.6, shelfY: [0.45], slots: 3, depth: 0.6 },
};
export const CAMERAS: Record<Zone | "overview", { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [0.8, 5.2, 12.5], target: [0.8, 1.0, 0] },
  drink_fridge: { pos: [-5.3, 1.7, 3.6], target: [-5.3, 1.3, -1.2] },
  fresh_fridge: { pos: [-2.7, 1.7, 3.6], target: [-2.7, 1.3, -1.2] },
  pantry: { pos: [0.5, 1.6, 3.4], target: [0.5, 1.2, -1.5] },
  coffee_bar: { pos: [4.35, 1.8, 2.0], target: [4.35, 1.2, -1.4] },
  fruit_bowl: { pos: [0.6, 2.3, 4.6], target: [0.6, 1.0, 2.8] },
  freezer: { pos: [7.0, 2.7, 1.5], target: [7.0, 0.5, -0.9] },
};

const SIZE: Record<Product["model3d"]["shape"], [number, number, number]> = {
  can: [0.13, 0.2, 0.13], bottle: [0.13, 0.3, 0.13], bag: [0.2, 0.26, 0.07], box: [0.18, 0.24, 0.08], bar: [0.17, 0.045, 0.07], fruit: [0.15, 0.15, 0.15], cup: [0.14, 0.1, 0.14],
};

function labelTexture(p: Product) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = p.model3d.color; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(0, 84, 128, 44);
  g.font = "56px serif"; g.textAlign = "center"; g.fillText(p.emoji, 64, 66);
  g.fillStyle = "#111"; g.font = "bold 15px sans-serif";
  g.fillText(p.name.split(" ").slice(0, 2).join(" ").slice(0, 14), 64, 104);
  g.font = "11px sans-serif"; g.fillText(p.brand.slice(0, 16), 64, 120);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function geometryFor(shape: Product["model3d"]["shape"]) {
  const [w, h, d] = SIZE[shape];
  switch (shape) {
    case "can": return new THREE.CylinderGeometry(w / 2, w / 2, h, 20);
    case "bottle": { const pts = [[0, 0], [0.065, 0], [0.065, 0.19], [0.03, 0.25], [0.025, 0.3], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y - h / 2)); return new THREE.LatheGeometry(pts, 20); }
    case "fruit": return new THREE.SphereGeometry(w / 2, 18, 14);
    case "cup": return new THREE.CylinderGeometry(w / 2, w / 2.6, h, 20);
    default: return new THREE.BoxGeometry(w, h, d);
  }
}

function unitPositions(p: Product, loc: { zone: Zone; shelf: number; slot: number }, count: number) {
  const z = ZONES[loc.zone];
  const [w, h, d] = SIZE[p.model3d.shape];
  const slotW = z.width / z.slots;
  const x0 = z.origin[0] + loc.slot * slotW + 0.06;
  const y0 = z.shelfY[Math.min(loc.shelf, z.shelfY.length - 1)];
  const cols = Math.max(1, Math.floor((slotW - 0.08) / (w + 0.02)));
  const rows = Math.max(1, Math.floor(z.depth / (d + 0.03)));
  const out: [number, number, number][] = [];
  const max = Math.min(count, cols * rows * (h < 0.12 ? 4 : 2));
  for (let i = 0; i < max; i++) {
    const layer = Math.floor(i / (cols * rows)), r = Math.floor((i % (cols * rows)) / cols), c = i % cols;
    const jitter = loc.zone === "fruit_bowl" ? Math.sin(i * 12.9) * 0.03 : 0;
    out.push([x0 + c * (w + 0.02) + w / 2 + jitter, y0 + h / 2 + layer * (h + 0.005), z.origin[2] + z.depth - (r * (d + 0.03) + d / 2) - 0.02]);
  }
  return out;
}

function heat(t: number) { return new THREE.Color().setHSL(0.66 - 0.66 * t, 0.9, 0.5); }

function ProductStack({ p, data, overlay, dietary, highlight, dimmed, selected, onSelect, onHover }: {
  p: Product; data: Snapshot; overlay: Overlay; dietary: string; highlight: number | null; dimmed: boolean; selected: boolean;
  onSelect: (id: string) => void; onHover: (id: string | null, pos?: THREE.Vector3) => void;
}) {
  const s = data.stats.find((x) => x.productId === p.id)!;
  const batches = data.inventory.filter((b) => b.productId === p.id);
  const geom = useMemo(() => geometryFor(p.model3d.shape), [p.model3d.shape]);
  const tex = useMemo(() => labelTexture(p), [p]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: p.model3d.shape === "can" ? 0.3 : 0.6, metalness: p.model3d.shape === "can" ? 0.4 : 0, transparent: true }), [tex, p.model3d.shape]);
  const ranks = useMemo(() => { const r = [...data.stats].sort((a, b) => a.rate - b.rate); return r.findIndex((x) => x.productId === p.id) / r.length; }, [data.stats, p.id]);
  const loc = batches[0]?.location;
  const positions = useMemo(() => (loc ? unitPositions(p, loc, s.stock) : []), [p, loc, s.stock]);

  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4);
    mat.color.set("#ffffff"); mat.emissive.set("#000000"); mat.emissiveIntensity = 1; mat.opacity = 1;
    if (overlay === "heatmap") { mat.color.copy(heat(ranks)); mat.emissive.copy(heat(ranks)).multiplyScalar(0.25); }
    else if (overlay === "waste") { const d = s.daysToExpiry ?? 999; mat.color.set(d <= 3 ? "#ff3b30" : d <= 10 ? "#ffb020" : "#9aa3ad"); }
    else if (overlay === "dietary" && dietary && !p.dietaryTags.includes(dietary as never)) mat.opacity = 0.12;
    if (overlay === "none" || overlay === "dietary") {
      if (s.nearExpiry) mat.emissive.set("#ff2a1a").multiplyScalar(0.35 + 0.45 * pulse);
      else if (s.lowStock) mat.emissive.set("#ffa000").multiplyScalar(0.45);
    }
    if (highlight !== null) mat.emissive.set("#22d3ee").multiplyScalar(0.5 + 0.5 * pulse);
    if (dimmed) mat.opacity = 0.15;
    if (selected) mat.emissive.set("#a78bfa").multiplyScalar(0.6 + 0.3 * pulse);
  });

  if (!positions.length) return null;
  const top = positions.reduce((a, b) => (b[1] > a[1] ? b : a));
  return (
    <group
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(p.id, new THREE.Vector3(top[0], top[1] + 0.25, top[2])); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(p.id); }}
    >
      {positions.map((pos, i) => <mesh key={i} geometry={geom} material={mat} position={pos} castShadow />)}
      {(s.eatFirst || (s.daysToExpiry !== null && s.daysToExpiry <= 1.5 && overlay !== "heatmap")) && (
        <Html position={[top[0], top[1] + 0.2, top[2]]} center distanceFactor={6} zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">eat me first</div>
        </Html>
      )}
    </group>
  );
}

function Fridge({ zone, open, onToggle, tint }: { zone: Zone; open: boolean; onToggle: () => void; tint: string }) {
  const z = ZONES[zone];
  const [x, , zz] = z.origin;
  const door = useRef<THREE.Group>(null);
  useFrame(() => { if (door.current) door.current.rotation.y = THREE.MathUtils.lerp(door.current.rotation.y, open ? -1.9 : 0, 0.12); });
  const W = z.width + 0.2, H = 2.95, D = z.depth + 0.15;
  const panel = <meshStandardMaterial color={tint} roughness={0.35} metalness={0.5} />;
  return (
    <group>
      <mesh position={[x + z.width / 2, H / 2, zz - 0.05]} receiveShadow><boxGeometry args={[W, H, 0.05]} />{panel}</mesh>
      <mesh position={[x - 0.075, H / 2, zz + D / 2 - 0.05]}><boxGeometry args={[0.05, H, D]} />{panel}</mesh>
      <mesh position={[x + z.width + 0.075, H / 2, zz + D / 2 - 0.05]}><boxGeometry args={[0.05, H, D]} />{panel}</mesh>
      <mesh position={[x + z.width / 2, H, zz + D / 2 - 0.05]}><boxGeometry args={[W, 0.08, D]} />{panel}</mesh>
      <mesh position={[x + z.width / 2, 0.12, zz + D / 2 - 0.05]}><boxGeometry args={[W, 0.24, D]} />{panel}</mesh>
      {z.shelfY.map((y) => <mesh key={y} position={[x + z.width / 2, y - 0.012, zz + z.depth / 2]}><boxGeometry args={[z.width, 0.02, z.depth]} /><meshStandardMaterial color="#dbeafe" transparent opacity={0.55} /></mesh>)}
      <pointLight position={[x + z.width / 2, H - 0.25, zz + 0.4]} intensity={6} distance={3.5} color="#e0f2fe" />
      <group ref={door} position={[x - 0.1, 0, zz + D - 0.03]} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        <mesh position={[W / 2, H / 2, 0]}><boxGeometry args={[W, H, 0.04]} /><meshStandardMaterial color="#cfe8ff" roughness={0.05} metalness={0.2} transparent opacity={0.12} depthWrite={false} /></mesh>
        <mesh position={[W - 0.12, H / 2, 0.06]}><boxGeometry args={[0.04, 0.9, 0.06]} /><meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} /></mesh>
      </group>
      <Html position={[x + z.width / 2, H + 0.25, zz + 0.3]} center zIndexRange={[5, 0]}><div className="pointer-events-none whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">{zone === "drink_fridge" ? "🥤 Drink fridge" : "🥗 Fresh fridge"}</div></Html>
    </group>
  );
}

function Furniture({ doors, toggle }: { doors: Record<string, boolean>; toggle: (z: Zone) => void }) {
  const P = ZONES.pantry, C = ZONES.coffee_bar, F = ZONES.freezer;
  const wood = <meshStandardMaterial color="#b98552" roughness={0.8} />;
  const label = (text: string, pos: [number, number, number]) => <Html position={pos} center zIndexRange={[5, 0]}><div className="pointer-events-none whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">{text}</div></Html>;
  return (
    <group>
      {/* room */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[22, 14]} /><meshStandardMaterial color="#e7e1d8" /></mesh>
      <mesh position={[0.6, 2, -1.75]}><planeGeometry args={[22, 4]} /><meshStandardMaterial color="#f4efe7" /></mesh>
      <mesh position={[0.6, 3.2, -1.74]}><planeGeometry args={[22, 0.04]} /><meshStandardMaterial color="#d6cfc4" /></mesh>
      <Fridge zone="drink_fridge" open={doors.drink_fridge} onToggle={() => toggle("drink_fridge")} tint="#4b5563" />
      <Fridge zone="fresh_fridge" open={doors.fresh_fridge} onToggle={() => toggle("fresh_fridge")} tint="#e5e7eb" />
      {/* pantry shelving */}
      {P.shelfY.map((y) => <mesh key={y} position={[P.origin[0] + P.width / 2, y - 0.02, P.origin[2] + P.depth / 2]} castShadow receiveShadow><boxGeometry args={[P.width + 0.1, 0.04, P.depth]} />{wood}</mesh>)}
      {[0, P.width].map((dx) => <mesh key={dx} position={[P.origin[0] + dx, 1.25, P.origin[2] + P.depth / 2]}><boxGeometry args={[0.05, 2.5, P.depth]} />{wood}</mesh>)}
      {label("🥨 Pantry", [P.origin[0] + P.width / 2, 2.75, P.origin[2] + 0.3])}
      {/* coffee bar */}
      <mesh position={[C.origin[0] + C.width / 2, 0.45, C.origin[2] + C.depth / 2]} castShadow receiveShadow><boxGeometry args={[C.width + 0.1, 0.9, C.depth + 0.1]} /><meshStandardMaterial color="#374151" /></mesh>
      <mesh position={[C.origin[0] + C.width / 2, 0.91, C.origin[2] + C.depth / 2]}><boxGeometry args={[C.width + 0.15, 0.03, C.depth + 0.15]} /><meshStandardMaterial color="#f8fafc" roughness={0.2} /></mesh>
      <mesh position={[C.origin[0] + C.width / 2, 1.73, C.origin[2] + C.depth / 2]}><boxGeometry args={[C.width, 0.04, C.depth]} />{wood}</mesh>
      <RoundedBox args={[0.45, 0.6, 0.4]} radius={0.04} position={[C.origin[0] + C.width - 0.3, 1.23, C.origin[2] + 0.25]}><meshStandardMaterial color="#111827" metalness={0.6} roughness={0.3} /></RoundedBox>
      {label("☕ Coffee bar", [C.origin[0] + C.width / 2, 2.3, C.origin[2] + 0.3])}
      {/* island + fruit bowl */}
      <mesh position={[0.6, 0.47, 2.8]} castShadow receiveShadow><boxGeometry args={[2.6, 0.94, 1.1]} /><meshStandardMaterial color="#f1f5f9" /></mesh>
      <mesh position={[0.6, 0.96, 2.8]}><boxGeometry args={[2.7, 0.04, 1.2]} /><meshStandardMaterial color="#cbd5e1" roughness={0.15} metalness={0.1} /></mesh>
      <mesh position={[0.6, 1.0, 2.8]} rotation={[Math.PI, 0, 0]}><sphereGeometry args={[0.7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#c2410c" side={THREE.DoubleSide} transparent opacity={0.35} /></mesh>
      {label("🍌 Fruit bowl", [0.6, 1.6, 2.8])}
      {/* chest freezer */}
      <mesh position={[F.origin[0] + F.width / 2, 0.21, F.origin[2] + F.depth / 2]} castShadow><boxGeometry args={[F.width + 0.2, 0.42, F.depth + 0.2]} /><meshStandardMaterial color="#f8fafc" /></mesh>
      {[-1, 1].map((s) => <mesh key={`x${s}`} position={[F.origin[0] + F.width / 2 + (s * (F.width + 0.2)) / 2, 0.45, F.origin[2] + F.depth / 2]}><boxGeometry args={[0.04, 0.9, F.depth + 0.2]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}
      {[-1, 1].map((s) => <mesh key={`z${s}`} position={[F.origin[0] + F.width / 2, 0.45, F.origin[2] + F.depth / 2 + (s * (F.depth + 0.2)) / 2]}><boxGeometry args={[F.width + 0.2, 0.9, 0.04]} /><meshStandardMaterial color="#f8fafc" /></mesh>)}
      <mesh position={[F.origin[0] + F.width / 2, 0.91, F.origin[2] + F.depth / 2]}><boxGeometry args={[F.width + 0.2, 0.02, F.depth + 0.2]} /><meshStandardMaterial color="#e0f2fe" transparent opacity={0.12} depthWrite={false} /></mesh>
      {label("🍦 Freezer", [F.origin[0] + F.width / 2, 1.3, F.origin[2] + 0.3])}
    </group>
  );
}

function CameraRig({ zone }: { zone: Zone | "overview" }) {
  const ctl = useRef<OC>(null);
  const last = useRef<string>("");
  const moving = useRef(0);
  useFrame(({ camera }) => {
    if (last.current !== zone) { last.current = zone; moving.current = 70; }
    if (moving.current > 0 && ctl.current) {
      const c = CAMERAS[zone];
      camera.position.lerp(new THREE.Vector3(...c.pos), 0.08);
      ctl.current.target.lerp(new THREE.Vector3(...c.target), 0.08);
      ctl.current.update();
      moving.current--;
    }
  });
  return <OrbitControls ref={ctl as never} makeDefault maxPolarAngle={Math.PI / 2.05} minDistance={1} maxDistance={16} />;
}

export default function Kitchen3D({ data, zone, overlay, dietary, highlights, selected, onSelect }: Props) {
  const [hover, setHover] = useState<{ id: string; pos: THREE.Vector3 } | null>(null);
  const [doors, setDoors] = useState<Record<string, boolean>>({ drink_fridge: false, fresh_fridge: false });
  const hp = hover && data.products.find((p) => p.id === hover.id);
  const hs = hover && data.stats.find((s) => s.productId === hover.id);
  return (
    <Canvas shadows camera={{ position: CAMERAS.overview.pos, fov: 45 }} onPointerMissed={() => setHover(null)}>
      <color attach="background" args={["#f6f3ee"]} />
      <hemisphereLight intensity={0.7} groundColor="#b9a58f" />
      <directionalLight position={[4, 8, 6]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} />
      <Furniture doors={doors} toggle={(z) => setDoors((d) => ({ ...d, [z]: !d[z] }))} />
      {data.products.map((p) => (
        <ProductStack key={p.id} p={p} data={data} overlay={overlay} dietary={dietary}
          highlight={highlights?.get(p.id) ?? null} dimmed={!!highlights && !highlights.has(p.id)} selected={selected === p.id}
          onSelect={onSelect} onHover={(id, pos) => setHover(id && pos ? { id, pos } : null)} />
      ))}
      {hp && hs && (
        <Html position={hover!.pos} center zIndexRange={[20, 0]}>
          <div className="pointer-events-none w-48 rounded-lg bg-white/95 p-2 text-xs text-slate-800 shadow-xl ring-1 ring-black/10">
            <div className="font-semibold">{hp.emoji} {hp.name}</div>
            <div>Stock: <b>{hs.stock}</b>{hs.lowStock && <span className="ml-1 text-amber-600">low</span>}</div>
            <div>Expires in: <b className={hs.nearExpiry ? "text-red-600" : ""}>{hs.daysToExpiry ?? "–"} days</b></div>
            <div>Rating: <b>{Math.round(hs.netRating * 100)}%</b> net ({hs.votes} votes)</div>
            <div>Velocity: <b>{hs.perDay.toFixed(1)}</b>/day</div>
          </div>
        </Html>
      )}
      <ContactShadows position={[0, 0.005, 0]} opacity={0.35} scale={22} blur={2.5} far={4} />
      <CameraRig zone={zone} />
    </Canvas>
  );
}
