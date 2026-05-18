# BAZAR — Complete Fix & Improvement Prompt for IDE

Paste this entire prompt into your IDE (Cursor / Windsurf). Read every section before writing any code.

---

## THE CORE PROBLEM

The current app has agents running on the backend and screens on the frontend but they are NOT connected. Agents either write to wrong Firebase paths, or write correctly but hooks read from different paths, or hooks read correctly but screens still show hardcoded mock data. The map shows a static tile only. Truth cards are static. Prices are hardcoded arrays.

Fix this in order. Do not touch UI design or add new features until Steps 1–4 are verified working.

---

## STEP 1 — FIX FIREBASE WRITE PATHS IN ALL AGENTS

This is the root cause of everything being broken. Open each agent file and verify it writes to EXACTLY these Firebase paths after every Claude API call. If the path is different anywhere, fix it.

### `backend/agents/supplyBreakDetector.js`

After Claude returns the break analysis JSON, write ALL THREE of these:

```javascript
const db = require('../lib/firebaseAdmin').db;

// Write 1: update supply_status for the affected road
await db.ref(`supply_status/${breakResult.road}`).set({
  status: breakResult.break ? 'blocked' : 'clear',
  goodsAffected: breakResult.goods,
  severity: breakResult.severity,
  alternate: 'N55',        // from supplyGraph.json alternates array
  extraMinutes: 30,
  updatedAt: Date.now()
});

// Write 2: agent log entry
await db.ref('agent_log').push({
  agent: 'supply_break_detector',
  action: breakResult.break ? 'break_confirmed' : 'all_clear',
  detail: breakResult.reasoning,
  severity: breakResult.break ? 'critical' : 'info',
  rawOutput: JSON.stringify(breakResult),
  timestamp: Date.now()
});

// Write 3: admin stats increment
if (breakResult.break) {
  await db.ref('admin_stats/breaksDetected').transaction(n => (n || 0) + 1);
}
```

### `backend/agents/rumourDetector.js`

After Claude returns the verdict JSON, write ALL THREE of these:

```javascript
// Write 1: truth_feed entry — area field is MANDATORY
const claimId = db.ref('truth_feed').push().key;
await db.ref(`truth_feed/${claimId}`).set({
  text: originalClaimText,
  verdict: result.verdict,
  confidence: result.confidence,
  reasonUrdu: result.reasonUrdu,
  reasonEnglish: result.reasonEnglish,
  counterMessageUrdu: result.counterMessageUrdu || null,
  area: signalArea,          // e.g. 'surjani' — THIS IS HOW THE HOOK FILTERS
  source: 'twitter',
  timestamp: Date.now()
});

// Write 2: agent log
await db.ref('agent_log').push({
  agent: 'rumour_detector',
  action: result.verdict === 'false' ? 'false_claim_flagged' : 'claim_' + result.verdict,
  detail: `Claim: "${originalClaimText.substring(0, 60)}..." → ${result.verdict}`,
  severity: result.verdict === 'false' ? 'warning' : 'info',
  rawOutput: JSON.stringify(result),
  timestamp: Date.now()
});

// Write 3: increment rumours suppressed if false
if (result.verdict === 'false') {
  await db.ref('admin_stats/rumoursSuppressed').transaction(n => (n || 0) + 1);
  // Also send Expo push to khareedar users in this area
  await sendAreaPushNotification(signalArea, 'khareedar', {
    title: 'Jhoot pakra gaya ⚠️',
    body: result.counterMessageUrdu?.substring(0, 100) || 'Ek jhoot ki tashreeh ki gayi hai',
    type: 'truth_update'
  });
}
```

### `backend/agents/priceEngine.js`

The current code listens to the wrong Firebase path. Fix the listener AND the write paths:

```javascript
// WRONG — remove this:
// db.ref('prices').on('child_changed', ...)

// CORRECT — listen to the submissions queue (transient, separate from verdicts):
db.ref('price_submissions').on('child_added', async (snapshot) => {
  const submission = snapshot.val();
  const submissionKey = snapshot.key;

  // Run price assessment
  const result = await assessPrice(submission);

  // Write 1: verdict back into the PRICES node (not submissions)
  await db.ref(`prices/${submission.area}/${submission.itemId}/reports/${submissionKey}`).set({
    price: submission.price,
    shopId: submission.shopId,
    shopName: submission.shopName,
    submittedBy: submission.submittedBy,
    submitterUid: submission.submitterUid,
    verdict: result.verdict,
    fairPrice: result.fairPrice,
    percentOver: result.percentOver,
    timestamp: submission.timestamp
  });

  // Write 2: update fair price on the item node
  await db.ref(`prices/${submission.area}/${submission.itemId}/fairPrice`).set(result.fairPrice);

  // Write 3: agent log
  await db.ref('agent_log').push({
    agent: 'price_engine',
    action: result.verdict === 'gouging' ? 'gouging_flagged' : 'price_verified_' + result.verdict,
    detail: `${submission.shopName} — ${submission.itemId}: Rs ${submission.price} → ${result.verdict} (fair: Rs ${result.fairPrice})`,
    severity: result.verdict === 'gouging' ? 'warning' : 'info',
    rawOutput: JSON.stringify(result),
    timestamp: Date.now()
  });

  // Write 4: if gouging, update shop reputation
  if (result.verdict === 'gouging') {
    await db.ref(`shops/${submission.shopId}/reputation`).set('flagged');
    await db.ref(`shops/${submission.shopId}/warningCount`).transaction(n => (n || 0) + 1);
    await db.ref('admin_stats/gougingShopsFlagged').transaction(n => (n || 0) + 1);
    // Send Twilio WhatsApp to dukandar
    await sendDukandarWhatsApp(submission.shopPhone, result.dukandarMessageUrdu);
  }

  // Write 5: remove from submissions queue after processing
  await db.ref(`price_submissions/${submissionKey}`).remove();
});
```

### `backend/agents/supplyRouter.js`

After BFS completes and Claude generates dispatch messages, write these:

```javascript
// Write 1: update supply_status with alternate route activated
await db.ref(`supply_status/${breakResult.road}`).update({
  alternate: routerResult.alternateRoute,
  extraMinutes: routerResult.etaExtraMinutes,
  reroutedAt: Date.now(),
  publicAlertUrdu: routerResult.publicAlertUrdu
});

// Write 2: agent log
await db.ref('agent_log').push({
  agent: 'supply_router',
  action: 'trucks_rerouted',
  detail: `${routerResult.reroutedTrucks} trucks via ${routerResult.alternateRoute}. ETA +${routerResult.etaExtraMinutes} min.`,
  severity: 'info',
  rawOutput: JSON.stringify(routerResult),
  timestamp: Date.now()
});

// Write 3: admin stats
await db.ref('admin_stats/routesRerouted').transaction(n => (n || 0) + 1);

// Write 4: send Twilio WhatsApp to truck drivers (use registered driver phones)
const driverPhones = await getRegisteredDriverPhones(breakResult.road);
for (const phone of driverPhones) {
  await sendTruckWhatsApp(phone, routerResult.truckSmsUrdu);
}

// Write 5: send push notification to all dukandar in affected areas
for (const area of breakResult.areas) {
  await sendAreaPushNotification(area, 'dukandar', {
    title: 'Supply Update',
    body: routerResult.publicAlertUrdu?.substring(0, 100),
    type: 'supply_update'
  });
}
```

---

## STEP 2 — FIX ALL FIREBASE HOOKS IN THE REACT NATIVE APP

Open each hook file and verify it reads from EXACTLY the same paths the agents write to.

### `hooks/useMarketPrices.ts` — reads `prices/{area}/{itemId}/reports`

```typescript
import { ref, onValue, off } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useState, useEffect } from 'react';
import { ITEM_NAMES, BASELINE_PRICES } from '@/lib/constants';

export interface PriceReport {
  id: string;
  itemId: string;
  itemName: string;
  itemNameUrdu: string;
  price: number;
  fairPrice: number;
  shopId: string;
  shopName: string;
  verdict: 'fair' | 'high' | 'gouging' | null;
  percentOver: number;
  timestamp: number;
}

export function useMarketPrices(area: string) {
  const [prices, setPrices] = useState<PriceReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!area) return;
    // Path must match exactly what priceEngine.js writes to
    const priceRef = ref(db, `prices/${area}`);

    const unsub = onValue(priceRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setPrices([]); setLoading(false); return; }

      const list: PriceReport[] = [];

      Object.entries(data).forEach(([itemId, itemData]: [string, any]) => {
        const fairPrice = itemData.fairPrice || BASELINE_PRICES[itemId]?.normal || 0;
        Object.entries(itemData.reports || {}).forEach(([reportId, report]: [string, any]) => {
          list.push({
            id: reportId,
            itemId,
            itemName: ITEM_NAMES[itemId]?.english || itemId,
            itemNameUrdu: ITEM_NAMES[itemId]?.urdu || itemId,
            price: report.price,
            fairPrice,
            shopId: report.shopId,
            shopName: report.shopName,
            verdict: report.verdict || null,
            percentOver: report.percentOver || 0,
            timestamp: report.timestamp,
          });
        });
      });

      // Sort gouging first so consumers see the warnings immediately
      list.sort((a, b) => {
        const order: Record<string, number> = { gouging: 0, high: 1, fair: 2 };
        return (order[a.verdict ?? ''] ?? 3) - (order[b.verdict ?? ''] ?? 3);
      });

      setPrices(list);
      setLoading(false);
    });

    return () => off(priceRef);
  }, [area]);

  return { prices, loading };
}
```

### `hooks/useTruthFeed.ts` — reads `truth_feed` filtered by area

```typescript
export function useTruthFeed(area: string) {
  const [claims, setClaims] = useState<TruthClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!area) return;
    // Read the entire truth_feed node — filter by area client-side
    // (Firebase RTDB has limited query support — this is intentional)
    const feedRef = ref(db, 'truth_feed');

    const unsub = onValue(feedRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setClaims([]); setLoading(false); return; }

      const list: TruthClaim[] = Object.entries(data)
        .map(([id, claim]: [string, any]) => ({ id, ...claim }))
        // Filter: show claims for this area AND claims with no area (general)
        .filter(c => !c.area || c.area === area)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20); // Last 20 claims

      setClaims(list);
      setLoading(false);
    });

    return () => off(feedRef);
  }, [area]);

  return { claims, loading };
}
```

### `hooks/useSupplyStatus.ts` — reads `supply_status`

```typescript
export function useSupplyStatus() {
  const [routes, setRoutes] = useState<Record<string, RouteStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Path must match exactly what supplyBreakDetector.js and supplyRouter.js write to
    const statusRef = ref(db, 'supply_status');

    const unsub = onValue(statusRef, (snapshot) => {
      setRoutes(snapshot.val() || {});
      setLoading(false);
    });

    return () => off(statusRef);
  }, []);

  return { routes, loading };
}
```

### `hooks/useAgentLog.ts` — reads `agent_log` last 50 entries

```typescript
import { ref, onValue, off, query, orderByChild, limitToLast } from 'firebase/database';

export function useAgentLog() {
  const [entries, setEntries] = useState<AgentLogEntry[]>([]);

  useEffect(() => {
    // Use Firebase query to get only last 50 entries — never pull entire log
    const logQuery = query(
      ref(db, 'agent_log'),
      orderByChild('timestamp'),
      limitToLast(50)
    );

    const unsub = onValue(logQuery, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setEntries([]); return; }

      const list = Object.entries(data)
        .map(([id, entry]: [string, any]) => ({ id, ...entry }))
        .sort((a, b) => b.timestamp - a.timestamp); // newest first

      setEntries(list);
    });

    return () => off(ref(db, 'agent_log'));
  }, []);

  return entries;
}
```

### `hooks/useAdminStats.ts` — reads `admin_stats`

```typescript
export function useAdminStats() {
  const [stats, setStats] = useState({
    breaksDetected: 0,
    routesRerouted: 0,
    rumoursSuppressed: 0,
    gougingShopsFlagged: 0,
    familiesServedEstimate: 0,
    priceSpikeReducedPercent: 0,
  });

  useEffect(() => {
    const statsRef = ref(db, 'admin_stats');
    const unsub = onValue(statsRef, (snapshot) => {
      setStats(prev => ({ ...prev, ...(snapshot.val() || {}) }));
    });
    return () => off(statsRef);
  }, []);

  return stats;
}
```

---

## STEP 3 — REMOVE ALL MOCK DATA FROM SCREENS

Go through every screen file. Search for:
- `const prices = [` — delete, replace with `const { prices, loading } = useMarketPrices(area)`
- `const claims = [` — delete, replace with `const { claims, loading } = useTruthFeed(area)`
- `const routes = {` with hardcoded route data — delete, replace with `const { routes, loading } = useSupplyStatus()`
- Any array of objects with hardcoded shop names, prices, or verdict values — DELETE ALL OF THEM

Add `LoadingState` component for when hooks are still fetching:

```typescript
// components/shared/LoadingState.tsx
import { View, ActivityIndicator, Text } from 'react-native';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator size="large" color="#1D9E75" />
      <Text style={{ marginTop: 12, fontSize: 14, color: '#5A6370' }}>{message}</Text>
    </View>
  );
}
```

Use it in every screen:
```typescript
if (loading) return <LoadingState message="Prices load ho rahi hain..." />;
if (prices.length === 0) return <EmptyState message="Abhi koi prices nahi hain." />;
```

---

## STEP 4 — FIX THE CRISIS MAP (Most Important Visual Fix)

The crisis map is the most impactful screen for demos and judges. It currently shows a static map tile. Replace the entire `admin/map.tsx` with this real implementation.

### Install dependencies first:
```bash
npx expo install react-native-maps
```

### `app/(tabs)/admin/map.tsx`

```typescript
import MapView, { Polyline, Marker, Circle } from 'react-native-maps';
import { useSupplyStatus } from '@/hooks/useSupplyStatus';
import { useShops } from '@/hooks/useShops';
import { useTruthFeed } from '@/hooks/useTruthFeed';
import { MONITORED_ROUTES } from '@/lib/constants';

// ROUTE COORDINATE PATHS — these are the actual GPS coordinates for each monitored road
// These do NOT come from an API — they are fixed road coordinates stored in constants.ts
const ROUTE_COORDINATES = {
  M9_surjani: [
    { latitude: 24.8607, longitude: 67.0011 },
    { latitude: 24.8720, longitude: 67.0180 },
    { latitude: 24.8890, longitude: 67.0350 },
    { latitude: 24.9050, longitude: 67.0520 },
    { latitude: 24.9214, longitude: 67.0686 },
  ],
  N55_alt: [
    { latitude: 24.8607, longitude: 67.0011 },
    { latitude: 24.8500, longitude: 66.9800 },
    { latitude: 24.8650, longitude: 66.9600 },
    { latitude: 24.8900, longitude: 66.9700 },
    { latitude: 24.9214, longitude: 67.0686 },
  ],
  SHP_mandi: [
    { latitude: 24.8588, longitude: 67.0104 },
    { latitude: 24.8600, longitude: 67.0300 },
    { latitude: 24.8620, longitude: 67.0500 },
    { latitude: 24.8632, longitude: 67.0578 },
  ],
  local_orangi: [
    { latitude: 24.9101, longitude: 67.0219 },
    { latitude: 24.9200, longitude: 67.0300 },
    { latitude: 24.9286, longitude: 67.0401 },
  ],
};

// Route colour by status — these are the three states agents write to Firebase
const ROUTE_COLORS = {
  clear:   '#1D9E75',  // green
  partial: '#BA7517',  // amber
  blocked: '#E24B4A',  // red
};

// Shop marker colour by reputation — matches what priceEngine writes to shops/{shopId}/reputation
const SHOP_COLORS = {
  fair:     '#1D9E75',
  at_risk:  '#BA7517',
  flagged:  '#E24B4A',
};

export default function CrisisMap() {
  const { routes } = useSupplyStatus();   // reads supply_status from Firebase
  const { shops } = useShops();           // reads shops from Firebase
  const { claims } = useTruthFeed('');    // reads truth_feed, no area filter for map

  // Areas with active false rumours — used to draw red alert circles on map
  const rumourAreas = claims
    .filter(c => c.verdict === 'false')
    .map(c => AREA_COORDINATES[c.area])
    .filter(Boolean);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        provider="google"
        initialRegion={{
          latitude: 24.8888,
          longitude: 67.0350,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
      >

        {/* Route overlays — one Polyline per monitored route */}
        {Object.entries(routes).map(([routeId, routeData]) => {
          const coords = ROUTE_COORDINATES[routeId];
          if (!coords) return null;
          const status = routeData.status || 'clear';
          const isBlocked = status === 'blocked';

          return (
            <React.Fragment key={routeId}>
              {/* Main route line */}
              <Polyline
                coordinates={coords}
                strokeColor={ROUTE_COLORS[status] || '#888'}
                strokeWidth={isBlocked ? 5 : 3}
                lineDashPattern={status === 'partial' ? [10, 5] : undefined}
              />
              {/* If blocked, show alternate route as green dotted line */}
              {isBlocked && ROUTE_COORDINATES[`${routeData.alternate}_alt`] && (
                <Polyline
                  coordinates={ROUTE_COORDINATES[`${routeData.alternate}_alt`]}
                  strokeColor='#1D9E75'
                  strokeWidth={2}
                  lineDashPattern={[6, 4]}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* Shop markers — coloured by reputation verdict from priceEngine */}
        {Object.entries(shops).map(([shopId, shop]: [string, any]) => {
          if (!shop.location) return null;
          const colour = SHOP_COLORS[shop.reputation] || '#888';

          return (
            <Marker
              key={shopId}
              coordinate={{ latitude: shop.location.lat, longitude: shop.location.lng }}
              title={shop.name}
              description={`${shop.reputation} — ${shop.warningCount || 0} warnings`}
            >
              {/* Custom circular marker coloured by reputation */}
              <View style={{
                width: 14, height: 14, borderRadius: 7,
                backgroundColor: colour,
                borderWidth: 2, borderColor: '#fff'
              }} />
            </Marker>
          );
        })}

        {/* Rumour hotspot circles — translucent red where false claims are spreading */}
        {rumourAreas.map((coord, i) => (
          <Circle
            key={i}
            center={coord}
            radius={600}
            fillColor="rgba(226, 75, 74, 0.12)"
            strokeColor="rgba(226, 75, 74, 0.3)"
            strokeWidth={1}
          />
        ))}

      </MapView>

      {/* Map legend — overlaid at bottom */}
      <View style={{
        position: 'absolute', bottom: 20, left: 16, right: 16,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 12, padding: 12,
        flexDirection: 'row', justifyContent: 'space-around'
      }}>
        {[
          { colour: '#1D9E75', label: 'Clear' },
          { colour: '#BA7517', label: 'Partial' },
          { colour: '#E24B4A', label: 'Blocked' },
        ].map(({ colour, label }) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 16, height: 4, backgroundColor: colour, borderRadius: 2 }} />
            <Text style={{ fontSize: 11, color: '#5A6370' }}>{label}</Text>
          </View>
        ))}
        <View style={{ width: 1, backgroundColor: '#E2E6EA' }} />
        {[
          { colour: '#1D9E75', label: 'Fair shop' },
          { colour: '#E24B4A', label: 'Gouging' },
        ].map(({ colour, label }) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colour }} />
            <Text style={{ fontSize: 11, color: '#5A6370' }}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Add this to lib/constants.ts — approximate center coordinates for each area
export const AREA_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  surjani:      { latitude: 24.9214, longitude: 67.0686 },
  orangi:       { latitude: 24.9101, longitude: 67.0219 },
  korangi:      { latitude: 24.8288, longitude: 67.1284 },
  lyari:        { latitude: 24.8671, longitude: 66.9898 },
  north_karachi:{ latitude: 24.9721, longitude: 67.0652 },
  gulshan:      { latitude: 24.9261, longitude: 67.1011 },
  saddar:       { latitude: 24.8553, longitude: 67.0127 },
  malir:        { latitude: 24.8924, longitude: 67.1887 },
};
```

---

## STEP 5 — FIX PRICE SUBMISSION (Khareedar + Dukandar Report Screen)

Currently the report screen writes directly to `prices/` which interferes with agent verdicts. Fix it to write to the submissions queue:

```typescript
// In app/(tabs)/khareedar/report.tsx AND app/(tabs)/dukandar/prices.tsx
// Change every price submission to write to price_submissions (NOT prices/)

import { ref, push } from 'firebase/database';
import { db } from '@/lib/firebase';

async function submitPrice(item: string, area: string, shopId: string, shopName: string, price: number, role: string) {
  // Write to price_submissions — the priceEngine listens to this queue
  await push(ref(db, 'price_submissions'), {
    itemId: item,
    area,
    shopId,
    shopName,
    price,
    submittedBy: role,        // 'khareedar' or 'dukandar'
    submitterUid: currentUid,
    shopPhone: shopPhone,     // needed for Twilio WhatsApp
    timestamp: Date.now()
  });
  // Show success message — verdict will appear on screen within ~15 seconds
  // as priceEngine processes and writes back to prices/{area}/{item}/reports
}
```

---

## STEP 6 — FIX RUMOUR SUBMISSION (Khareedar Report Screen)

```typescript
// In app/(tabs)/khareedar/report.tsx — claim submission tab
// POST to backend API which immediately runs rumourDetector

async function submitClaim(claimText: string, area: string) {
  const response = await fetch(`${BACKEND_URL}/api/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: claimText, area, submittedBy: currentUid })
  });
  // Verdict will appear in useTruthFeed hook within 60–90 seconds
}

// In backend/index.js — add this route
app.post('/api/claim', async (req, res) => {
  const { text, area, submittedBy } = req.body;
  if (!text || !area) return res.status(400).json({ error: 'text and area required' });

  // Get current signals for context
  const signals = await aggregateSignals();
  // Run rumour detector immediately (not on cron)
  const result = await detectRumours(text, signals);
  await publishTruth(result, { text, area, source: 'user_report' });

  res.json({ success: true, verdict: result.verdict });
});
```

---

## STEP 7 — FIX URDU TEXT RENDERING

Install the font:
```bash
npx expo install @expo-google-fonts/noto-nastaliq-urdu expo-font
```

Load it in `app/_layout.tsx`:
```typescript
import { useFonts, NotoNastaliqUrdu_400Regular } from '@expo-google-fonts/noto-nastaliq-urdu';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ NotoNastaliqUrdu_400Regular });
  if (!fontsLoaded) return null;
  // ...rest of layout
}
```

Create a shared Urdu text component:
```typescript
// components/shared/UrduText.tsx
import { Text, TextProps } from 'react-native';

interface UrduTextProps extends TextProps {
  children: string;
  size?: number;
}

export function UrduText({ children, size = 13, style, ...props }: UrduTextProps) {
  return (
    <Text
      style={[{
        fontFamily: 'NotoNastaliqUrdu_400Regular',
        fontSize: size,
        textAlign: 'right',
        writingDirection: 'rtl',
        lineHeight: size * 1.8,  // Nastaliq needs extra line height
        color: '#1A1F2E',
      }, style]}
      {...props}
    >
      {children}
    </Text>
  );
}
```

Replace EVERY Urdu string in every component with `<UrduText>`:
```typescript
// Before (wrong):
<Text style={{ fontFamily: 'System' }}>آج کے مناسب دام</Text>

// After (correct):
<UrduText size={14}>آج کے مناسب دام</UrduText>
```

---

## STEP 8 — FIX ADMIN OVERRIDE PANEL

The override panel currently writes to wrong paths. Fix each override:

```typescript
// In app/(tabs)/admin/override.tsx

import { ref, set, update } from 'firebase/database';
import { db } from '@/lib/firebase';

// Override 1: Road status
async function overrideRoadStatus(routeId: string, status: 'clear' | 'partial' | 'blocked') {
  // EXACT path that useSupplyStatus reads from
  await update(ref(db, `supply_status/${routeId}`), {
    status,
    overriddenByAdmin: true,
    overriddenAt: Date.now(),
    updatedAt: Date.now()
  });
}

// Override 2: Rumour verdict
async function overrideRumourVerdict(claimId: string, verdict: 'verified' | 'false' | 'unverified') {
  // EXACT path that useTruthFeed reads from
  await update(ref(db, `truth_feed/${claimId}`), {
    verdict,
    overriddenByAdmin: true,
    overriddenAt: Date.now()
  });
}

// Override 3: Fair price baseline
async function overrideFairPrice(area: string, itemId: string, newFairPrice: number) {
  // EXACT path that useMarketPrices reads fairPrice from
  await set(ref(db, `prices/${area}/${itemId}/fairPrice`), newFairPrice);
}

// Override 4: Broadcast message to users in area
async function broadcastMessage(areas: string[], roles: string[], title: string, body: string) {
  // Get expo push tokens for all users in these areas with these roles
  const usersSnap = await get(ref(db, 'users'));
  const users = usersSnap.val() || {};
  const tokens: string[] = [];

  Object.values(users).forEach((user: any) => {
    if (areas.includes(user.area) && roles.includes(user.role) && user.expoPushToken) {
      tokens.push(user.expoPushToken);
    }
  });

  // Call Expo push API
  if (tokens.length > 0) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map(to => ({ to, title, body, data: { type: 'broadcast' } })))
    });
  }
}
```

---

## STEP 9 — ADD SELF-HEALING TO SIGNAL AGGREGATOR

If HERE Maps, OpenWeatherMap, or Twitter is down, the aggregator must not crash. Add try-catch per source:

```javascript
// backend/agents/signalAggregator.js
async function aggregateSignals() {
  const signals = [];

  // Each source is independent — failure of one does not stop others
  const results = await Promise.allSettled([
    fetchTwitterSignals(),
    fetchWeatherSignals(),
    fetchHereMapsSignals(),
    fetchNDMASignals()
  ]);

  results.forEach((result, i) => {
    const sourceName = ['twitter', 'weather', 'here_maps', 'ndma'][i];
    if (result.status === 'fulfilled') {
      signals.push(...result.value);
    } else {
      console.warn(`[SignalAggregator] ${sourceName} failed:`, result.reason?.message);
      // Log the failure to Firebase so admin can see which API is down
      db.ref('agent_log').push({
        agent: 'signal_aggregator',
        action: 'api_failure',
        detail: `${sourceName} API failed: ${result.reason?.message?.substring(0, 100)}`,
        severity: 'warning',
        timestamp: Date.now()
      });
    }
  });

  // Always write to Firebase what signals we collected — admin can inspect this
  await db.ref('signals/latest').set({
    count: signals.length,
    sources: [...new Set(signals.map(s => s.source))],
    updatedAt: Date.now(),
    sample: signals.slice(0, 5) // first 5 for inspection
  });

  return signals;
}
```

---

## STEP 10 — ADD CRISIS TIMELINE TO ADMIN DASHBOARD

This is the highest-impact visual feature for judges. It shows the system acting autonomously in sequence.

```typescript
// Add to app/(tabs)/admin/index.tsx — below the agent log feed

import { useAgentLog } from '@/hooks/useAgentLog';

function CrisisTimeline() {
  const entries = useAgentLog();
  const scrollRef = useRef<ScrollView>(null);

  // Group entries by time proximity (within 10 minutes = same crisis event)
  const recentEntries = entries.slice(0, 10); // last 10 agent actions

  const AGENT_COLORS: Record<string, string> = {
    supply_break_detector: '#E24B4A',
    rumour_detector:       '#D85A30',
    supply_router:         '#1D9E75',
    price_engine:          '#BA7517',
    dispatch:              '#534AB7',
    truth_publisher:       '#1D9E75',
    orchestrator:          '#888780',
  };

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: '500', color: '#9AA3AE', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        Crisis timeline
      </Text>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 8 }}>
          {recentEntries.reverse().map((entry, i) => (
            <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Event node */}
              <View style={{ alignItems: 'center' }}>
                <View style={{
                  width: 10, height: 10, borderRadius: 5,
                  backgroundColor: AGENT_COLORS[entry.agent] || '#888'
                }} />
                <View style={{
                  width: 120, backgroundColor: '#fff',
                  borderWidth: 0.5, borderColor: '#E2E6EA',
                  borderRadius: 8, padding: 8, marginTop: 6
                }}>
                  <Text style={{ fontSize: 9, color: AGENT_COLORS[entry.agent], fontWeight: '500', marginBottom: 2 }}>
                    {entry.agent.replace(/_/g, ' ')}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#1A1F2E', lineHeight: 14 }} numberOfLines={2}>
                    {entry.detail}
                  </Text>
                  <Text style={{ fontSize: 9, color: '#9AA3AE', marginTop: 4 }}>
                    {new Date(entry.timestamp).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
              {/* Connector line between events */}
              {i < recentEntries.length - 1 && (
                <View style={{ width: 20, height: 1, backgroundColor: '#E2E6EA', marginBottom: 60 }} />
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
```

---

## VERIFICATION CHECKLIST — RUN THROUGH THIS BEFORE DEMO

After completing all 10 steps, verify end-to-end:

### Test 1 — Price agent loop
1. Open khareedar report screen
2. Submit: Item=atta_10kg, Area=surjani, Shop=Test Shop, Price=Rs 1,800
3. Wait 15 seconds
4. Open khareedar home screen — price card for atta_10kg should appear with verdict 'gouging' in red
5. Open admin dashboard — agent_log should show `price_engine → gouging_flagged` entry
6. Open Firebase console — check `prices/surjani/atta_10kg/reports` has the verdict written

### Test 2 — Rumour claim loop
1. Open khareedar report screen, switch to claim tab
2. Submit claim: "M9 bilkul band hai, koi truck nahi aa sakta" for area surjani
3. Wait 90 seconds
4. Open khareedar home → khabar tab — TruthCard should appear with verdict
5. Open admin dashboard — agent_log should show `rumour_detector → false_claim_flagged` or `verified`

### Test 3 — Supply break detection
1. Watch admin agent log while backend runs
2. If M9 is blocked in HERE Maps: supply_status/M9_surjani should have status 'blocked'
3. Crisis map should show M9 route as red Polyline
4. N55 alternate should appear as green dotted Polyline
5. Dukandar home should show SupplyAlertBanner with N55 route info

### Test 4 — Admin override
1. Open admin override panel
2. Mark M9_surjani as 'blocked'
3. Immediately check crisis map — route should turn red
4. Mark a truth_feed claim as 'false'
5. Check khareedar khabar screen — TruthCard should show 'Jhoot — False' badge

### Test 5 — Urdu text
1. Open any screen with Urdu text (truth cards, supply alert banner, fair price board)
2. Urdu text must render in Nastaliq script (cursive, flowing — not block letters)
3. Text must be right-aligned
4. No boxes or squares instead of Urdu characters (font not loaded)

---

## WHAT NOT TO DO

- Do NOT add new features before fixing Steps 1–4. The existing features must work before you add anything.
- Do NOT use mock data anywhere even temporarily. If real data is empty, show EmptyState, not fake data.
- Do NOT call Claude API from the React Native app — all Claude calls must be in `backend/agents/` only.
- Do NOT use Firestore — this app uses Firebase Realtime Database only. The paths use `.ref()` not `.collection()`.
- Do NOT skip writing to `agent_log` in any agent — the admin live log is what makes this look agentic to judges.
- Do NOT use any hardcoded lat/lng for route overlays except the coordinates in `ROUTE_COORDINATES` in constants — those are the defined monitoring corridors.

---

## FINAL GOAL STATE

When the demo runs:
1. A judge types "M9 mein pani bhar gaya" in the signal (or the Twitter API picks it up)
2. Within 90 seconds, the crisis map shows M9 route turning red and N55 turning green
3. Within 2 minutes, the dukandar app shows a supply alert banner in Urdu with N55 ETA
4. A khareedar submits a price: "Atta Rs 1,650 at Malik Store"
5. Within 15 seconds, the price card appears on all khareedar screens in red with gouging verdict
6. Malik Store's dukandar receives a WhatsApp message telling them the fair price is Rs 980
7. The admin agent log shows all 6 agent actions in sequence with exact timestamps
8. The admin override panel lets the judge manually mark a road, verify a claim, adjust a price — and all changes immediately reflect on every connected screen

That is the demo. Every step must work with real data.
