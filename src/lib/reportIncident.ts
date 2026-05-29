import { ref, push, set } from 'firebase/database';
import { db } from './firebase';
import { normalizeAreaKey } from './area';
import { coordsForAreaLabel } from './resolveCrisisCoord';
import { apiPost } from './api';
import { BACKEND_URL } from './backendUrl';

export interface IncidentSubmitResult {
  crisisDetected: boolean;
  crisisId?: string;
  type?: string;
  location?: string;
  confidence?: number;
  message?: string;
  viaFirebase?: boolean;
}

/** Works without backend — writes Firebase so map + alerts update immediately */
export async function submitIncidentReport(params: {
  text: string;
  area: string;
  uid?: string | null;
  imageBase64?: string | null;
}): Promise<IncidentSubmitResult> {
  const { text, area, uid, imageBase64 } = params;
  const areaKey = normalizeAreaKey(area);
  const locationCoords = coordsForAreaLabel(area);
  const now = Date.now();

  const reportRef = push(ref(db, 'user_crisis_reports'));
  await set(reportRef, {
    text,
    area,
    areaKey,
    uid: uid || 'anonymous',
    hasImage: Boolean(imageBase64),
    timestamp: now,
    status: 'pending_agent',
  });

  const crisisRef = push(ref(db, 'crisis_events'));
  const crisisId = crisisRef.key!;
  const type = /\b(flood|سیلاب|pani)\b/i.test(text)
    ? 'flood'
    : /\b(earthquake|زلزلہ)\b/i.test(text)
      ? 'earthquake'
      : 'accident';

  await set(crisisRef, {
    type,
    location: area,
    locationCoords,
    severity: 'high',
    confidence: imageBase64 ? 0.85 : 0.72,
    confidenceReason: 'Citizen report — CIRO agents will verify from news & feeds',
    detectedAt: now,
    status: 'detected',
    areaKey,
    inputText: text,
    source: 'citizen_report',
  });

  await set(ref(db, `map_incidents/${areaKey}/${crisisId}`), {
    crisisId,
    type,
    location: area,
    locationCoords,
    severity: 'high',
    status: 'active',
    hasImage: Boolean(imageBase64),
    updatedAt: now,
  });

  await set(ref(db, `crisis_affected_zones/${areaKey}`), {
    zones: [
      {
        id: crisisId,
        center: locationCoords,
        radiusMeters: 2500,
        severity: 'high',
        type,
        label: area,
      },
    ],
    activeCrisisId: crisisId,
    updatedAt: now,
  });

  await set(push(ref(db, 'action_log')), {
    agent: 'citizen_report',
    crisisId,
    action: 'incident_submitted',
    detail: `${type} reported in ${area}: ${text.slice(0, 120)}`,
    severity: 'warning',
    timestamp: now,
  });

  // Try backend for Groq vision + 1122 dispatch (optional)
  try {
    const data = await apiPost<IncidentSubmitResult>('/api/incident', {
      text,
      area,
      uid,
      imageBase64,
      imageMime: 'image/jpeg',
      lat: locationCoords.lat,
      lng: locationCoords.lng,
    });
    return { ...data, viaFirebase: false };
  } catch {
    return {
      crisisDetected: true,
      crisisId,
      type,
      location: area,
      confidence: 0.72,
      message:
        `Report saved. Map updated for ${area}. ` +
        `Start backend on your PC (${BACKEND_URL}) for photo AI + Rescue 1122 dispatch.`,
      viaFirebase: true,
    };
  }
}

export async function submitRumourClaim(text: string, area: string): Promise<{ verdict?: string }> {
  const areaKey = normalizeAreaKey(area);
  const now = Date.now();

  await set(push(ref(db, 'user_crisis_reports')), {
    text,
    area,
    areaKey,
    type: 'rumour',
    timestamp: now,
  });

  try {
    return await apiPost('/api/claim', { text, area: areaKey });
  } catch {
    await set(push(ref(db, 'truth_feed')), {
      text,
      area: areaKey,
      verdict: 'unverified',
      reasonUrdu: 'رپورٹ موصول — ایجنٹ تصدیق کر رہے ہیں',
      confidence: 0.5,
      timestamp: now,
      source: 'citizen',
    });
    return { verdict: 'unverified (saved — agents will verify when backend is online)' };
  }
}
