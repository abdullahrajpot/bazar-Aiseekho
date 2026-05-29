import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { MAP_DARK_STYLE } from '../../lib/mapDarkStyle';
import { normalizeAreaKey, getAreaSpecificRoutes, resolveRouteStatus } from '../../lib/area';
import { severityColors } from '../../lib/crisisSeverity';
import { CrisisEvent } from '../../hooks/useCrisisEvents';
import { MapRouteEntry } from '../../hooks/useCrisisSituation';
import { AffectedZone } from '../../hooks/useAffectedZones';
import { MapIncident } from '../../hooks/useMapIncidents';
import {
  isValidPkCoord,
  resolveCrisisCoord,
  coordsForAreaLabel,
} from '../../lib/resolveCrisisCoord';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Props {
  selectedArea: string;
  crises: CrisisEvent[];
  selectedCrisisId: string | null;
  onSelectCrisis: (id: string) => void;
  mapRoutes?: MapRouteEntry[];
  routes?: Record<string, any>;
  affectedZones?: AffectedZone[];
  incidents?: MapIncident[];
}

export const CrisisIntelMap: React.FC<Props> = ({
  selectedArea,
  crises,
  selectedCrisisId,
  onSelectCrisis,
  mapRoutes = [],
  routes = {},
  affectedZones = [],
  incidents = [],
}) => {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const areaKey = normalizeAreaKey(selectedArea);

  // Build the target region for the selected area — tight zoom on Pakistan city
  const regionForArea = useMemo((): Region => {
    const c = coordsForAreaLabel(selectedArea);
    return {
      latitude: c.lat,
      longitude: c.lng,
      latitudeDelta: 0.18,
      longitudeDelta: 0.18,
    };
  }, [selectedArea]);

  // Animate to the new area whenever it changes or map becomes ready
  const flyToArea = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion(regionForArea, 600);
  }, [regionForArea]);

  useEffect(() => {
    if (!mapReady) return;
    flyToArea();
    // Second attempt for Android — map sometimes ignores the first call
    const t = setTimeout(flyToArea, Platform.OS === 'android' ? 800 : 300);
    return () => clearTimeout(t);
  }, [mapReady, flyToArea]);

  // Use Firebase routes when available, fall back to static area routes
  const areaRoutes = useMemo(() => {
    if (mapRoutes.length) return mapRoutes;
    return getAreaSpecificRoutes(selectedArea);
  }, [mapRoutes, selectedArea]);

  // Resolve coordinates for each crisis event
  const markers = useMemo(
    () =>
      crises.map((crisis, index) => ({
        crisis,
        coord: resolveCrisisCoord(crisis, selectedArea, index),
      })),
    [crises, selectedArea]
  );

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_DARK_STYLE}
        initialRegion={regionForArea}
        onMapReady={() => {
          setMapReady(true);
          // Immediate fly — works on iOS; Android gets the delayed one above
          mapRef.current?.animateToRegion(regionForArea, 0);
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        mapPadding={{ top: 120, right: 0, bottom: 220, left: 0 }}
        minZoomLevel={5}
        maxZoomLevel={18}
        rotateEnabled={false}
        pitchEnabled={false}
        loadingEnabled
      >
        {/* ── Route polylines (blocked = red, recommended = blue, clear = green) ── */}
        {areaRoutes.map((route) => {
          const coords = (route.coordinates || []).filter((c) =>
            isValidPkCoord(c.latitude, c.longitude)
          );
          if (coords.length < 2) return null;

          const status = (route as any).status || resolveRouteStatus(route, routes, areaKey);
          const blocked = status === 'blocked' || status === 'disrupted';
          const recommended = (route as any).isRecommended || (!blocked && status === 'clear');
          const isAlt = (route as any).isAlternate || status === 'rerouted';

          const color = blocked ? '#E24B4A' : recommended ? '#3B82F6' : isAlt ? '#6366F1' : '#1D9E75';
          const width = blocked ? 5 : recommended ? 7 : 4;

          const start = coords[0];
          const end = coords[coords.length - 1];

          return (
            <React.Fragment key={route.id}>
              <Polyline
                coordinates={coords}
                strokeColor={color}
                strokeWidth={width}
                lineDashPattern={isAlt && !recommended ? [10, 6] : undefined}
                zIndex={blocked ? 3 : recommended ? 4 : 2}
                geodesic
              />
              {/* Endpoint dots */}
              <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={[styles.endpoint, { backgroundColor: color }]} />
              </Marker>
              <Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={[styles.endpoint, { backgroundColor: color }]} />
              </Marker>
              {/* Blocked zone circle */}
              {blocked ? (
                <Circle
                  center={coords[Math.floor(coords.length / 2)]}
                  radius={900}
                  fillColor="rgba(226, 75, 74, 0.18)"
                  strokeColor="rgba(226, 75, 74, 0.55)"
                  strokeWidth={2}
                />
              ) : null}
            </React.Fragment>
          );
        })}

        {/* ── Affected zone circles from CIRO agent ── */}
        {affectedZones.map((zone) => {
          const lat = zone.center?.lat ?? (zone.center as any)?.latitude;
          const lng = zone.center?.lng ?? (zone.center as any)?.longitude;
          const areaFb = coordsForAreaLabel(selectedArea);
          const centerLat = lat != null && isValidPkCoord(lat, lng ?? 0) ? lat : areaFb.lat;
          const centerLng = lng != null && isValidPkCoord(lat ?? 0, lng) ? lng : areaFb.lng;
          const sev = severityColors(zone.severity);
          return (
            <React.Fragment key={zone.id}>
              <Circle
                center={{ latitude: centerLat, longitude: centerLng }}
                radius={zone.radiusMeters || 2000}
                fillColor={sev.fill}
                strokeColor={sev.stroke}
                strokeWidth={2}
              />
              <Circle
                center={{ latitude: centerLat, longitude: centerLng }}
                radius={(zone.radiusMeters || 2000) * 1.35}
                fillColor="rgba(245, 158, 11, 0.07)"
                strokeColor="rgba(245, 158, 11, 0.25)"
                strokeWidth={1}
              />
            </React.Fragment>
          );
        })}

        {/* ── Photo-reported incidents (red pins from user reports + CIRO vision) ── */}
        {incidents.map((inc) => {
          const lat = inc.locationCoords?.lat;
          const lng = inc.locationCoords?.lng;
          if (!lat || !lng || !isValidPkCoord(lat, lng)) return null;
          return (
            <React.Fragment key={`inc-${inc.crisisId}`}>
              <Circle
                center={{ latitude: lat, longitude: lng }}
                radius={600}
                fillColor="rgba(239, 68, 68, 0.2)"
                strokeColor="#EF4444"
                strokeWidth={2}
              />
              <Marker
                coordinate={{ latitude: lat, longitude: lng }}
                title={inc.type === 'accident' ? '🚨 Accident' : `⚠️ ${inc.type}`}
                description={inc.location}
                tracksViewChanges={false}
              >
                <View style={styles.incidentPin}>
                  <Icon name="camera-burst" size={14} color="#fff" />
                </View>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* ── Crisis event markers (from CIRO agent pipeline) ── */}
        {markers.map(({ crisis, coord }) => {
          const sev = severityColors(crisis.severity);
          const selected = crisis.id === selectedCrisisId;
          const radii = [600, 1100, 1600];
          return (
            <React.Fragment key={crisis.id}>
              {radii.map((r, i) => (
                <Circle
                  key={`${crisis.id}-r-${i}`}
                  center={{ latitude: coord.lat, longitude: coord.lng }}
                  radius={r}
                  fillColor={`rgba(251, 191, 36, ${0.13 - i * 0.04})`}
                  strokeColor={selected ? sev.stroke : 'rgba(251, 191, 36, 0.35)'}
                  strokeWidth={selected ? 2 : 1}
                />
              ))}
              <Marker
                coordinate={{ latitude: coord.lat, longitude: coord.lng }}
                onPress={() => onSelectCrisis(crisis.id)}
                tracksViewChanges={false}
                zIndex={selected ? 10 : 5}
              >
                <View style={[styles.pin, selected && styles.pinSelected, { borderColor: sev.pin }]}>
                  <Icon name="alert" size={18} color="#1F2937" />
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0e1626' },
  map: { ...StyleSheet.absoluteFillObject },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  pinSelected: { transform: [{ scale: 1.18 }] },
  endpoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  incidentPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
