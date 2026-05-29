# CIRO — Crisis Intelligence & Response Orchestrator

Full implementation per `DOC/BAZAR_CIRO_EXECUTION.md` using **Groq** (text + vision), not Claude.

## Agent pipeline

| Step | Agent | Firebase |
|------|--------|----------|
| Ingest | signalAggregator, RSS, Twitter, WhatsApp, user/incident reports | `signals/latest` |
| Detect | crisisDetector | `crisis_events/{id}` |
| Analyse | situationAnalyser | `crisis_situations/{id}` |
| Plan | responsePlanner | `response_plans/{id}` |
| Simulate | ciroExecutionSimulator + emergencyDispatcher | `simulation_state/{id}`, `emergency_tickets`, `emergency_dispatches` |
| Outcome | outcomeEngine | `outcome_metrics/{id}` |
| Map | actionSimulator | `map_routes/{area}`, `map_incidents/{area}` |

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/crisis` | Text → full CIRO pipeline |
| POST | `/api/report-crisis` | User report queue + pipeline |
| POST | `/api/incident` | Text + **photo (base64)** → Groq Vision + 1122 dispatch |
| GET | `/api/crisis-event/:id` | Event + situation + plan + simulation + outcome |
| POST | `/api/trigger` | Background agent cycle |

## Emergency auto-notify

`emergencyDispatcher` logs and WhatsApp-notifies (when phones set in `.env`):

- **Rescue 1122** (`1122`)
- **Police** (`15`)
- **Fire** (`16`) / **Edhi** (`115`) for accidents

```env
GROQ_API_KEY=...
GROQ_VISION_MODEL=llama-3.2-11b-vision-preview
RESCUE_1122_DISPATCH_PHONE=+92...   # Meta WhatsApp enabled number for demo
POLICE_DISPATCH_PHONE=+92...
CIRO_FAST_SIM=1                     # skip 1.5s delays between sim steps
```

## App screens

- **Report → Incident** — photo upload + CIRO + 1122
- **Admin → Crisis** — command centre + live simulation link
- **Map** — red markers for reported accidents/crises + route overlays

## Demo

1. `npm start` in `backend/`
2. App → Report → **Incident** → photo + "accident on M9"
3. Admin → **Crisis** → see event → **View live simulation**
4. **Map** → red pin + blocked/alternate routes
