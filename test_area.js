const AREAS = [
  'Surjani Town', 'Orangi Town', 'North Nazimabad', 'Gulshan-e-Iqbal',
  'Lyari', 'Korangi', 'Clifton', 'Malir',
  'Lahore — Johar Town', 'Lahore — Gulberg', 'Rawalpindi', 'Faisalabad',
  'Multan', 'Gujranwala', 'Sialkot', 'Bahawalpur', 'Sargodha',
  'Peshawar', 'Mardan', 'Abbottabad', 'Quetta',
  'Hyderabad (Sindh)', 'Sukkur', 'Islamabad',
];

const AREA_COORDINATES = {
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

function normalizeAreaKey(area) {
  if (!area) return 'surjani';
  const key = area
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u2013\u2014\u2212\-\u2013\u2014]/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/_town$/, '')
    .replace(/^surjani_town$/, 'surjani');
  return key || 'surjani';
}

console.log('=== KEY RESOLUTION TEST ===');
AREAS.forEach(a => {
  const key = normalizeAreaKey(a);
  const coord = AREA_COORDINATES[key];
  console.log(`"${a}" => "${key}" => ${coord ? 'OK' : 'MISSING'}`);
});
