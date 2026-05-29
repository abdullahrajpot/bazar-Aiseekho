# .env checklist (Bazar + CIRO)

Compare your `bazar_new/.env` with this list. **Do not commit `.env` to git.**

## Already present (you have these)

| Variable | Used for |
|----------|----------|
| `GROQ_API_KEY` | All CIRO agents (text + optional vision) |
| `GROQ_MODEL` | Groq chat model |
| `OPENWEATHER_API_KEY` | Per-area weather signals |
| `OPENROUTESERVICE_API_KEY` | Truck routing (or use OSRM fallback) |
| `whatsapp` / `WHATSAPP_TOKEN` | Outbound WhatsApp (1122 demo dispatch) |
| `WHATSAPP_PHONE_ID` | Meta Graph API |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps in app |
| `BACKEND_URL` | App → backend |
| `DISPATCH_DRIVER_PHONE` | WhatsApp alert target |
| `PORT` | Backend port |

Firebase for the **mobile app** is in `src/lib/config.ts` (not empty `.env` EXPO_PUBLIC_* — that is OK).

## Add these (recommended for CIRO)

| Variable | Why |
|----------|-----|
| `GROQ_VISION_MODEL=llama-3.2-11b-vision-preview` | Incident **photo** analysis |
| `USE_OSRM_ONLY=1` | Avoid ORS 403/rate limits |
| `CIRO_FAST_SIM=1` | Faster demo simulation steps |
| `WHATSAPP_VERIFY_TOKEN=bazar_ciro` | WhatsApp webhook verify |
| `RESCUE_1122_DISPATCH_PHONE=+92...` | WhatsApp to your demo “1122” number |
| `POLICE_DISPATCH_PHONE=+92...` | Police dispatch demo |
| `CIRO_ALERT_PHONE=+92...` | Same as driver phone if one device |

## Optional

| Variable | Why |
|----------|-----|
| `TWITTER_BEARER_TOKEN` | Live X/Twitter signals |
| `WHATSAPP_SIMULATED_SIGNALS=[{"text":"G-10 mein pani...","area":"Islamabad"}]` | Demo flood without Twitter |
| `DAWN_RSS_URL`, `ARY_RSS_URL`, `GEO_RSS_URL` | Defaults work if omitted |
| `HERE_API_KEY` | Not needed if using OSRM |

## Empty in your file (OK to leave empty)

| Variable | Note |
|----------|------|
| `HERE_API_KEY` | Optional; OSRM replaces it |
| `EXPO_PUBLIC_FIREBASE_*` | App uses `config.ts` instead |

## Android emulator

If the app cannot reach the backend, set:

```env
BACKEND_URL=http://10.0.2.2:3000
```

(Physical phone on same Wi‑Fi: use your PC IP, e.g. `http://192.168.1.5:3000`)

## Clear old Firebase data (why UI looked “stale”)

In [Firebase Console](https://console.firebase.google.com) → Realtime Database, you can delete old nodes:

- `truth_feed` (entries without `area` field)
- `shops` / seeded `prices` from old demo seeder
- Old `supply_status` keys: `m9_main`, global duplicates

New runs write: `crisis_events`, `map_incidents`, `crisis_affected_zones`, `regional_market/{area}`.

Then pull-to-refresh in the app or `POST /api/trigger`.
