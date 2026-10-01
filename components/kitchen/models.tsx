"use client";
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** CC0 models (see public/models/CREDITS.md). */
export const MODEL = {
  bananas: "/models/bananas/bananas.gltf",
  apple: "/models/food_apple_01/food_apple_01.gltf",
  lime: "/models/food_lime_01/food_lime_01.gltf",
  plant1: "/models/potted_plant_01/potted_plant_01.gltf",
  plant2: "/models/potted_plant_02/potted_plant_02.gltf",
  plant4: "/models/potted_plant_04/potted_plant_04.gltf",
  sofa: "/models/sofa_02/sofa_02.gltf",
  stool: "/models/bar_chair_round_01/bar_chair_round_01.gltf",
  bowl: "/models/wooden_bowl_01/wooden_bowl_01.gltf",
  lamp: "/models/modern_ceiling_lamp_01/modern_ceiling_lamp_01.gltf",
  bag: "/models/kenney/bag.glb",
  bar: "/models/kenney/candy-bar-wrapper.glb",
} as const;
Object.values(MODEL).forEach((u) => useGLTF.preload(u));

/**
 * A placed copy of a glTF scene, scaled so its height (or width) matches `height` (or `width`),
 * centered on x/z with its base at the given position.
 */
export function Model({ url, height, width, position = [0, 0, 0], rotation = 0, shadow = true }: {
  url: string; height?: number; width?: number; position?: [number, number, number]; rotation?: number; shadow?: boolean;
}) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const s = height ? height / size.y : width ? width / Math.max(size.x, size.z) : 1;
    c.scale.setScalar(s);
    const center = box.getCenter(new THREE.Vector3());
    c.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = shadow; o.receiveShadow = true; } });
    const g = new THREE.Group(); g.add(c); return g;
  }, [scene, height, width, shadow]);
  return <primitive object={obj} position={position} rotation={[0, rotation, 0]} />;
}

/** Bake a glTF scene into one geometry (world transforms applied), centered at origin and scaled to `size` (largest dimension). */
export function useBakedGeometry(url: string, size: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const geoms: THREE.BufferGeometry[] = [];
    let material: THREE.Material | null = null;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
      geoms.push(g.index ? g.toNonIndexed() : g);
      material ??= Array.isArray(m.material) ? m.material[0] : m.material;
    });
    const geom = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms)!;
    geom.computeBoundingBox();
    const bb = geom.boundingBox!, c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    geom.translate(-c.x, -c.y, -c.z);
    geom.scale(size / Math.max(s.x, s.y, s.z), size / Math.max(s.x, s.y, s.z), size / Math.max(s.x, s.y, s.z));
    return { geom, material: (material as THREE.Material | null)?.clone() ?? new THREE.MeshStandardMaterial() };
  }, [scene, size]);
}

/**
 * Split a geometry into two material groups: faces pointing along `axis` (photo, planar-mapped once)
 * and everything else (product color). Geometry must be centered at the origin.
 */
export function photoFront(src: THREE.BufferGeometry, axis: "z" | "y" = "z", threshold = 0.35) {
  const g = src.index ? src.toNonIndexed() : src.clone();
  g.computeBoundingBox();
  const bb = g.boundingBox!, size = bb.getSize(new THREE.Vector3());
  const pos = g.attributes.position;
  const tri = pos.count / 3;
  const front: number[] = [], rest: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < tri; t++) {
    a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
    n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    ((axis === "z" ? n.z : n.y) > threshold ? front : rest).push(t);
  }
  const order = [...front, ...rest];
  const P = new Float32Array(pos.count * 3), UV = new Float32Array(pos.count * 2);
  order.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      const s = t * 3 + k, d = i * 3 + k;
      const x = pos.getX(s), y = pos.getY(s), z = pos.getZ(s);
      P.set([x, y, z], d * 3);
      UV.set(axis === "z" ? [(x - bb.min.x) / size.x, (y - bb.min.y) / size.y] : [(x - bb.min.x) / size.x, 1 - (z - bb.min.z) / size.z], d * 2);
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(P, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(UV, 2));
  out.computeVertexNormals();
  out.addGroup(0, front.length * 3, 0);
  out.addGroup(front.length * 3, rest.length * 3, 1);
  return out;
}
