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

## Pages
| Route | What |
|---|---|
| `/` | 3D kitchen (drink fridge, fresh fridge, pantry, coffee bar, fruit bowl, freezer). Zone fly-to, fridge doors, hover tooltips, click panel with votes + sparkline + embedding neighbors. Popularity / waste / dietary overlays. Semantic search that lights up matching items, and requests that are "fulfilled from stock". |
| `/scan` | Webcam/upload shelf scan → detections (mock or Claude vision) → consumption events + minutes saved |
| `/ecosystem` | Velocity × rating quadrant (stars, guilty pleasures, aspirational, duds), leaderboards, request clusters, demand by category |
| `/orders` | Forecasting ordering agent: draft → approve → paid on the Ramp fund (mock agent card) → inventory received. Includes a Ramp policy Q&A. |
| `/waste` | Expiring batches with "eat me first" (mock Slack nudge) and donate actions, plus waste concentration charts |
| `/impact` | $ saved by lever, hours saved by task, waste reduction, cost/employee vs benchmark, weekly digest, methodology |
| `/settings` | Budget, cadence, safety stock, auto-approve threshold, editable time assumptions |

## How savings are calculated (`lib/savings.ts`)
**Baseline**: a fixed weekly basket sized for full headcount × 5 days (+10% cushion), bought in whole cases from one supplier with no consumption data. These 8 weekly orders and their expiry waste are in the seed.
Savings are calculated per SKU, applying the levers in order so none of them double-count:
1. **Dropped duds**: bottom-velocity items with net-negative ratings.
2. **Right-sizing**: baseline case quantity → measured demand at full headcount.
3. **Attendance scaling**: full headcount → actual in-office person-days.
4. **Supplier switching**: baseline supplier → cheapest offer per unit.

Time saved comes from editable minute assumptions (counting, polling, ordering, receipts, reconciliation). Waste uses the logged baseline waste compared with a conservative projection.

## Architecture
- `lib/seed.ts`: deterministic seeded generator (fixed RNG). `lib/catalog.ts`: 41 products with zones, flavors, dietary tags and 3D shapes.
- `lib/store.ts`: in-memory repository on `globalThis`. Product and category embeddings are precomputed at boot.
- `lib/embeddings/`: `Embedder` interface. The default `local-lite` is an offline concept-expanded hashed embedder (384-d), with hosted Voyage and OpenAI behind the same interface.
- `lib/semantic.ts`: search (with negation like "isn't chips" and hard dietary filters), request matching, threshold clustering, substitutes.
- `lib/analytics.ts`: EWMA velocity per in-office person-day, ratings, quadrants. `lib/forecast.ts`: ordering agent (demand, safety stock, shelf-life cap, supplier break-even, dud swaps, cluster trials, budget trim).
- `lib/ramp.ts`: `RampAdapter` mirroring Ramp agent tools (`issue_one_off_funds`, `get_funds`, `get_agent_card_creds`, transactions, `answer_policy_question`). `MockRamp` is implemented. A sandbox adapter slots in at `createRamp`.
- `lib/vision.ts`: zod-validated detections, with mock and Claude vision modes. `lib/llm.ts`: optional Claude polish of the order rationale and the digest.

## What's mocked
Ramp (mock fund + agent card + receipts), the vision detections (unless `VISION_MODE=live`), the Slack notification, the donation partner, and supplier catalogs/prices.
