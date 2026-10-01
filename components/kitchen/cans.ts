import * as THREE from "three";
import type { Product } from "@/lib/types";

/**
 * Real-looking beverage cans: a lathe-turned 12oz profile (domed base, straight body, necked shoulder, rim, lid)
 * with a flat brand label wrapped exactly once around the body. Labels are drawn, not photo-wrapped.
 */
export function canGeometry(w: number, h: number) {
  const r = w / 2;
  // [radius, height] profile from bottom center to top center, as fractions of r / h
  const prof: [number, number][] = [
    [0, 0.012], [0.62, 0.0], [0.86, 0.006], [0.97, 0.04], [1, 0.07], [1, 0.84], [0.97, 0.875], [0.86, 0.93],
    [0.8, 0.965], [0.82, 0.985], [0.8, 1.0], [0.74, 0.992], [0.72, 0.975], [0, 0.975],
  ];
  const pts = prof.map(([x, y]) => new THREE.Vector2(x * r, y * h - h / 2));
  const g = new THREE.LatheGeometry(pts, 40);
  // v by height (not by profile index) so the label lands on the straight body
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) + h / 2) / h);
  uv.needsUpdate = true;
  g.rotateY(Math.PI); // texture center (u = 0.5) faces +z, toward the viewer
  g.computeVertexNormals();
  return g;
}

type Design = { bg: string | string[]; fg: string; title: string; sub?: string; font?: string; band?: string; deco?: "wave" | "dots" | "crest" | "leaf" };
const DESIGNS: Record<string, Design> = {
  coke: { bg: "#d8161c", fg: "#ffffff", title: "Coca-Cola", sub: "ORIGINAL TASTE", font: "italic 700 74px Georgia, serif", deco: "wave" },
  "diet-coke": { bg: ["#e9eaec", "#b9bcc0"], fg: "#c4161c", title: "Diet Coke", sub: "", font: "700 70px Helvetica, Arial, sans-serif", band: "#111111" },
  "canada-dry": { bg: ["#1f8a4c", "#0d5a2f"], fg: "#ffffff", title: "Canada Dry", sub: "GINGER ALE", font: "italic 700 62px Georgia, serif", deco: "crest", band: "#d4af37" },
  "fuze-tea": { bg: ["#ffd23f", "#f29a1b"], fg: "#1b1b1b", title: "FUZE", sub: "ICED TEA · LEMON", font: "900 92px Arial Black, Arial, sans-serif", deco: "leaf" },
  "lacroix-lime": { bg: "#f7f7f2", fg: "#2a6e1a", title: "LaCroix", sub: "LIME · SPARKLING WATER", font: "italic 700 64px Georgia, serif", deco: "dots" },
  "lacroix-pamp": { bg: "#f7f7f2", fg: "#d2452f", title: "LaCroix", sub: "PAMPLEMOUSSE", font: "italic 700 64px Georgia, serif", deco: "dots" },
  "cold-brew": { bg: ["#3b2a20", "#1f1612"], fg: "#f3e6d3", title: "LA COLOMBE", sub: "COLD BREW · BLACK", font: "600 54px Georgia, serif" },
  "yerba-mate": { bg: ["#7cc242", "#3f8f2a"], fg: "#ffffff", title: "Guayakí", sub: "YERBA MATE", font: "italic 700 60px Georgia, serif", deco: "leaf" },
  sprite: { bg: ["#22a45a", "#0e7a3c"], fg: "#ffffff", title: "Sprite", sub: "LEMON-LIME", font: "italic 800 70px Helvetica, Arial, sans-serif", band: "#f4d23b" },
  "red-bull": { bg: ["#3a5fb5", "#c9ced6"], fg: "#d71f30", title: "Red Bull", sub: "ENERGY DRINK", font: "900 60px Arial Black, Arial, sans-serif", band: "#f2c400" },
  celsius: { bg: ["#ffffff", "#f4f4f4"], fg: "#ff6a13", title: "CELSIUS", sub: "SPARKLING ORANGE", font: "900 70px Arial Black, Arial, sans-serif", band: "#ff6a13" },
};

export function canLabelTexture(p: Product) {
  const d: Design = DESIGNS[p.id] ?? { bg: p.model3d.color, fg: "#ffffff", title: p.brand, sub: p.name.replace(p.brand, "").trim().toUpperCase() };
  const W = 1024, H = 512;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  // aluminium everywhere first (base dome, shoulder, lid)
  const metal = g.createLinearGradient(0, 0, 0, H);
  metal.addColorStop(0, "#e6e8eb"); metal.addColorStop(0.5, "#b7bcc2"); metal.addColorStop(1, "#dfe2e6");
  g.fillStyle = metal; g.fillRect(0, 0, W, H);
  // printed body: v 0.07..0.86  →  canvas y from top: (1 - v) * H
  const top = (1 - 0.865) * H, bot = (1 - 0.065) * H, bh = bot - top;
  if (Array.isArray(d.bg)) { const gr = g.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, d.bg[0]); gr.addColorStop(1, d.bg[1]); g.fillStyle = gr; } else g.fillStyle = d.bg;
  g.fillRect(0, top, W, bh);
  const cx = W / 2, cy = top + bh * 0.48;
  if (d.deco === "wave") {
    g.strokeStyle = "#ffffff"; g.lineWidth = 14;
    for (const off of [0, 26]) { g.beginPath(); for (let x = 0; x <= W; x += 8) g.lineTo(x, cy + 70 + off + Math.sin((x / W) * Math.PI * 4) * 18); g.stroke(); }
  } else if (d.deco === "dots") {
    const cols = [d.fg, "#2bb3c0", "#f2c53d", "#e8508f"];
    for (let i = 0; i < 26; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.85; g.beginPath(); g.arc((i * 137) % W, top + 30 + ((i * 71) % (bh - 60)), 10 + (i % 4) * 7, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  } else if (d.deco === "crest") {
    g.fillStyle = d.band ?? "#d4af37"; g.beginPath(); g.moveTo(cx - 42, top + 26); g.lineTo(cx + 42, top + 26); g.lineTo(cx + 34, top + 92); g.lineTo(cx, top + 112); g.lineTo(cx - 34, top + 92); g.closePath(); g.fill();
  } else if (d.deco === "leaf") {
    g.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 6; i++) { g.save(); g.translate((i * 190 + 60) % W, top + 40 + (i % 2) * (bh - 90)); g.rotate(i); g.beginPath(); g.ellipse(0, 0, 46, 18, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  }
  if (d.band) { g.fillStyle = d.band; g.fillRect(0, bot - 26, W, 14); g.fillRect(0, top + 12, W, 6); }
  // brand title + subtitle, centered on the front (u = 0.5)
  g.fillStyle = d.fg; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = d.font ?? "700 64px Helvetica, Arial, sans-serif";
  let size = parseInt(/(\d+)px/.exec(g.font)?.[1] ?? "64", 10);
  while (g.measureText(d.title).width > W * 0.42 && size > 24) { size -= 4; g.font = g.font.replace(/\d+px/, `${size}px`); }
  g.save(); g.translate(cx, cy); g.rotate(-Math.PI / 2 * 0); g.fillText(d.title, 0, -10); g.restore();
  if (d.sub) { g.font = "600 24px Helvetica, Arial, sans-serif"; g.fillText(d.sub, cx, cy + 46); }
  g.font = "500 14px Helvetica, Arial, sans-serif"; g.globalAlpha = 0.75; g.fillText("12 FL OZ (355 mL)", cx, bot - 46); g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
