import * as THREE from "three";
import type { Product } from "@/lib/types";

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** deterministic 0..1 from a product id + unit index (+ channel) so scrubbing never reshuffles */
export const rand = (seed: string, i: number, k = 0) => (hash(`${seed}:${i}:${k}`) % 100000) / 100000;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!] as const;
}

const labelCache = new Map<string, THREE.Texture>();
export function labelTexture(p: Product) {
  const hit = labelCache.get(p.id);
  if (hit) return hit;
  const [c, g] = canvas(256, 256);
  g.fillStyle = p.model3d.color; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(0, 168, 256, 88);
  g.font = "110px serif"; g.textAlign = "center"; g.fillText(p.emoji, 128, 132);
  g.fillStyle = "#0c0a08"; g.font = "28px sans-serif";
  g.fillText(p.name.split(" ").slice(0, 2).join(" ").slice(0, 16), 128, 208);
  g.font = "20px sans-serif"; g.fillText(p.brand.slice(0, 20), 128, 240);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(p.id, t);
  return t;
}

const photoCache = new Map<string, THREE.Texture>();
const loader = typeof window !== "undefined" ? new THREE.TextureLoader() : null;
/** Real product photo; calls back once loaded (cached). Silently keeps the canvas label on failure. */
export function loadPhoto(p: Product, onLoad: (t: THREE.Texture) => void) {
  if (!p.image || !loader) return;
  const hit = photoCache.get(p.id);
  if (hit) { onLoad(hit); return; }
  loader.load(p.image, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    photoCache.set(p.id, t);
    onLoad(t);
  }, undefined, () => {});
}

export function woodFloorTexture() {
  const [c, g] = canvas(1024, 1024);
  const rows = 12, ph = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -((r * 397) % 600);
    let k = 0;
    while (x < 1024) {
      const len = 380 + ((hash(`p${r}:${k}`) % 1000) / 1000) * 420;
      const tone = (hash(`t${r}:${k}`) % 1000) / 1000;
      const l = 52 + tone * 12;
      g.fillStyle = `hsl(${28 + tone * 6}, ${38 + tone * 10}%, ${l}%)`;
      g.fillRect(x, r * ph, len, ph);
      // grain
      for (let s = 0; s < 14; s++) {
        const yy = r * ph + ((hash(`g${r}:${k}:${s}`) % 1000) / 1000) * ph;
        g.strokeStyle = `rgba(70,40,20,${0.05 + ((s * 37) % 10) / 120})`;
        g.lineWidth = 1 + (s % 3);
        g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + 3, x + len * 0.6, yy - 3, x + len, yy + 1); g.stroke();
      }
      g.fillStyle = "rgba(40,22,10,0.55)"; g.fillRect(x, r * ph, 2, ph);
      x += len; k++;
    }
    g.fillStyle = "rgba(40,22,10,0.45)"; g.fillRect(0, r * ph, 1024, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function subwayTileTexture() {
  const [c, g] = canvas(512, 256);
  g.fillStyle = "#cfc8bd"; g.fillRect(0, 0, 512, 256);
  const tw = 128, th = 64;
  for (let r = 0; r < 4; r++) for (let i = -1; i < 5; i++) {
    const x = i * tw + (r % 2 ? tw / 2 : 0), y = r * th;
    const v = 238 + (hash(`tile${r}${i}`) % 12);
    g.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
    g.fillRect(x + 3, y + 3, tw - 6, th - 6);
    g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(x + 6, y + 6, tw - 30, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function windowSkyTexture() {
  const [c, g] = canvas(256, 256);
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, "#9cc7ee"); grd.addColorStop(0.65, "#dcecf8"); grd.addColorStop(0.66, "#9aa7a0"); grd.addColorStop(1, "#6f7d73");
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  // distant buildings
  for (let i = 0; i < 9; i++) {
    const w = 18 + (hash(`b${i}`) % 30), h = 40 + (hash(`bh${i}`) % 90), x = i * 30 - 6;
    g.fillStyle = `rgba(120,135,150,${0.55 + (i % 3) * 0.1})`; g.fillRect(x, 168 - h, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const tagCache = new Map<string, THREE.Texture>();
/** small shelf-edge price tag, like a real pantry planogram label */
export function shelfTagTexture(p: Product, price: string) {
  const key = `${p.id}:${price}`;
  const hit = tagCache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(256, 64);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#0c0a08"; g.font = "22px sans-serif";
  g.fillText(p.name.slice(0, 20), 10, 28);
  g.fillStyle = "#6d6c6b"; g.font = "18px sans-serif"; g.fillText(price, 10, 54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  tagCache.set(key, t);
  return t;
}

export function corkTexture() {
  const [c, g] = canvas(256, 160);
  g.fillStyle = "#b98a56"; g.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = `rgba(${90 + (i % 60)},${60 + (i % 40)},30,0.35)`;
    g.fillRect(hash(`cx${i}`) % 256, hash(`cy${i}`) % 160, 2, 2);
  }
  const notes: [number, number, string, string][] = [[14, 14, "#fff59d", "SNACK\nPOLL →\nvote in app"], [92, 22, "#ffffff", "Fridge\ncleanout\nFRIDAY"], [170, 12, "#c8e6c9", "Taco\nTuesday!"], [40, 90, "#ffccbc", "Who took\nmy yogurt"], [130, 92, "#e4f222", "Snack\nOverflow\nlive ✓"]];
  for (const [x, y, col, txt] of notes) {
    g.save(); g.translate(x + 30, y + 26); g.rotate(((hash(txt) % 100) - 50) / 600);
    g.fillStyle = col; g.fillRect(-30, -26, 62, 54);
    g.fillStyle = "#c62828"; g.beginPath(); g.arc(0, -22, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#222"; g.font = "9px sans-serif";
    txt.split("\n").forEach((l, i) => g.fillText(l, -26, -8 + i * 11));
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Ramp-branded wall banner: highlighter field, near-black wordmark. */
export function rampBannerTexture() {
  const c = document.createElement("canvas");
  c.width = 1536; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e4f222"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#0c0a08";
  g.font = "600 150px Inter, Helvetica, Arial, sans-serif"; g.textBaseline = "middle";
  g.fillText("ramp", 70, 120);
  // small angled mark next to the wordmark
  g.beginPath(); g.moveTo(420, 175); g.lineTo(480, 60); g.lineTo(505, 60); g.lineTo(445, 175); g.closePath(); g.fill();
  g.font = "400 46px Inter, Helvetica, Arial, sans-serif";
  g.fillText("Office Snacks fund", 620, 100);
  g.fillStyle = "#3a3a2a"; g.font = "400 34px Inter, Helvetica, Arial, sans-serif";
  g.fillText("Every snack paid on Ramp · receipts auto-attached", 620, 160);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** Dark "Snack Overflow" sign with a highlighter accent. */
export function snackSignTexture() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 192;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1a1919"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#e4f222"; g.beginPath(); g.roundRect(48, 52, 88, 88, 14); g.fill();
  g.fillStyle = "#0c0a08"; g.font = "600 64px Inter, Helvetica, Arial, sans-serif"; g.textBaseline = "middle"; g.textAlign = "center"; g.fillText("S", 92, 100);
  g.textAlign = "left"; g.fillStyle = "#ffffff"; g.font = "400 76px Inter, Helvetica, Arial, sans-serif"; g.fillText("Snack Overflow", 170, 100);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
