# Snack Overflow 🥞
*Your office snacks, stacked by data.* Built for the Ramp × Blueprint "Amp it Up 2026" hackathon.

Snack Overflow runs a self-managed office snack program end to end. It shows what's in the pantry in a live 3D kitchen and learns what people actually eat and like from consumption, votes and natural-language requests. It drafts budget-aware orders across suppliers, catches expiring items, and pays on a Ramp fund with receipts attached automatically. The impact dashboard shows the $, hours and waste saved against an explicit baseline.

> All company, employee, product and price data is **fictional sample data** (Dunder Mifflin, Scranton, 60 employees, hybrid).

## Run
```bash
npm install
npm run dev     # http://localhost:3000
npm test        # Vitest: savings math + supplier picker
```
No keys needed: Ramp, vision and LLM all default to mock, and embeddings run locally. Copy `.env.example` to `.env.local` to enable live modes. Use **Reset demo** in the header to reseed.

## Screens
| Route | What |
|---|---|
| `/` **Kitchen** | Walk through a 3D office kitchen (drink fridge, fresh fridge, pantry, coffee bar, fruit bowl, freezer) stocked with real product photos. A **timeline slider** scrubs two weeks of hourly history plus a projected week: shelves empty through the day, deliveries arrive, duds get dropped and donated, Yerba Mate gets trialed. Ask in plain language, including multi-part asks ("meat, beef jerky and protein" → Jack Link's). Vote, flag **Restock**, and see the shared kitchen feed. |
| `/dashboard` | Savings / time / waste counters, the agent's next order → **Approve & pay with Ramp**, the Ramp fund, weekly spend & waste, savings by lever, every product (stock, velocity, liked %, supplier), request clusters, order history, methodology. |
| `/camera` | Phone camera mode. Sends a photo every 3s to Claude Haiku, which counts Coca-Cola and Canada Dry cans. Each confident reading sets stock right away: fewer cans log camera consumption, more cans add a batch. The kitchen refreshes every second and shows a toast for each changed can with its new stock. Needs `ANTHROPIC_API_KEY`. Phones only allow the camera over HTTPS, so open it through a tunnel such as `npx cloudflared tunnel --url http://localhost:3000`. |

Stretch features live in [`FEATURES.md`](FEATURES.md). The kitchen uses the Ramp design system ([`DESIGN.md`](DESIGN.md)).

## How savings are calculated (`lib/savings.ts`)
**Baseline**: a fixed weekly basket sized for full headcount × 5 days (+10% cushion), bought in whole cases from one supplier with no consumption data. These 8 weekly orders and their expiry waste are in the seed.
Savings are calculated per SKU, applying the levers in order so none of them double-count:
1. **Dropped duds**: bottom-velocity items with net-negative ratings.
2. **Right-sizing**: baseline case quantity → measured demand at full headcount.
3. **Attendance scaling**: full headcount → actual in-office person-days.
4. **Supplier switching**: baseline supplier → cheapest offer per unit.

Time saved comes from editable minute assumptions (counting, polling, ordering, receipts, reconciliation). Waste uses the logged baseline waste compared with a conservative projection.

## Architecture
- `lib/seed.ts`: deterministic seeded generator (fixed RNG). `lib/catalog.ts`: 43 real-brand products with zones, flavors, dietary tags and 3D shapes. Photos come from Open Food Facts via `scripts/fetch-images.mjs` → `public/snacks/`.
- `lib/timeline.ts`: hourly simulation (8:00–18:00 workdays) covering week 1 as the old fixed basket and week 2+ with Snack Overflow on, plus a projected next week. It produces the slider frames, events, current inventory, consumption, waste and orders.
- `lib/store.ts`: in-memory repository on `globalThis`. Product and category embeddings are precomputed at boot.
- `lib/embeddings/`: `Embedder` interface. The default `local-lite` is an offline concept-expanded hashed embedder (384-d), with hosted Voyage and OpenAI behind the same interface.
- `lib/semantic.ts`: search (with negation like "isn't chips" and hard dietary filters), request matching, threshold clustering, substitutes.
- `lib/analytics.ts`: EWMA velocity per in-office person-day, ratings, quadrants. `lib/forecast.ts`: ordering agent (demand, safety stock, shelf-life cap, supplier break-even, dud swaps, cluster trials, budget trim).
- `lib/ramp.ts`: `RampAdapter` mirroring Ramp agent tools (`issue_one_off_funds`, `get_funds`, `get_agent_card_creds`, transactions, `answer_policy_question`). `MockRamp` is implemented. A sandbox adapter slots in at `createRamp`.
- `lib/vision.ts`: zod-validated detections, with mock and Claude vision modes. `lib/llm.ts`: optional Claude polish of the order rationale and the digest.

## What's mocked
Ramp (mock fund + agent card + receipts), the vision detections (unless `VISION_MODE=live`), notifications, the donation partner, and supplier catalogs/prices. Company and people are fictional sample data; product names and photos are real brands used for the demo.
