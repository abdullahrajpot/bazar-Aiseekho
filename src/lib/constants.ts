import { THEME } from './theme';

/** @deprecated Prefer THEME — kept for gradual migration */
export const COLORS = {
  primary: THEME.primary,
  primaryDark: '#155A40',
  accent: '#E8A020',
  danger: THEME.error,
  fair: THEME.fair,
  high: THEME.warning,
  gouging: THEME.gouging,
  verified: THEME.fair,
  false: THEME.gouging,
  unverified: THEME.warning,
  background: THEME.background,
  surface: THEME.surface,
  border: THEME.outline,
  textPrimary: THEME.onSurface,
  textSecondary: THEME.onSurfaceVariant,
  textTertiary: '#9AA3AE',
  white: '#FFFFFF',
  gray: '#6B7280',
  lightGray: THEME.outline,
  secondary: THEME.secondary,
  warning: THEME.warning,
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

export const AREAS = [
  // Karachi
  'Surjani Town',
  'Orangi Town',
  'North Nazimabad',
  'Gulshan-e-Iqbal',
  'Lyari',
  'Korangi',
  'Clifton',
  'Malir',
  // Punjab
  'Lahore — Johar Town',
  'Lahore — Gulberg',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Gujranwala',
  'Sialkot',
  'Bahawalpur',
  'Sargodha',
  // KPK / Balochistan / Sindh / Capital
  'Peshawar',
  'Mardan',
  'Abbottabad',
  'Quetta',
  'Hyderabad (Sindh)',
  'Sukkur',
  'Islamabad',
];

export const GOODS = [
  { id: 'atta_10kg', name: 'Atta (10kg)', nameUrdu: 'آٹا (10 کلو)', unit: '10kg' },
  { id: 'chini_1kg', name: 'Chini (1kg)', nameUrdu: 'چینی (1 کلو)', unit: '1kg' },
  { id: 'pyaz_1kg', name: 'Pyaz (1kg)', nameUrdu: 'پیاز (1 کلو)', unit: '1kg' },
  { id: 'doodh_1l', name: 'Doodh (1L)', nameUrdu: 'دودھ (1 لیٹر)', unit: '1L' },
  { id: 'lpg_cylinder', name: 'LPG Cylinder', nameUrdu: 'گیس سلنڈر', unit: 'cylinder' },
];

export const ITEM_NAMES: Record<string, { english: string; urdu: string; unit: string }> =
  Object.fromEntries(GOODS.map((g) => [g.id, { english: g.name, urdu: g.nameUrdu, unit: g.unit }]));

export const MONITORED_ROUTES = [
  {
    id: 'M9_surjani',
    name: 'M9 — Surjani',
    origin: { latitude: 24.8607, longitude: 67.0011 },
    destination: { latitude: 24.9214, longitude: 67.0686 },
    road: 'M9',
  },
  {
    id: 'N55_alt',
    name: 'N55 — Alternate',
    origin: { latitude: 24.8607, longitude: 67.0011 },
    destination: { latitude: 24.9214, longitude: 67.0686 },
    road: 'N55',
  },
  {
    id: 'SHP_mandi',
    name: 'Super Highway — Mandi',
    origin: { latitude: 24.8588, longitude: 67.0104 },
    destination: { latitude: 24.8632, longitude: 67.0578 },
    road: 'SHP',
  },
  {
    id: 'local_orangi',
    name: 'Orangi local',
    origin: { latitude: 24.9101, longitude: 67.0219 },
    destination: { latitude: 24.9286, longitude: 67.0401 },
    road: 'local',
  },
];

export { BACKEND_URL } from './backendUrl';

export const BASELINE_PRICES: Record<string, { normal: number; crisis_max?: number }> = {
  atta_10kg: { normal: 980, crisis_max: 1150 },
  chini_1kg: { normal: 120, crisis_max: 145 },
  pyaz_1kg: { normal: 85, crisis_max: 110 },
  doodh_1l: { normal: 180, crisis_max: 210 },
  lpg_cylinder: { normal: 2800, crisis_max: 3200 },
};

export const ROUTE_COORDINATES: Record<
  string,
  Array<{ latitude: number; longitude: number }>
> = {
  M9_surjani: [
    { latitude: 24.8607, longitude: 67.0011 },
    { latitude: 24.872, longitude: 67.018 },
    { latitude: 24.889, longitude: 67.035 },
    { latitude: 24.905, longitude: 67.052 },
    { latitude: 24.9214, longitude: 67.0686 },
  ],
  N55_alt: [
    { latitude: 24.8607, longitude: 67.0011 },
    { latitude: 24.85, longitude: 66.98 },
    { latitude: 24.865, longitude: 66.96 },
    { latitude: 24.89, longitude: 66.97 },
    { latitude: 24.9214, longitude: 67.0686 },
  ],
  SHP_mandi: [
    { latitude: 24.8588, longitude: 67.0104 },
    { latitude: 24.86, longitude: 67.03 },
    { latitude: 24.862, longitude: 67.05 },
    { latitude: 24.8632, longitude: 67.0578 },
  ],
  local_orangi: [
    { latitude: 24.9101, longitude: 67.0219 },
    { latitude: 24.92, longitude: 67.03 },
    { latitude: 24.9286, longitude: 67.0401 },
  ],
};

export const AREA_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  surjani: { latitude: 24.9214, longitude: 67.0686 },
  orangi: { latitude: 24.9101, longitude: 67.0219 },
  korangi: { latitude: 24.8288, longitude: 67.1284 },
  lyari: { latitude: 24.8671, longitude: 66.9898 },
  north_karachi: { latitude: 24.9721, longitude: 67.0652 },
  north_nazimabad: { latitude: 24.938, longitude: 67.038 },
  gulshan: { latitude: 24.9261, longitude: 67.1011 },
  gulshan_e_iqbal: { latitude: 24.9261, longitude: 67.1011 },
  saddar: { latitude: 24.8553, longitude: 67.0127 },
  malir: { latitude: 24.8924, longitude: 67.1887 },
  clifton: { latitude: 24.8138, longitude: 67.03 },
  lahore_johar_town: { latitude: 31.4697, longitude: 74.2728 },
  lahore_gulberg: { latitude: 31.5204, longitude: 74.3587 },
  rawalpindi: { latitude: 33.5651, longitude: 73.0169 },
  faisalabad: { latitude: 31.4504, longitude: 73.135 },
  multan: { latitude: 30.1575, longitude: 71.5249 },
  gujranwala: { latitude: 32.1877, longitude: 74.1945 },
  sialkot: { latitude: 32.4945, longitude: 74.5229 },
  bahawalpur: { latitude: 29.3956, longitude: 71.6836 },
  sargodha: { latitude: 32.0836, longitude: 72.6711 },
  peshawar: { latitude: 34.0151, longitude: 71.5789 },
  mardan: { latitude: 34.1982, longitude: 72.045 },
  abbottabad: { latitude: 34.1688, longitude: 73.2215 },
  quetta: { latitude: 30.1798, longitude: 66.975 },
  hyderabad_sindh: { latitude: 25.396, longitude: 68.3578 },
  sukkur: { latitude: 27.7139, longitude: 68.8369 },
  islamabad: { latitude: 33.6844, longitude: 73.0479 },
};

export const ROUTE_COLORS: Record<string, string> = {
  clear: COLORS.fair,
  partial: COLORS.warning,
  blocked: COLORS.gouging,
  rerouted: COLORS.warning,
};

export const SHOP_COLORS: Record<string, string> = {
  fair: COLORS.fair,
  at_risk: COLORS.warning,
  flagged: COLORS.gouging,
};
