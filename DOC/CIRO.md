# CIRO — Crisis Intelligence & Response Orchestrator

Bazar implements the hackathon **CIRO** flow as a multi-agent pipeline (Antigravity-style: plan → decide → execute).

## Agent workflow

| Stage | Agent | Output |
|-------|--------|--------|
| 1. Ingest | `signalAggregator` + `whatsappIngest` | Twitter, WhatsApp, weather, maps, NDMA, Google News |
| 2. Detect | `crisisDetector` | `crisis_situations/{area}` — type, confidence, impact |
| 3. Plan | `actionPlanner` | `crisis_actions/{area}` — routing, alerts, dispatch |
| 4. Simulate | `actionSimulator` | `crisis_simulation/{area}`, `map_routes/{area}`, `emergency_tickets/{area}` |
| 5. Publish | `truthPublisher`, push, WhatsApp | Alerts, logs, map updates |

Orchestrated by `lib/ciroPipeline.js` and `lib/areaAgent.js` (per user area).

## APIs

- `POST /api/trigger` — run full cycle
- `GET /api/ciro/:areaKey` — situation + simulation + map routes
- `GET/POST /api/whatsapp/webhook` — Meta WhatsApp inbound

## Demo: G-10 flood (Islamabad)

Add to `.env`:

```env
WHATSAPP_SIMULATED_SIGNALS=[{"text":"G-10 mein pani bhar gaya hai, gaariyan phans gayi hain","area":"Islamabad"}]
```

Select **Islamabad** in Profile → pull to refresh → CIRO panel shows urban flooding, simulated reroute, emergency ticket.

## Google Antigravity

Use Antigravity in your hackathon repo to **orchestrate** the same stages (tool calls to Maps, Search, this backend `/api/trigger`). This codebase is the **execution runtime** those agents write into (Firebase + Expo).
