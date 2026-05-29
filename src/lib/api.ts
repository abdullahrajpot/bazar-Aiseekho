import { BACKEND_URL } from './backendUrl';
import { DEV_BACKEND_HOST } from './devConfig';

export async function apiPost<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const url = `${BACKEND_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      `Cannot reach backend at ${BACKEND_URL}. ` +
        `Start: cd backend && node index.js. ` +
        `On a real phone, set DEV_BACKEND_HOST in src/lib/devConfig.ts to your PC IP (not ${DEV_BACKEND_HOST}).`
    );
  }

  const text = await res.text();
  let data: T;
  try {
    data = text ? JSON.parse(text) : ({} as T);
  } catch {
    throw new Error(res.ok ? 'Invalid server response' : text.slice(0, 120) || `HTTP ${res.status}`);
  }

  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }

  return data;
}
