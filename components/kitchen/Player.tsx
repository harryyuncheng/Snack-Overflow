"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Zone } from "@/lib/types";
import { BOUNDS, ISLAND, stationFor } from "./zones";

const YAW_LIMIT = THREE.MathUtils.degToRad(100); // keep the snack wall in view
const PITCH_MIN = THREE.MathUtils.degToRad(-60), PITCH_MAX = THREE.MathUtils.degToRad(20);
const DRAG_SPEED = 0.0045; // radians per dragged pixel
const SPEED = 3.0, ACCEL = 9;
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function viewFor(pos: [number, number, number], look: [number, number, number]) {
  const dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

type Glide = { from: THREE.Vector3; to: THREE.Vector3; yaw0: number; yaw1: number; p0: number; p1: number; t: number; dur: number; start: number };

/**
 * First-person look-around: the view eases toward wherever the mouse points over the canvas
 * (no dragging, no pointer lock, so clicks still select snacks). WASD / arrows walk with
 * acceleration, Q/E or ←/→ turn, scroll steps. Changing `focusZone` glides there with ease-in-out.
 */
export default function Player({ focusZone }: { focusZone: Zone | "overview" }) {
  const { camera, gl } = useThree();
  const start = stationFor("overview");
  const pos = useRef(new THREE.Vector3(...start.pos));
  const base = useRef(viewFor(start.pos, start.look)); // heading without mouse offset
  const look = useRef({ ...base.current }); // smoothed actual view
  const vel = useRef(new THREE.Vector3());
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const glide = useRef<Glide | null>(null);
  const keys = useRef(new Set<string>());
  const wheel = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    const s = stationFor(focusZone);
    const v = viewFor(s.pos, s.look);
    if (first.current) { first.current = false; return; }
    const dist = pos.current.distanceTo(new THREE.Vector3(...s.pos));
    glide.current = { from: pos.current.clone(), to: new THREE.Vector3(...s.pos), yaw0: base.current.yaw, yaw1: v.yaw, p0: base.current.pitch, p1: v.pitch, t: 0, dur: THREE.MathUtils.clamp(0.7 + dist * 0.06, 0.8, 1.2), start: performance.now() };
  }, [focusZone]);

  useEffect(() => {
    const el = gl.domElement;
    const typing = () => { const a = document.activeElement; return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || (a as HTMLElement).isContentEditable); };
    const MOVE = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "q", "e"];
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (typing() || !MOVE.includes(k)) return;
      keys.current.add(k); glide.current = null;
      if (k.startsWith("arrow")) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    // click-and-drag to look; a drag never counts as a click (R3F handlers check e.delta)
    const pd = (e: PointerEvent) => { if (e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
    const pm = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      d.x = e.clientX; d.y = e.clientY;
      const b = base.current;
      b.yaw = THREE.MathUtils.clamp(b.yaw + dx * DRAG_SPEED, -YAW_LIMIT, YAW_LIMIT);
      b.pitch = THREE.MathUtils.clamp(b.pitch + dy * DRAG_SPEED, PITCH_MIN, PITCH_MAX);
      glide.current = null;
      el.style.cursor = "grabbing";
    };
    const pu = () => { drag.current = null; el.style.cursor = ""; };
    const wh = (e: WheelEvent) => { e.preventDefault(); wheel.current += -e.deltaY * 0.004; glide.current = null; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    el.addEventListener("pointerdown", pd);
    window.addEventListener("pointermove", pm);
    window.addEventListener("pointerup", pu);
    el.addEventListener("wheel", wh, { passive: false });
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur);
      el.removeEventListener("pointerdown", pd); window.removeEventListener("pointermove", pm); window.removeEventListener("pointerup", pu); el.removeEventListener("wheel", wh);
    };
  }, [gl]);

  const tmp = useRef({ fwd: new THREE.Vector3(), right: new THREE.Vector3(), want: new THREE.Vector3() });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = pos.current, b = base.current, k = keys.current, { fwd, right, want } = tmp.current;

    // station glide (eased tween)
    const g = glide.current;
    if (g) {
      // wall-clock progress so the glide finishes on time even when frames drop
      g.t = Math.min(1, (performance.now() - g.start) / 1000 / g.dur);
      const e = ease(g.t);
      p.lerpVectors(g.from, g.to, e);
      b.yaw = THREE.MathUtils.lerp(g.yaw0, g.yaw1, e);
      b.pitch = THREE.MathUtils.lerp(g.p0, g.p1, e);
      vel.current.set(0, 0, 0);
      if (g.t >= 1) glide.current = null;
    } else {
      if (k.has("arrowleft") || k.has("q")) b.yaw += 1.4 * dt;
      if (k.has("arrowright") || k.has("e")) b.yaw -= 1.4 * dt;
      b.yaw = THREE.MathUtils.clamp(b.yaw, -YAW_LIMIT, YAW_LIMIT);
      // walk where you're looking (horizontal)
      const yaw = look.current.yaw;
      fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      want.set(0, 0, 0);
      if (k.has("w") || k.has("arrowup")) want.add(fwd);
      if (k.has("s") || k.has("arrowdown")) want.sub(fwd);
      if (k.has("d")) want.add(right);
      if (k.has("a")) want.sub(right);
      if (want.lengthSq() > 0) want.normalize().multiplyScalar(SPEED);
      vel.current.lerp(want, damp(ACCEL, dt));
      p.addScaledVector(vel.current, dt);
      if (Math.abs(wheel.current) > 0.001) {
        const step = wheel.current * damp(8, dt);
        p.addScaledVector(fwd, step);
        wheel.current -= step;
      }
      if (want.lengthSq() > 0 || Math.abs(wheel.current) > 0.01) p.y += (1.65 - p.y) * damp(2.5, dt); // settle to eye height
      // stay out of the island
      const m = 0.4, ix0 = ISLAND.x - ISLAND.w / 2 - m, ix1 = ISLAND.x + ISLAND.w / 2 + m, iz0 = ISLAND.z - ISLAND.d / 2 - m, iz1 = ISLAND.z + ISLAND.d / 2 + m;
      if (p.x > ix0 && p.x < ix1 && p.z > iz0 && p.z < iz1) {
        const push = [p.x - ix0, ix1 - p.x, p.z - iz0, iz1 - p.z];
        const i = push.indexOf(Math.min(...push));
        if (i === 0) p.x = ix0; else if (i === 1) p.x = ix1; else if (i === 2) p.z = iz0; else p.z = iz1;
      }
      p.x = THREE.MathUtils.clamp(p.x, BOUNDS.minX, BOUNDS.maxX);
      p.z = THREE.MathUtils.clamp(p.z, BOUNDS.minZ, BOUNDS.maxZ);
      p.y = THREE.MathUtils.clamp(p.y, BOUNDS.minY, BOUNDS.maxY);
    }

    // eased look toward the dragged heading
    const targetYaw = b.yaw, targetPitch = b.pitch;
    const kLook = glide.current ? 10 : 14;
    look.current.yaw += (targetYaw - look.current.yaw) * damp(kLook, dt);
    look.current.pitch += (targetPitch - look.current.pitch) * damp(kLook, dt);

    camera.position.copy(p);
    camera.rotation.set(look.current.pitch, look.current.yaw, 0, "YXZ");
  });
  return null;
}
