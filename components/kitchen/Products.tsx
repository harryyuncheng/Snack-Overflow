"use client";
import LabelSprite from "./LabelSprite";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { MODEL, photoFront, useBakedGeometry } from "./models";
import * as THREE from "three";
import type { Product } from "@/lib/types";
import type { Location } from "@/lib/layout";
import { SLOTS_PER_SHELF } from "@/lib/layout";
import { CAN_IDS } from "@/lib/cans";
import { BOWL, ZONES } from "./zones";
import { labelTexture, loadPhoto, rand, shelfTagTexture } from "./textures";
import { canGeometry, canLabelTexture } from "./cans";

export type Shape = Product["model3d"]["shape"];
export const SIZE: Record<Shape, [number, number, number]> = {
  can: [0.075, 0.135, 0.075], bottle: [0.12, 0.3, 0.12], bag: [0.22, 0.3, 0.085], box: [0.19, 0.27, 0.07], bar: [0.16, 0.065, 0.028], fruit: [0.13, 0.13, 0.13], cup: [0.12, 0.1, 0.12],
};
/** Per-product overrides where the generic shape size reads wrong. */
const SIZE_BY_ID: Record<string, [number, number, number]> = {
  babybel: [0.075, 0.042, 0.075], "red-bull": [0.062, 0.15, 0.062], pringles: [0.085, 0.25, 0.085], bananas: [0.34, 0.2, 0.34], apples: [0.11, 0.11, 0.11], clementines: [0.085, 0.075, 0.085],
};
export const sizeFor = (p: Product): [number, number, number] => SIZE_BY_ID[p.id] ?? SIZE[p.model3d.shape];
const MODEL_FRUIT: Record<string, string> = { bananas: MODEL.bananas, apples: MODEL.apple, clementines: MODEL.lime };
/** bananas come in bunches of ~5 */
const PER_UNIT: Record<string, number> = { bananas: 5 };

/** Resize a centered geometry to exact w/h/d. */
function fit(g: THREE.BufferGeometry, [w, h, d]: [number, number, number]) {
  g.computeBoundingBox();
  const s = g.boundingBox!.getSize(new THREE.Vector3());
  g.scale(w / s.x, h / s.y, d / s.z);
  return g;
}

/** Mini wax cheese wheel: a puck with rounded edges. */
function babybelGeometry([w, h]: [number, number, number]) {
  const r = w / 2, e = h * 0.45, pts: THREE.Vector2[] = [new THREE.Vector2(0, -h / 2)];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI; pts.push(new THREE.Vector2(r - e + Math.cos(a) * e, Math.sin(a) * (h / 2))); }
  pts.push(new THREE.Vector2(0, h / 2));
  return new THREE.LatheGeometry(pts, 28);
}
const MAX_UNITS = 32;
const HIGHLIGHT = new THREE.Color("#e4f222");

export type Visual = {
  lowStock: boolean; nearExpiry: boolean; showTag: boolean; heat: number; daysToExpiry: number | null;
  overlay: "none" | "heatmap" | "waste" | "dietary"; dietaryMatch: boolean; highlight: boolean; dimmed: boolean; selected: boolean;
};

function geometryFor(p: Product): THREE.BufferGeometry {
  const [w, h, d] = sizeFor(p);
  if (p.id === "babybel") return babybelGeometry([w, h, d]);
  switch (p.model3d.shape) {
    case "can": return canGeometry(w, h);
    case "cup": return new THREE.CylinderGeometry(w / 2, w / 2.5, h, 24);
    case "bottle": {
      const pts = [[0, 0], [0.058, 0], [0.06, 0.012], [0.06, 0.19], [0.034, 0.245], [0.022, 0.27], [0.024, 0.3], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y - h / 2));
      return new THREE.LatheGeometry(pts, 24);
    }
    case "fruit": {
      const g = new THREE.SphereGeometry(w / 2, 20, 14);
      if (p.id === "babybel") g.scale(1, 0.62, 1);
      if (p.id === "clementines") g.scale(1, 0.85, 1);
      return g;
    }
    case "bag": {
      // pillowy chip bag: a box with bulged faces and a crimped top
      const g = new THREE.BoxGeometry(w, h, d, 6, 8, 2);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) / (w / 2), y = pos.getY(i) / (h / 2), z = pos.getZ(i);
        const bulge = (1 - x * x) * (1 - Math.pow(Math.abs(y), 3));
        pos.setZ(i, z * (0.35 + 0.9 * bulge));
      }
      g.computeVertexNormals();
      return g;
    }
    default: return new THREE.BoxGeometry(w, h, d);
  }
}

type Unit = { pos: [number, number, number]; rot: [number, number, number] };

/** Deterministic, slightly messy arrangement. Units are ordered back→front, bottom→top so taking stock removes front/top items first. */
function unitLayout(p: Product, loc: Location): Unit[] {
  const [w, h, d] = sizeFor(p);
  const r = (i: number, k: number) => rand(p.id, i, k);
  if (loc.zone === "fruit_bowl") {
    const out: Unit[] = [];
    const a0 = (loc.slot / 3) * Math.PI * 2 + 0.4;
    for (let i = 0; i < MAX_UNITS; i++) {
      const layer = Math.floor(i / 7);
      const a = a0 + (r(i, 0) - 0.5) * 1.9;
      const rad = (0.08 + r(i, 1) * 0.26) * (1 - layer * 0.35);
      out.push({ pos: [BOWL.x + Math.cos(a) * rad, BOWL.y + 0.07 + w / 2 + layer * 0.08 + (0.3 - rad) * 0.25, BOWL.z + Math.sin(a) * rad], rot: p.id === "bananas" ? [(r(i, 2) - 0.5) * 0.4, r(i, 3) * 6, (r(i, 4) - 0.5) * 0.4] : [r(i, 2) * 3, r(i, 3) * 6, r(i, 4) * 3] });
    }
    return out.sort((a, b) => a.pos[1] - b.pos[1]);
  }
  const z = ZONES[loc.zone];
  const slots = SLOTS_PER_SHELF[loc.zone];
  const slotW = z.width / slots;
  // freezer stock sits on the eye-level shelf
  const shelf = loc.zone === "freezer" ? loc.shelf + 1 : loc.shelf;
  const y0 = z.shelfY[Math.min(shelf, z.shelfY.length - 1)];
  const usable = slotW - 0.08;
  const lying = p.id === "babybel";
  const cols = Math.max(1, Math.floor(usable / (w + 0.018)));
  const rows = Math.max(1, Math.floor((z.depth - 0.04) / (d + 0.03)));
  const layers = lying ? 3 : h < 0.21 ? 2 : 1;
  const gap = (usable - cols * w) / Math.max(1, cols);
  const out: Unit[] = [];
  for (let layer = 0; layer < layers; layer++)
    for (let rr = 0; rr < rows; rr++)
      for (let c = 0; c < cols; c++) {
        const row = rows - 1 - rr; // front row first
        const i = out.length;
        if (i >= MAX_UNITS) break;
        const jx = (r(i, 0) - 0.5) * 0.022, jz = (r(i, 1) - 0.5) * 0.025;
        const x = z.origin[0] + loc.slot * slotW + 0.04 + gap / 2 + c * (w + gap) + w / 2 + jx;
        const zz = z.origin[2] + 0.03 + row * (d + 0.03) + d / 2 + jz;
        let y = y0 + h / 2 + layer * (h + 0.004);
        const rot: [number, number, number] = [0, (r(i, 2) - 0.5) * (p.model3d.shape === "can" ? 0.5 : p.model3d.shape === "bottle" || p.model3d.shape === "cup" ? 2.4 : 0.22), 0];
        const front = row === rows - 1 && layer === 0;
        const odd = r(i, 3);
        if (p.model3d.shape === "bag") {
          rot[0] = -0.05 - r(i, 4) * 0.16; // bags slump back
          rot[2] = (r(i, 5) - 0.5) * 0.14;
          if (front && odd < 0.14) { rot[0] = -Math.PI / 2 + 0.05; y = y0 + d / 2; } // knocked over
        } else if ((p.model3d.shape === "can" || p.model3d.shape === "bottle") && front && odd < 0.07 && layers === 1) {
          rot[2] = Math.PI / 2; y = y0 + w / 2; // a can on its side
        } else if (p.model3d.shape === "box" && odd < 0.2) {
          rot[0] = -0.08; // leaning
        }
        if (lying) rot[1] += (r(i, 6) - 0.5) * 0.3;
        out.push({ pos: [x, y, zz], rot });
      }
  return out;
}

function tagPosition(loc: Location): [number, number, number] | null {
  if (loc.zone === "fruit_bowl") return null;
  const z = ZONES[loc.zone];
  const slotW = z.width / SLOTS_PER_SHELF[loc.zone];
  const y = z.shelfY[Math.min(loc.zone === "freezer" ? loc.shelf + 1 : loc.shelf, z.shelfY.length - 1)];
  return [z.origin[0] + loc.slot * slotW + slotW / 2, y - 0.045, z.origin[2] + z.depth + 0.015];
}

const tmp = new THREE.Object3D();
const heatCold = new THREE.Color("#8fa9c4"), heatMid = new THREE.Color("#e4f222"), heatHot = new THREE.Color("#ff4d1a");
const scratch = new THREE.Color();

type Props = {
  p: Product; loc: Location; stock: number; price: string; visual: Visual;
  onHover: (id: string | null, pos?: THREE.Vector3) => void; onSelect: (id: string) => void;
};

export function ProductUnits(props: Props) {
  return <Suspense fallback={null}><ProductUnitsInner {...props} /></Suspense>;
}

function ProductUnitsInner({ p, loc, stock, price, visual, onHover, onSelect }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const units = useMemo(() => unitLayout(p, loc), [p, loc]);
  const shape = p.model3d.shape;
  // CC0 model geometry: Kenney chip bag + candy wrapper, Poly Haven fruit
  const bagModel = useBakedGeometry(MODEL.bag, 1);
  const barModel = useBakedGeometry(MODEL.bar, 1);
  const fruitModel = useBakedGeometry(MODEL_FRUIT[p.id] ?? MODEL.apple, Math.max(...sizeFor(p)));
  const modelFruit = !!MODEL_FRUIT[p.id];
  const photoFace = shape === "bag" || shape === "bar";
  const geom = useMemo(() => {
    if (modelFruit) return fruitModel.geom;
    if (shape === "bag") { const g = bagModel.geom.clone(); g.rotateY(Math.PI / 2); return photoFront(fit(g, sizeFor(p))); }
    if (shape === "bar") { const g = barModel.geom.clone(); g.rotateX(Math.PI / 2); return photoFront(fit(g, sizeFor(p))); }
    return geometryFor(p);
  }, [p, shape, modelFruit, fruitModel, bagModel, barModel]);
  const isFruit = shape === "fruit";
  const mats = useMemo(() => {
    if (modelFruit) {
      const m = (p.id === "clementines"
        ? new THREE.MeshStandardMaterial({ color: "#ff8a1c", roughness: 0.55 })
        : (fruitModel.material.clone() as THREE.MeshStandardMaterial));
      m.transparent = true;
      return { list: [m], label: m, all: [m], base: new Map([[m, m.color.clone()]]) };
    }
    const label = new THREE.MeshStandardMaterial({ map: isFruit ? null : labelTexture(p), color: isFruit ? p.model3d.color : "#ffffff", roughness: shape === "can" ? 0.32 : isFruit ? 0.4 : 0.6, metalness: shape === "can" ? 0.35 : 0, transparent: true });
    const withBase = <T extends { all: THREE.MeshStandardMaterial[] }>(o: T) => ({ ...o, base: new Map(o.all.map((m) => [m, m.color.clone()])) });
    if (photoFace) {
      const side = new THREE.MeshStandardMaterial({ color: p.model3d.color, roughness: shape === "bag" ? 0.38 : 0.55, metalness: shape === "bag" ? 0.25 : 0.1, transparent: true });
      return withBase({ list: [label, side], label, all: [label, side] });
    }
    if (shape === "box") {
      const side = new THREE.MeshStandardMaterial({ color: p.model3d.color, roughness: 0.7, metalness: 0, transparent: true });
      return withBase({ list: [side, side, side, side, label, side], label, all: [label, side] });
    }
    if (shape === "can") {
      // printed aluminium: one drawn brand label wrapped once around the body, metal ends baked into the same texture
      const can = new THREE.MeshStandardMaterial({ map: canLabelTexture(p), roughness: 0.26, metalness: 0.55, transparent: true });
      return withBase({ list: [can], label: can, all: [can] });
    }
    if (shape === "cup") {
      // cups: foil lid shows the photo
      const cap = new THREE.MeshStandardMaterial({ color: "#e9e6df", metalness: 0.6, roughness: 0.3, transparent: true });
      return withBase({ list: [label, label, cap], label, all: [label, cap] });
    }
    return withBase({ list: [label], label, all: [label] });
  }, [p, shape, isFruit, modelFruit, photoFace, fruitModel]);

  // swap in the real product photo when it arrives
  useEffect(() => {
    if (isFruit || modelFruit || shape === "can") return;
    loadPhoto(p, (t) => {
      let tex = t;
      if (shape === "cup" || shape === "bottle") {
        tex = t.clone();
        tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1); tex.offset.set(0.25, 0);
        tex.needsUpdate = true;
      }
      mats.label.map = tex; mats.label.needsUpdate = true;
    });
  }, [p, mats, shape, isFruit, modelFruit]);

  // matrices for every possible unit once; stock only changes the draw count (cheap while scrubbing)
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    units.forEach((u, i) => { tmp.position.set(...u.pos); tmp.rotation.set(...u.rot); tmp.scale.setScalar(1); tmp.updateMatrix(); m.setMatrixAt(i, tmp.matrix); });
    m.count = units.length;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [units]);
  // shelves read as stocked: visible units saturate with stock (front rows fill first); bowl fruit and camera-counted cans stay 1:1
  const visible = loc.zone === "fruit_bowl" || CAN_IDS.includes(p.id)
    ? Math.min(units.length, Math.max(0, Math.ceil(stock / (PER_UNIT[p.id] ?? 1))))
    : stock <= 0 ? 0 : Math.min(units.length, Math.max(1, Math.ceil(units.length * (1 - Math.exp(-stock / 12)))));
  useLayoutEffect(() => { if (mesh.current) mesh.current.count = visible; }, [visible, units]);

  const v = useRef(visual);
  v.current = visual;
  useFrame(({ clock }) => {
    const s = v.current;
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4);
    for (const m of mats.all) {
      m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 1; m.opacity = 1;
      m.color.copy(mats.base.get(m)!);
    }
    const tint = (c: THREE.Color) => { for (const m of mats.all) { m.color.lerp(c, 0.65); m.emissive.copy(c).multiplyScalar(0.18); } };
    if (s.overlay === "heatmap") {
      scratch.copy(s.heat < 0.5 ? heatCold : heatMid).lerp(s.heat < 0.5 ? heatMid : heatHot, s.heat < 0.5 ? s.heat * 2 : (s.heat - 0.5) * 2);
      tint(scratch);
    } else if (s.overlay === "waste") {
      const d = s.daysToExpiry ?? 999;
      tint(scratch.set(d <= 3 ? "#ff3b30" : d <= 10 ? "#ffb020" : "#b9bcc0"));
    } else if (s.overlay === "dietary" && !s.dietaryMatch) {
      for (const m of mats.all) m.opacity = 0.12;
    }
    if (s.overlay === "none" || s.overlay === "dietary") {
      if (s.nearExpiry) for (const m of mats.all) m.emissive.setRGB(1, 0.16, 0.08).multiplyScalar(0.2 + 0.4 * pulse);
      else if (s.lowStock && !CAN_IDS.includes(p.id)) for (const m of mats.all) m.emissive.setRGB(1, 0.62, 0).multiplyScalar(0.28);
    }
    if (s.highlight) for (const m of mats.all) m.emissive.copy(HIGHLIGHT).multiplyScalar(0.35 + 0.45 * pulse);
    if (s.dimmed) for (const m of mats.all) m.opacity = 0.14;
    if (s.selected) for (const m of mats.all) m.emissive.copy(HIGHLIGHT).multiplyScalar(0.55 + 0.25 * pulse);
  });

  const tagPos = tagPosition(loc);
  const tag = useMemo(() => shelfTagTexture(p, price), [p, price]);
  const top = useMemo(() => {
    const vis = units.slice(0, Math.max(1, visible));
    const t = vis.reduce((a, b) => (b.pos[1] > a.pos[1] ? b : a), vis[0]);
    return new THREE.Vector3(t.pos[0], t.pos[1] + 0.2, t.pos[2]);
  }, [units, visible]);

  if (p.trial && visible === 0) return null;
  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[geom, mats.list.length === 1 ? mats.list[0] : mats.list, units.length]}
        castShadow receiveShadow frustumCulled={false}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(p.id, top); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta > 5) return; onSelect(p.id); }}
      />
      {tagPos && (
        <mesh position={tagPos} onClick={(e) => { e.stopPropagation(); if (e.delta > 5) return; onSelect(p.id); }}>
          <planeGeometry args={[0.2, 0.05]} />
          <meshBasicMaterial map={tag} color={visible === 0 ? "#ffd2c8" : "#ffffff"} toneMapped={false} />
        </mesh>
      )}
      {visual.showTag && visible > 0 && (
        <LabelSprite text="eat me first" pos={[top.x, top.y + 0.04, top.z]} bg="#e4f222" border="#e4f222" height={0.024} />
      )}
    </group>
  );
}
