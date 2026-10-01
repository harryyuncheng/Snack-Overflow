"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * Constant-screen-size text label drawn to a canvas texture. Replaces drei <Html>,
 * which mounts a separate React root per label and warns when unmounted mid-render.
 */
export default function LabelSprite({ text, pos, bg = "#ffffff", fg = "#0c0a08", border = "#e5e7eb", height = 0.028 }: {
  text: string; pos: [number, number, number]; bg?: string; fg?: string; border?: string; height?: number;
}) {
  const { tex, aspect } = useMemo(() => {
    const scale = 4, fontPx = 10 * scale, padX = 8 * scale, h = 20 * scale;
    const c = document.createElement("canvas");
    const g = c.getContext("2d")!;
    const label = text.toUpperCase();
    g.font = `400 ${fontPx}px Inter, system-ui, sans-serif`;
    const w = Math.ceil(g.measureText(label).width + label.length * 0.018 * fontPx + padX * 2);
    c.width = w; c.height = h;
    g.fillStyle = bg; g.strokeStyle = border; g.lineWidth = scale;
    g.beginPath(); g.roundRect(scale / 2, scale / 2, w - scale, h - scale, 6 * scale); g.fill(); if (border !== bg) g.stroke();
    g.fillStyle = fg; g.font = `400 ${fontPx}px Inter, system-ui, sans-serif`; g.textBaseline = "middle";
    if ("letterSpacing" in g) (g as unknown as { letterSpacing: string }).letterSpacing = `${0.018 * fontPx}px`;
    g.fillText(label, padX, h / 2 + scale);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return { tex: t, aspect: w / h };
  }, [text, bg, fg, border]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <sprite position={pos} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={tex} sizeAttenuation={false} depthTest={false} transparent toneMapped={false} />
    </sprite>
  );
}
