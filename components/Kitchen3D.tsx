"use client";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useState } from "react";
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

export default function Kitchen3D({ products, layout, stock, status, overlay, dietary, highlights, selected, onSelect, focusZone }: KitchenProps) {
  const [hover, setHover] = useState<{ id: string; pos: THREE.Vector3 } | null>(null);
  const [doors, setDoors] = useState<Record<string, boolean>>({ drink_fridge: false, fresh_fridge: false });
  const hp = hover && products.find((p) => p.id === hover.id);
  const hs = hover ? status[hover.id] ?? NONE : null;
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: STATIONS.overview.pos, fov: 55, near: 0.05, far: 60 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => setHover(null)}
    >
      <color attach="background" args={["#f4f2f0"]} />
      <fog attach="fog" args={["#efe9e0", 14, 30]} />
      <hemisphereLight args={["#fff6e8", "#8a7560", 0.95]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[6, 9, 7]} intensity={1.5} color="#fff1dc" castShadow
        shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004}
        shadow-camera-left={-11} shadow-camera-right={11} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-camera-near={1} shadow-camera-far={30}
      />
      <directionalLight position={[5.8, 2.6, -4]} intensity={0.5} color="#dcecff" />
      <Room doors={doors} toggleDoor={(z) => setDoors((d) => ({ ...d, [z]: !d[z] }))} />
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
            onHover={(id, pos) => setHover(id && pos ? { id, pos } : null)}
          />
        );
      })}
      {hp && hs && (
        <Html position={hover!.pos} center zIndexRange={[20, 0]} style={{ transform: "translateY(-60%)" }}>
          <div style={tipStyle}>
            <div style={{ fontSize: 14 }}>{hp.name}</div>
            <div style={{ ...micro, marginBottom: 6 }}>{hp.brand}</div>
            <Row k="In stock" v={`${stock[hp.id] ?? 0}${hs.lowStock ? " · low" : ""}`} />
            <Row k="Expires" v={hs.daysToExpiry === null ? "–" : `${hs.daysToExpiry} days`} alert={hs.nearExpiry} />
            <Row k="Rating" v={`${Math.round(hs.netRating * 100)}% net`} />
            <Row k="Eaten" v={`${hs.perDay.toFixed(1)} / day`} />
          </div>
        </Html>
      )}
      <Player focusZone={focusZone} />
    </Canvas>
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
