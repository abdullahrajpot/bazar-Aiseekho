import { Platform } from 'react-native';
import { DEV_BACKEND_HOST, DEV_BACKEND_PORT } from './devConfig';

/** URL the phone can reach — .env BACKEND_URL is NOT available in RN unless you add babel env plugin. */
export function getBackendUrl(): string {
  const port = DEV_BACKEND_PORT;

  if (Platform.OS === 'android') {
    return `http://${DEV_BACKEND_HOST}:${port}`;
  }

  if (Platform.OS === 'ios') {
    return `http://localhost:${port}`;
  }

  return `http://localhost:${port}`;
}

export const BACKEND_URL = getBackendUrl();
