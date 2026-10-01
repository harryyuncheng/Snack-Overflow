# SnackOverflow: feature backlog

The MVP covers: the walkable 3D kitchen with real product photos, a two-week timeline slider, semantic multi-ask search, crowdsourced votes, requests and restock flags, the forecasting order agent paid on a mock Ramp fund, and the savings dashboard. Everything below is a stretch goal.

## Next up
- **Camera stock sync (drinks first).** Point a webcam at the drink fridge (Fuze, Coke, Canada Dry…). A vision LLM counts cans and the 3D fridge updates live when someone takes one. Plumbing exists in `lib/vision.ts` + `/api/scan` (`VISION_MODE=live`); it needs UI and a polling loop.
- **Postgres.** Swap the in-memory store (`lib/store.ts`) for Postgres (Drizzle). Tables mirror `lib/types.ts`. Add pgvector for embeddings.
- **Real Ramp sandbox.** Implement `SandboxRamp` against `demo-api.ramp.com` / the `ramp` CLI: `issue_one_off_funds`, `get_agent_card_creds`, receipts, `submit_fund_request` for approvals over the threshold.
- **Slack.** Post the "eat me first", "back in stock", and restock notifications to #office-snacks. Run votes and requests from Slack.

## Later
- Hosted embeddings (`EMBEDDINGS_MODE=voyage|openai`) or local MiniLM via transformers.js. Cluster labels written by an LLM.
- Back-room / overflow storage as its own zone, with stock moving from the back room to shelves.
- Per-employee dietary profiles, so "for me" searches filter automatically. Dietary coverage targets in the agent.
- Free-text item feedback ("too sweet", "bag is huge") embedded and summarized per product.
- Donation partner integration and a kg diverted ledger.
- Multi-office comparison and benchmarking.
- Weekly leadership digest (`/api/digest`) delivered by email or Slack.
- Settings UI for the budget, cadence, safety stock, auto-approve threshold and time assumptions (API exists: `/api/settings`).
