// Downloads CC0 glTF models (1k textures) from Poly Haven into public/models/<asset>/.
// Kenney Food Kit (CC0): https://kenney.nl/media/pages/assets/food-kit/83086fa91c-1719418518/kenney_food-kit.zip
//   unzip, then copy "Models/GLB format/{bag,candy-bar-wrapper,...}.glb" + Textures/ into public/models/kenney/.
import fs from "node:fs";
import path from "node:path";
const ASSETS = ["bananas", "food_apple_01", "food_lime_01", "potted_plant_01", "potted_plant_02", "potted_plant_04", "sofa_02", "bar_chair_round_01", "wooden_bowl_01", "modern_ceiling_lamp_01"];
for (const a of ASSETS) {
  const files = await fetch(`https://api.polyhaven.com/files/${a}`).then((r) => r.json());
  const g = files.gltf?.["1k"]?.gltf;
  if (!g) { console.log("MISS", a); continue; }
  const dir = `public/models/${a}`;
  const dl = async (url, rel) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(await fetch(url).then((r) => r.arrayBuffer()))); };
  await dl(g.url, `${a}.gltf`);
  for (const [rel, f] of Object.entries(g.include ?? {})) await dl(f.url, rel);
  console.log("OK  ", a);
}
