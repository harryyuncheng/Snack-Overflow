"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Zone } from "@/lib/types";
import { BOUNDS, STATIONS } from "./zones";

const YAW_LIMIT = THREE.MathUtils.degToRad(75);
const PITCH_MIN = THREE.MathUtils.degToRad(-55), PITCH_MAX = THREE.MathUtils.degToRad(25);

function viewFor(pos: [number, number, number], look: [number, number, number]) {
  const dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/**
 * First-person walk controls: WASD / arrows to walk, drag to look (yaw clamped so you face the snack wall),
 * wheel to step forward/back. Changing `focusZone` glides you to that station.
 */
export default function Player({ focusZone }: { focusZone: Zone | "overview" }) {
  const { camera, gl } = useThree();
  const start = STATIONS.overview;
  const pos = useRef(new THREE.Vector3(...start.pos));
  const view = useRef(viewFor(start.pos, start.look));
  const glide = useRef<{ pos: THREE.Vector3; yaw: number; pitch: number } | null>(null);
  const keys = useRef(new Set<string>());
  const drag = useRef<{ x: number; y: number } | null>(null);
  const wheel = useRef(0);

  useEffect(() => {
    const s = STATIONS[focusZone];
    glide.current = { pos: new THREE.Vector3(...s.pos), ...viewFor(s.pos, s.look) };
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
    const pd = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; };
    const pm = (e: PointerEvent) => {
      if (!drag.current || !(e.buttons & 1)) { drag.current = null; return; }
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      drag.current = { x: e.clientX, y: e.clientY };
      if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
      glide.current = null;
      view.current.yaw = THREE.MathUtils.clamp(view.current.yaw - dx * 0.0035, -YAW_LIMIT, YAW_LIMIT);
      view.current.pitch = THREE.MathUtils.clamp(view.current.pitch - dy * 0.0035, PITCH_MIN, PITCH_MAX);
    };
    const pu = () => { drag.current = null; };
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
      el.removeEventListener("pointerdown", pd); window.removeEventListener("pointermove", pm); window.removeEventListener("pointerup", pu);
      el.removeEventListener("wheel", wh);
    };
  }, [gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = pos.current, v = view.current;
    const k = keys.current;
    const fwd = new THREE.Vector3(-Math.sin(v.yaw), 0, -Math.cos(v.yaw));
    const right = new THREE.Vector3(Math.cos(v.yaw), 0, -Math.sin(v.yaw));
    const move = new THREE.Vector3();
    if (k.has("w") || k.has("arrowup")) move.add(fwd);
    if (k.has("s") || k.has("arrowdown")) move.sub(fwd);
    if (k.has("d")) move.add(right);
    if (k.has("a")) move.sub(right);
    if (k.has("arrowleft") || k.has("q")) v.yaw = THREE.MathUtils.clamp(v.yaw + 1.6 * dt, -YAW_LIMIT, YAW_LIMIT);
    if (k.has("arrowright") || k.has("e")) v.yaw = THREE.MathUtils.clamp(v.yaw - 1.6 * dt, -YAW_LIMIT, YAW_LIMIT);
    const walking = move.lengthSq() > 0 || Math.abs(wheel.current) > 0.001;
    if (move.lengthSq() > 0) p.addScaledVector(move.normalize(), 3.2 * dt);
    if (Math.abs(wheel.current) > 0.001) {
      const step = wheel.current * Math.min(1, dt * 10);
      p.addScaledVector(fwd, step);
      wheel.current -= step;
    }
    if (walking) p.y = THREE.MathUtils.damp(p.y, 1.65, 3, dt); // settle to eye height when walking
    const g = glide.current;
    if (g) {
      p.x = THREE.MathUtils.damp(p.x, g.pos.x, 3.2, dt);
      p.y = THREE.MathUtils.damp(p.y, g.pos.y, 3.2, dt);
      p.z = THREE.MathUtils.damp(p.z, g.pos.z, 3.2, dt);
      v.yaw = THREE.MathUtils.damp(v.yaw, g.yaw, 3.2, dt);
      v.pitch = THREE.MathUtils.damp(v.pitch, g.pitch, 3.2, dt);
      if (p.distanceTo(g.pos) < 0.005 && Math.abs(v.yaw - g.yaw) < 0.002) glide.current = null;
    }
    p.x = THREE.MathUtils.clamp(p.x, BOUNDS.minX, BOUNDS.maxX);
    p.z = THREE.MathUtils.clamp(p.z, BOUNDS.minZ, BOUNDS.maxZ);
    p.y = THREE.MathUtils.clamp(p.y, BOUNDS.minY, BOUNDS.maxY);
    camera.position.copy(p);
    camera.rotation.set(v.pitch, v.yaw, 0, "YXZ");
  });
  return null;
}
