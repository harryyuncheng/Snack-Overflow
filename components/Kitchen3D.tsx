"use client";
import { Canvas } from "@react-three/fiber";
import { memo, useCallback, useRef, useState } from "react";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import type { Product, Zone } from "@/lib/types";
import type { Location } from "@/lib/layout";
import Room from "./kitchen/Room";
import Player from "./kitchen/Player";
import { ProductUnits } from "./kitchen/Products";
import { STATIONS } from "./kitchen/zones";

export type Overlay = "none" | "heatmap" | "waste" | "dietary";
export type ItemStatus = { lowStock: boolean; nearExpiry: boolean; eatFirst: boolean; heat: number; netRating: number; daysToExpiry: number | null; perDay: number };
export type KitchenProps = {
  products: Product[];
  layout: Record<string, Location>;
  stock: Record<string, number>;
  status: Record<string, ItemStatus>;
  overlay: Overlay; dietary: string;
  highlights: Map<string, number> | null;
  selected: string | null; onSelect: (id: string) => void;
  focusZone: Zone | "overview";
};

const tipStyle: React.CSSProperties = {
  pointerEvents: "none", width: 200, background: "#ffffff", color: "#0c0a08", border: "1px solid #e5e7eb", borderRadius: 12,
  padding: "10px 12px", fontSize: 12, lineHeight: 1.45, fontWeight: 400,
};
const micro: React.CSSProperties = { fontSize: 10, letterSpacing: "0.018em", textTransform: "uppercase", color: "#6d6c6b" };

const NONE: ItemStatus = { lowStock: false, nearExpiry: false, eatFirst: false, heat: 0, netRating: 0, daysToExpiry: null, perDay: 0 };

type Hover = { id: string; pos: THREE.Vector3 } | null;
type SceneProps = Omit<KitchenProps, "focusZone"> & { onHover: (h: Hover) => void };

/** Everything inside the Canvas; memoized so hover/tooltip changes never re-render the 3D tree. */
const Scene = memo(function Scene({ products, layout, stock, status, overlay, dietary, highlights, selected, onSelect, onHover }: SceneProps) {
  const [doors, setDoors] = useState<Record<string, boolean>>({ drink_fridge: false, fresh_fridge: false, freezer: false });
  const toggleDoor = useCallback((z: Zone) => setDoors((d) => ({ ...d, [z]: !d[z] })), []);
  const hoverCb = useCallback((id: string | null, pos?: THREE.Vector3) => onHover(id && pos ? { id, pos } : null), [onHover]);
  return (
    <>
      <color attach="background" args={["#f4f2f0"]} />
      <fog attach="fog" args={["#efe9e0", 14, 30]} />
      <hemisphereLight args={["#fff6e8", "#8a7560", 0.95]} />
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[6, 9, 7]} intensity={1.5} color="#fff1dc" castShadow
        shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
        shadow-camera-left={-11} shadow-camera-right={11} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-camera-near={1} shadow-camera-far={30}
      />
      <directionalLight position={[5.8, 2.6, -4]} intensity={0.5} color="#dcecff" />
      <Room doors={doors} toggleDoor={toggleDoor} />
      {products.map((p) => {
        const loc = layout[p.id];
        if (!loc) return null;
        const s = status[p.id] ?? NONE;
        return (
          <ProductUnits
            key={p.id} p={p} loc={loc} stock={stock[p.id] ?? 0} price={p.brand}
            visual={{
              lowStock: s.lowStock, nearExpiry: s.nearExpiry, heat: s.heat, daysToExpiry: s.daysToExpiry,
              showTag: overlay !== "heatmap" && (s.eatFirst || (s.daysToExpiry !== null && s.daysToExpiry <= 1.5)),
              overlay, dietaryMatch: !dietary || p.dietaryTags.includes(dietary as never),
              highlight: !!highlights?.has(p.id), dimmed: !!highlights && !highlights.has(p.id), selected: selected === p.id,
            }}
            onSelect={onSelect}
            onHover={hoverCb}
          />
        );
      })}
    </>
  );
});

export default function Kitchen3D({ focusZone, ...scene }: KitchenProps) {
  const [hover, setHover] = useState<Hover>(null);
  const [dpr, setDpr] = useState(1.5);
  const tip = useRef<HTMLDivElement>(null);
  const hp = hover && scene.products.find((p) => p.id === hover.id);
  const hs = hover ? scene.status[hover.id] ?? NONE : null;
  // tooltip is plain DOM over the canvas, moved via ref so mouse moves don't re-render React
  return (
    <div className="relative h-full w-full" onPointerMove={(e) => {
      const el = tip.current; if (!el) return;
      const r = e.currentTarget.getBoundingClientRect();
      el.style.transform = `translate(${e.clientX - r.left + 16}px, ${e.clientY - r.top + 16}px)`;
    }}>
      <Canvas
        shadows
        dpr={dpr}
        camera={{ position: STATIONS.overview.pos, fov: 55, near: 0.05, far: 60 }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onPointerMissed={() => setHover(null)}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={3} onFallback={() => setDpr(1)} />
        <Scene {...scene} onHover={setHover} />
        <Player focusZone={focusZone} />
      </Canvas>
      <div ref={tip} style={{ ...tipStyle, position: "absolute", left: 0, top: 0, zIndex: 20, display: hp && hs ? "block" : "none", willChange: "transform" }}>
        {hp && hs && (
          <>
            <div style={{ fontSize: 14 }}>{hp.name}</div>
            <div style={{ ...micro, marginBottom: 6 }}>{hp.brand}</div>
            <Row k="In stock" v={`${scene.stock[hp.id] ?? 0}${hs.lowStock ? " · low" : ""}`} />
            <Row k="Expires" v={hs.daysToExpiry === null ? "–" : `${hs.daysToExpiry} days`} alert={hs.nearExpiry} />
            <Row k="Rating" v={`${Math.round(hs.netRating * 100)}% net`} />
            <Row k="Eaten" v={`${hs.perDay.toFixed(1)} / day`} />
          </>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, alert }: { k: string; v: string; alert?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", padding: "3px 0" }}>
      <span style={{ color: "#6d6c6b" }}>{k}</span>
      <span style={alert ? { background: "#e4f222", borderRadius: 6, padding: "0 6px" } : undefined}>{v}</span>
    </div>
  );
}
