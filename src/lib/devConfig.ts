/**
 * Backend host for the React Native app (NOT read from .env on device).
 *
 * - Android emulator: keep `10.0.2.2` (maps to your PC localhost)
 * - Physical phone on same Wi‑Fi: set your PC LAN IP, e.g. `192.168.1.42`
 * - iOS simulator: use `localhost`
 */
/**
 * ANDROID EMULATOR → keep 10.0.2.2
 * REAL PHONE (same Wi‑Fi as PC) → run `ipconfig` and paste IPv4 here, e.g. 192.168.100.5
 */
export const DEV_BACKEND_HOST = '10.0.2.2';

export const DEV_BACKEND_PORT = 3000;
