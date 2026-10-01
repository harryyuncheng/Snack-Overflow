"use client";
import { RoundedBox } from "@react-three/drei";
import LabelSprite from "./LabelSprite";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Zone } from "@/lib/types";
import { ZONES, ISLAND, BOWL } from "./zones";
import { corkTexture, subwayTileTexture, windowSkyTexture, woodFloorTexture } from "./textures";

const WALL = "#ece5da";

export function ZoneLabel({ text, pos }: { text: string; pos: [number, number, number] }) {
  return <LabelSprite text={text} pos={pos} />;
}

function Fridge({ zone, open, onToggle, body }: { zone: Zone; open: boolean; onToggle: () => void; body: string }) {
  const z = ZONES[zone];
  const [x, , zz] = z.origin;
  const door = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (door.current) door.current.rotation.y = THREE.MathUtils.damp(door.current.rotation.y, open ? -1.85 : 0, 6, dt);
  });
  const W = z.width + 0.2, H = 2.95, D = z.depth + 0.18;
  const cx = x + z.width / 2, cz = zz + D / 2 - 0.06;
  const shell = <meshStandardMaterial color={body} roughness={0.35} metalness={0.55} />;
  const inner = <meshStandardMaterial color="#f2f5f7" roughness={0.6} />;
  return (
    <group>
      <mesh position={[cx, H / 2, zz - 0.07]} receiveShadow><boxGeometry args={[W, H, 0.06]} />{inner}</mesh>
      <mesh position={[x - 0.075, H / 2, cz]} castShadow><boxGeometry args={[0.05, H, D]} />{shell}</mesh>
      <mesh position={[x + z.width + 0.075, H / 2, cz]} castShadow><boxGeometry args={[0.05, H, D]} />{shell}</mesh>
      <mesh position={[cx, H - 0.06, cz]}><boxGeometry args={[W, 0.12, D]} />{shell}</mesh>
      <mesh position={[cx, H - 0.06, zz + D - 0.04]}><boxGeometry args={[W, 0.12, 0.02]} /><meshStandardMaterial color="#111" emissive="#b8ff6a" emissiveIntensity={0.05} /></mesh>
      <mesh position={[cx, 0.13, cz]}><boxGeometry args={[W, 0.26, D]} />{shell}</mesh>
      {z.shelfY.map((y) => (
        <mesh key={y} position={[cx, y - 0.012, zz + z.depth / 2]} receiveShadow>
          <boxGeometry args={[z.width, 0.018, z.depth]} />
          <meshStandardMaterial color="#e8f3fb" transparent opacity={0.5} roughness={0.1} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[cx, H - 0.125, zz + 0.3]}><boxGeometry args={[z.width * 0.8, 0.01, 0.06]} /><meshStandardMaterial color="#ffffff" emissive="#eef7ff" emissiveIntensity={2} /></mesh>
      <group ref={door} position={[x - 0.1, 0, zz + D - 0.02]} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        <mesh position={[W / 2, H / 2, 0]}>
          <boxGeometry args={[W, H, 0.03]} />
          <meshStandardMaterial color="#d7ecff" roughness={0.05} metalness={0.1} transparent opacity={0.13} depthWrite={false} />
        </mesh>
        {/* frame */}
        {[[W / 2, 0.04, W, 0.08], [W / 2, H - 0.04, W, 0.08]].map(([px, py, w, h], i) => (
          <mesh key={i} position={[px, py, 0.01]}><boxGeometry args={[w, h, 0.05]} />{shell}</mesh>
        ))}
        <mesh position={[0.04, H / 2, 0.01]}><boxGeometry args={[0.08, H, 0.05]} />{shell}</mesh>
        <mesh position={[W - 0.04, H / 2, 0.01]}><boxGeometry args={[0.08, H, 0.05]} />{shell}</mesh>
        <mesh position={[W - 0.16, H / 2, 0.07]}><boxGeometry args={[0.035, 1.0, 0.05]} /><meshStandardMaterial color="#c9ced4" metalness={0.9} roughness={0.25} /></mesh>
      </group>
      <ZoneLabel text={z.label} pos={[cx, H + 0.18, zz + 0.4]} />
    </group>
  );
}

function Plant({ pos, scale = 1 }: { pos: [number, number, number]; scale?: number }) {
  const leaves = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + i * 0.7;
    return { p: [Math.cos(a) * 0.16, 0.55 + (i % 3) * 0.14, Math.sin(a) * 0.16] as [number, number, number], s: 0.13 + (i % 4) * 0.03 };
  }), []);
  return (
    <group position={pos} scale={scale}>
      <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.17, 0.13, 0.4, 20]} /><meshStandardMaterial color="#d9d2c6" roughness={0.9} /></mesh>
      <mesh position={[0, 0.39, 0]}><cylinderGeometry args={[0.155, 0.155, 0.02, 20]} /><meshStandardMaterial color="#3e2b1e" /></mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={l.p} scale={[1, 1.4, 1]} castShadow><sphereGeometry args={[l.s, 10, 8]} /><meshStandardMaterial color={i % 2 ? "#3f7d3a" : "#2f6a33"} roughness={0.8} /></mesh>
      ))}
    </group>
  );
}

function Stool({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 0.72, 0]} castShadow><cylinderGeometry args={[0.2, 0.2, 0.06, 24]} /><meshStandardMaterial color="#2b2b2b" roughness={0.6} /></mesh>
      <mesh position={[0, 0.36, 0]}><cylinderGeometry args={[0.025, 0.025, 0.72, 8]} /><meshStandardMaterial color="#9a9a9a" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.15, 0.012, 6, 24]} /><meshStandardMaterial color="#9a9a9a" metalness={0.8} /></mesh>
      <mesh position={[0, 0.01, 0]}><cylinderGeometry args={[0.18, 0.2, 0.02, 20]} /><meshStandardMaterial color="#555" metalness={0.6} /></mesh>
    </group>
  );
}

function Pendant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.0, 0]}><cylinderGeometry args={[0.005, 0.005, 0.8, 4]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[0, 2.52, 0]}><coneGeometry args={[0.22, 0.24, 24, 1, true]} /><meshStandardMaterial color="#1f1f1f" side={THREE.DoubleSide} roughness={0.5} /></mesh>
      <mesh position={[0, 2.44, 0]}><sphereGeometry args={[0.06, 12, 8]} /><meshStandardMaterial color="#fff3d6" emissive="#ffd9a0" emissiveIntensity={2} /></mesh>
      <pointLight position={[0, 2.35, 0]} intensity={2.5} distance={4.5} decay={1.6} color="#ffd9a6" />
    </group>
  );
}

function Desk({ pos, rot = 0 }: { pos: [number, number, number]; rot?: number }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow><boxGeometry args={[1.5, 0.04, 0.75]} /><meshStandardMaterial color="#d8c6a8" roughness={0.7} /></mesh>
      {[-0.7, 0.7].map((dx) => <mesh key={dx} position={[dx, 0.37, 0]}><boxGeometry args={[0.04, 0.74, 0.7]} /><meshStandardMaterial color="#e6e6e6" /></mesh>)}
      <mesh position={[0, 1.02, -0.22]} castShadow><boxGeometry args={[0.62, 0.38, 0.03]} /><meshStandardMaterial color="#1b1b1b" roughness={0.4} /></mesh>
      <mesh position={[0, 1.02, -0.203]}><planeGeometry args={[0.58, 0.34]} /><meshStandardMaterial color="#2c3e50" emissive="#3a5f86" emissiveIntensity={0.35} /></mesh>
      <mesh position={[0, 0.82, -0.22]}><boxGeometry args={[0.04, 0.16, 0.04]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh position={[0, 0.765, 0.08]}><boxGeometry args={[0.42, 0.015, 0.13]} /><meshStandardMaterial color="#3a3a3a" /></mesh>
      <mesh position={[0.45, 0.8, 0.05]}><cylinderGeometry args={[0.04, 0.035, 0.1, 12]} /><meshStandardMaterial color="#e4f222" /></mesh>
      <group position={[0, 0, 0.65]}>
        <mesh position={[0, 0.48, 0]} castShadow><boxGeometry args={[0.48, 0.07, 0.46]} /><meshStandardMaterial color="#2d2d2d" /></mesh>
        <mesh position={[0, 0.78, 0.2]}><boxGeometry args={[0.46, 0.55, 0.05]} /><meshStandardMaterial color="#2d2d2d" /></mesh>
        <mesh position={[0, 0.24, 0]}><cylinderGeometry args={[0.03, 0.03, 0.44, 8]} /><meshStandardMaterial color="#888" metalness={0.7} /></mesh>
      </group>
    </group>
  );
}

export default function Room({ doors, toggleDoor }: { doors: Record<string, boolean>; toggleDoor: (z: Zone) => void }) {
  const floor = useMemo(() => woodFloorTexture(), []);
  const tile = useMemo(() => { const t = subwayTileTexture(); t.repeat.set(5, 1.2); return t; }, []);
  const sky = useMemo(() => windowSkyTexture(), []);
  const cork = useMemo(() => corkTexture(), []);
  const P = ZONES.pantry, C = ZONES.coffee_bar, F = ZONES.freezer;
  const wood = <meshStandardMaterial color="#a8774a" roughness={0.75} />;
  const counterX0 = 2.95, counterX1 = 7.0, counterW = counterX1 - counterX0, counterCx = (counterX0 + counterX1) / 2;
  return (
    <group>
      {/* floor, walls, ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1, 0, 4]} receiveShadow><planeGeometry args={[18, 12]} /><meshStandardMaterial map={floor} roughness={0.55} /></mesh>
      <mesh position={[1, 1.75, -1.76]} receiveShadow><planeGeometry args={[18, 3.5]} /><meshStandardMaterial color={WALL} roughness={0.95} /></mesh>
      <mesh position={[-7.6, 1.75, 4]} rotation={[0, Math.PI / 2, 0]} receiveShadow><planeGeometry args={[12, 3.5]} /><meshStandardMaterial color="#e3dbcf" roughness={0.95} /></mesh>
      <mesh position={[9.6, 1.75, 4]} rotation={[0, -Math.PI / 2, 0]} receiveShadow><planeGeometry args={[12, 3.5]} /><meshStandardMaterial color="#e3dbcf" roughness={0.95} /></mesh>
      <mesh position={[1, 3.5, 4]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[18, 12]} /><meshStandardMaterial color="#f4f2f0" /></mesh>
      {/* baseboard */}
      <mesh position={[1, 0.05, -1.74]}><boxGeometry args={[18, 0.1, 0.03]} /><meshStandardMaterial color="#d8d0c3" /></mesh>
      {/* ceiling light panels */}
      {[-4, 0, 4, 8].map((x) => [2, 6].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 3.49, z]} rotation={[Math.PI / 2, 0, 0]}><planeGeometry args={[1.2, 0.6]} /><meshStandardMaterial color="#ffffff" emissive="#fffaf0" emissiveIntensity={0.9} /></mesh>
      )))}

      <Fridge zone="drink_fridge" open={doors.drink_fridge} onToggle={() => toggleDoor("drink_fridge")} body="#3c4148" />
      <Fridge zone="fresh_fridge" open={doors.fresh_fridge} onToggle={() => toggleDoor("fresh_fridge")} body="#cfd3d8" />

      {/* pantry: open shelving with back panel */}
      <mesh position={[P.origin[0] + P.width / 2, 1.3, P.origin[2] - 0.02]} receiveShadow><boxGeometry args={[P.width + 0.1, 2.6, 0.02]} /><meshStandardMaterial color="#e9dcc7" roughness={0.9} /></mesh>
      {P.shelfY.map((y) => (
        <mesh key={y} position={[P.origin[0] + P.width / 2, y - 0.02, P.origin[2] + P.depth / 2]} castShadow receiveShadow><boxGeometry args={[P.width + 0.1, 0.035, P.depth + 0.02]} />{wood}</mesh>
      ))}
      <mesh position={[P.origin[0] + P.width / 2, 2.62, P.origin[2] + P.depth / 2]} castShadow><boxGeometry args={[P.width + 0.1, 0.035, P.depth + 0.02]} />{wood}</mesh>
      {[0, P.width / 2, P.width].map((dx) => <mesh key={dx} position={[P.origin[0] + dx, 1.31, P.origin[2] + P.depth / 2]} castShadow><boxGeometry args={[0.04, 2.62, P.depth + 0.02]} />{wood}</mesh>)}
      <ZoneLabel text={P.label} pos={[P.origin[0] + P.width / 2, 2.85, P.origin[2] + 0.3]} />

      {/* corkboard between fresh fridge and pantry */}
      <mesh position={[2.62, 1.75, -1.73]}><planeGeometry args={[0.5, 0.8]} /><meshStandardMaterial map={cork} roughness={1} /></mesh>

      {/* kitchen counter run: base cabinets, countertop, backsplash, sink, uppers, window */}
      <mesh position={[counterCx, 0.44, -1.42]} castShadow receiveShadow><boxGeometry args={[counterW, 0.88, 0.62]} /><meshStandardMaterial color="#5f6f66" roughness={0.6} /></mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i}>
          <mesh position={[counterX0 + (i + 0.5) * (counterW / 6), 0.46, -1.105]}><boxGeometry args={[counterW / 6 - 0.03, 0.78, 0.01]} /><meshStandardMaterial color="#6b7c72" roughness={0.55} /></mesh>
          <mesh position={[counterX0 + (i + 0.5) * (counterW / 6) + (i % 2 ? -0.25 : 0.25), 0.72, -1.09]}><boxGeometry args={[0.012, 0.14, 0.02]} /><meshStandardMaterial color="#cfcfcf" metalness={0.9} roughness={0.2} /></mesh>
        </group>
      ))}
      <mesh position={[counterCx, 0.91, -1.4]} castShadow receiveShadow><boxGeometry args={[counterW + 0.06, 0.05, 0.68]} /><meshStandardMaterial color="#efece6" roughness={0.25} /></mesh>
      <mesh position={[counterCx, 1.33, -1.745]}><planeGeometry args={[counterW, 0.8]} /><meshStandardMaterial map={tile} roughness={0.3} /></mesh>
      {/* sink */}
      <mesh position={[5.85, 0.9, -1.38]}><boxGeometry args={[0.7, 0.04, 0.42]} /><meshStandardMaterial color="#b9bec4" metalness={0.85} roughness={0.25} /></mesh>
      <group position={[5.85, 0.93, -1.66]}>
        <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.02, 0.025, 0.36, 10]} /><meshStandardMaterial color="#d0d4d8" metalness={0.95} roughness={0.15} /></mesh>
        <mesh position={[0, 0.36, 0.1]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.016, 0.016, 0.22, 10]} /><meshStandardMaterial color="#d0d4d8" metalness={0.95} roughness={0.15} /></mesh>
      </group>
      {/* window above sink */}
      <group position={[5.85, 2.05, -1.74]}>
        <mesh><planeGeometry args={[1.3, 0.95]} /><meshStandardMaterial map={sky} emissive="#ffffff" emissiveMap={sky} emissiveIntensity={0.85} /></mesh>
        {[[0, 0.5, 1.4, 0.06], [0, -0.5, 1.4, 0.06], [-0.67, 0, 0.06, 1.04], [0.67, 0, 0.06, 1.04], [0, 0, 0.03, 0.95]].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.02]}><boxGeometry args={[w, h, 0.05]} /><meshStandardMaterial color="#f7f7f5" /></mesh>
        ))}
        <mesh position={[0, -0.53, 0.06]}><boxGeometry args={[1.45, 0.04, 0.12]} /><meshStandardMaterial color="#f7f7f5" /></mesh>
      </group>
      {/* upper cabinets either side of the window */}
      {[[3.55, 1.2], [6.95 - 0.27, 0.54]].map(([x, w], i) => (
        <group key={i}>
          <mesh position={[x, 2.35, -1.55]} castShadow><boxGeometry args={[w, 0.8, 0.38]} /><meshStandardMaterial color="#f1eee8" roughness={0.6} /></mesh>
          <mesh position={[x, 2.35, -1.355]}><boxGeometry args={[w - 0.04, 0.76, 0.01]} /><meshStandardMaterial color="#e9e5dd" /></mesh>
          <mesh position={[x + (i ? -0.2 : 0.5), 2.05, -1.34]}><boxGeometry args={[0.012, 0.14, 0.02]} /><meshStandardMaterial color="#cfcfcf" metalness={0.9} /></mesh>
        </group>
      ))}
      
      {/* open coffee shelf + espresso machine, kettle, paper towels, mugs */}
      <mesh position={[C.origin[0] + C.width / 2 - 0.2, C.shelfY[1] - 0.02, C.origin[2] + C.depth / 2]} castShadow><boxGeometry args={[C.width + 0.4, 0.035, C.depth]} />{wood}</mesh>
      <RoundedBox args={[0.42, 0.48, 0.4]} radius={0.04} position={[5.0, 1.18, -1.48]} castShadow><meshStandardMaterial color="#1c1c1c" metalness={0.5} roughness={0.35} /></RoundedBox>
      <mesh position={[5.0, 1.1, -1.27]}><boxGeometry args={[0.22, 0.04, 0.06]} /><meshStandardMaterial color="#b0b0b0" metalness={0.9} /></mesh>
      <mesh position={[4.62, 1.05, -1.4]} castShadow><cylinderGeometry args={[0.08, 0.1, 0.24, 18]} /><meshStandardMaterial color="#c9ccd0" metalness={0.8} roughness={0.25} /></mesh>
      <mesh position={[6.6, 1.06, -1.6]} rotation={[0, 0, 0]} castShadow><cylinderGeometry args={[0.07, 0.07, 0.28, 18]} /><meshStandardMaterial color="#fbfbf8" roughness={0.9} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[4.0 + i * 0.13, C.shelfY[1] + 0.05, C.origin[2] + 0.2 + (i % 2) * 0.05]} castShadow><cylinderGeometry args={[0.045, 0.04, 0.1, 14]} /><meshStandardMaterial color={["#f4f2f0", "#e4f222", "#1a1919"][i]} roughness={0.5} /></mesh>
      ))}
      <ZoneLabel text={C.label} pos={[C.origin[0] + 0.75, 2.95, C.origin[2] + 0.3]} />

      {/* chest freezer */}
      <group>
        <mesh position={[F.origin[0] + F.width / 2, 0.06, F.origin[2] + F.depth / 2]}><boxGeometry args={[F.width + 0.2, 0.12, F.depth + 0.2]} /><meshStandardMaterial color="#f7f7f7" /></mesh>
        {[-1, 1].map((s) => <mesh key={`x${s}`} position={[F.origin[0] + F.width / 2 + (s * (F.width + 0.16)) / 2, 0.45, F.origin[2] + F.depth / 2]} castShadow><boxGeometry args={[0.04, 0.9, F.depth + 0.2]} /><meshStandardMaterial color="#f7f7f7" roughness={0.4} /></mesh>)}
        {[-1, 1].map((s) => <mesh key={`z${s}`} position={[F.origin[0] + F.width / 2, 0.45, F.origin[2] + F.depth / 2 + (s * (F.depth + 0.16)) / 2]} castShadow><boxGeometry args={[F.width + 0.2, 0.9, 0.04]} /><meshStandardMaterial color="#f7f7f7" roughness={0.4} /></mesh>)}
        <mesh position={[F.origin[0] + F.width / 2, 0.4, F.origin[2] + F.depth / 2]}><boxGeometry args={[F.width, 0.02, F.depth]} /><meshStandardMaterial color="#dbe9f2" /></mesh>
        <mesh position={[F.origin[0] + F.width / 2, 0.905, F.origin[2] + F.depth / 2]}><boxGeometry args={[F.width + 0.16, 0.012, F.depth + 0.16]} /><meshStandardMaterial color="#e3f2fd" transparent opacity={0.16} depthWrite={false} /></mesh>
        
        <ZoneLabel text={F.label} pos={[F.origin[0] + F.width / 2, 1.25, F.origin[2] + 0.3]} />
      </group>
      {/* corkboard above freezer */}
      <mesh position={[F.origin[0] + F.width / 2, 1.95, -1.73]}><planeGeometry args={[1.25, 0.78]} /><meshStandardMaterial map={cork} roughness={1} /></mesh>
      <mesh position={[F.origin[0] + F.width / 2, 1.95, -1.745]}><planeGeometry args={[1.33, 0.86]} /><meshStandardMaterial color="#8a6a45" /></mesh>

      {/* island with fruit bowl + stools */}
      <mesh position={[ISLAND.x, ISLAND.h / 2 - 0.02, ISLAND.z]} castShadow receiveShadow><boxGeometry args={[ISLAND.w - 0.1, ISLAND.h - 0.04, ISLAND.d - 0.1]} /><meshStandardMaterial color="#e9e4dc" roughness={0.7} /></mesh>
      <mesh position={[ISLAND.x, ISLAND.h, ISLAND.z]} castShadow receiveShadow><boxGeometry args={[ISLAND.w + 0.1, 0.05, ISLAND.d + 0.15]} /><meshStandardMaterial color="#8e6a48" roughness={0.45} /></mesh>
      <mesh position={[BOWL.x, BOWL.y + 0.02, BOWL.z]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <sphereGeometry args={[BOWL.r + 0.06, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
        <meshStandardMaterial color="#d9d3c7" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      {/* napkins + a laptop someone left */}
      <mesh position={[1.55, ISLAND.h + 0.04, 3.45]} rotation={[0, 0.3, 0]} castShadow><boxGeometry args={[0.2, 0.05, 0.2]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <group position={[-0.35, ISLAND.h + 0.03, 3.75]} rotation={[0, -0.4, 0]}>
        <mesh castShadow><boxGeometry args={[0.36, 0.015, 0.25]} /><meshStandardMaterial color="#b9bcc0" metalness={0.7} roughness={0.3} /></mesh>
        <mesh position={[0, 0.12, -0.12]} rotation={[-0.35, 0, 0]}><boxGeometry args={[0.36, 0.24, 0.01]} /><meshStandardMaterial color="#b9bcc0" metalness={0.7} roughness={0.3} /></mesh>
      </group>
      {[-0.3, 0.6, 1.5].map((x) => <Stool key={x} pos={[x, 0, ISLAND.z + 0.85]} />)}
      <Pendant x={-0.1} z={ISLAND.z} />
      <Pendant x={1.3} z={ISLAND.z} />
      <ZoneLabel text={ZONES.fruit_bowl.label} pos={[BOWL.x, 1.55, BOWL.z]} />

      <Plant pos={[-7.1, 0, -1.2]} scale={1.6} />
      <Plant pos={[2.62, 0, -1.4]} scale={1.1} />
      <Plant pos={[9.1, 0, -1.2]} scale={1.5} />
      <Plant pos={[6.6, 0.935, -1.48]} scale={0.45} />
      {/* office space around the kitchen */}
      <Desk pos={[-5.6, 0, 6.2]} rot={0.04} />
      <Desk pos={[-3.9, 0, 6.15]} rot={-0.03} />
      <Desk pos={[-5.6, 0, 8.3]} rot={Math.PI} />
      <group position={[7.6, 0, 6.6]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0.22, 0]} castShadow><boxGeometry args={[2.0, 0.44, 0.85]} /><meshStandardMaterial color="#4c5a66" roughness={0.9} /></mesh>
        <mesh position={[0, 0.6, -0.35]} castShadow><boxGeometry args={[2.0, 0.55, 0.18]} /><meshStandardMaterial color="#4c5a66" roughness={0.9} /></mesh>
        {[-0.5, 0.5].map((x) => <mesh key={x} position={[x, 0.5, 0.0]}><boxGeometry args={[0.9, 0.14, 0.7]} /><meshStandardMaterial color="#56656f" roughness={0.95} /></mesh>)}
        <mesh position={[0, 0.25, 1.0]} castShadow><cylinderGeometry args={[0.38, 0.38, 0.04, 28]} /><meshStandardMaterial color="#a8774a" /></mesh>
        <mesh position={[0, 0.12, 1.0]}><cylinderGeometry args={[0.04, 0.04, 0.24, 8]} /><meshStandardMaterial color="#333" /></mesh>
      </group>
      <Plant pos={[9.0, 0, 8.6]} scale={1.3} />
      <mesh position={[-7.58, 1.7, 7]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[2.4, 1.2]} /><meshStandardMaterial color="#f8f8f6" /></mesh>
      <mesh position={[-7.57, 1.7, 7]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[2.3, 1.1]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.15} /></mesh>
    </group>
  );
}
