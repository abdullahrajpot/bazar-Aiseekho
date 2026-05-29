import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, LayoutChangeEvent } from 'react-native';
import MapView, { LatLng, Marker, Polyline, Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { AREA_COORDINATES } from '../../lib/constants';
import { THEME } from '../../lib/theme';
import { TruthClaim } from '../../hooks/useTruthFeed';
import {
  normalizeAreaKey,
  getAreaSpecificRoutes,
  resolveRouteStatus,
  resolveRouteMeta,
  formatAreaLabel,
} from '../../lib/area';
import { MapRouteEntry } from '../../hooks/useCrisisSituation';
import { MapIncident } from '../../hooks/useMapIncidents';
import { AffectedZone } from '../../hooks/useAffectedZones';

interface CrisisMapViewProps {
  routes: Record<string, any>;
  shopsRecord: Record<string, any>;
  claims?: TruthClaim[];
  selectedArea?: string | null;
  height?: number;
  fullScreen?: boolean;
  ciroMapRoutes?: MapRouteEntry[];
  incidents?: MapIncident[];
  affectedZones?: AffectedZone[];
  selectedRouteId?: string | null;
  onRoutesReady?: (ids: string[]) => void;
}

function midpoint(coords: LatLng[]): LatLng | null {
  if (!coords.length) return null;
  return coords[Math.floor(coords.length / 2)];
}

/** Pakistan-ish bounds — ignore bad Firebase coords that zoom map to ocean */
function isValidPkCoord(lat: number, lng: number): boolean {
  return lat > 23 && lat < 38 && lng > 60 && lng < 78 && !Number.isNaN(lat) && !Number.isNaN(lng);
}

function sanitizeCoords(coords: LatLng[]): LatLng[] {
  return coords.filter((c) => isValidPkCoord(c.latitude, c.longitude));
}

export const CrisisMapView: React.FC<CrisisMapViewProps> = ({
  routes,
  shopsRecord,
  claims = [],
  selectedArea,
  height,
  fullScreen = false,
  ciroMapRoutes = [],
  incidents = [],
  affectedZones = [],
  selectedRouteId,
  onRoutesReady,
}) => {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [layoutDone, setLayoutDone] = useState(false);

  const areaKey = normalizeAreaKey(selectedArea || 'Surjani Town');
  const areaLabel = selectedArea || formatAreaLabel(areaKey);

  const activeAreaRoutes = useMemo(() => {
    if (ciroMapRoutes?.length) {
      return ciroMapRoutes.map((r) => ({
        id: r.id,
        name: r.name,
        road: r.road,
        coordinates: r.coordinates,
        ciroStatus: r.status,
        isRecommended: r.isRecommended,
        isAlternate: r.isAlternate,
        extraMinutes: r.extraMinutes,
      }));
    }
    return getAreaSpecificRoutes(selectedArea);
  }, [selectedArea, ciroMapRoutes]);

  useEffect(() => {
    onRoutesReady?.(activeAreaRoutes.map((r) => r.id));
  }, [activeAreaRoutes, onRoutesReady]);

  const regionForArea = useMemo((): Region => {
    const c = AREA_COORDINATES[areaKey];
    if (c) {
      return {
        latitude: c.latitude,
        longitude: c.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    return { latitude: 24.89, longitude: 67.04, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  }, [areaKey]);

  const [region, setRegion] = useState<Region>(regionForArea);

  useEffect(() => {
    setRegion(regionForArea);
  }, [regionForArea]);

  const activeRouteCoords = useMemo(() => {
    const list: LatLng[] = [];
    for (const r of activeAreaRoutes) {
      if (r.coordinates?.length) list.push(...sanitizeCoords(r.coordinates));
    }
    return list;
  }, [activeAreaRoutes]);

  const fitMap = useCallback(() => {
    if (!mapRef.current) return;

    const focusCoords =
      selectedRouteId != null
        ? sanitizeCoords(
            activeAreaRoutes.find((r) => r.id === selectedRouteId)?.coordinates || []
          )
        : activeRouteCoords;

    if (focusCoords.length >= 2) {
      mapRef.current.fitToCoordinates(focusCoords, {
        edgePadding: { top: 80, right: 40, bottom: 200, left: 40 },
        animated: true,
      });
      return;
    }

    mapRef.current.animateToRegion(regionForArea, 400);
  }, [activeRouteCoords, regionForArea, selectedRouteId, activeAreaRoutes]);

  useEffect(() => {
    if (!mapReady || !layoutDone) return;
    const t1 = setTimeout(fitMap, 150);
    const t2 = setTimeout(fitMap, Platform.OS === 'android' ? 900 : 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mapReady, layoutDone, fitMap, areaKey, selectedRouteId]);

  const areaCenter = AREA_COORDINATES[areaKey];

  const wrapStyle = fullScreen
    ? [styles.wrap, styles.wrapFull]
    : [styles.wrap, height != null ? { height } : { minHeight: 360 }];

  return (
    <View style={wrapStyle} collapsable={false} onLayout={() => setLayoutDone(true)}>
      <MapView
        key={`map-${areaKey}`}
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChangeComplete={setRegion}
        onMapReady={() => {
          setMapReady(true);
          mapRef.current?.animateToRegion(regionForArea, 0);
        }}
        showsUserLocation
        showsMyLocationButton={Platform.OS === 'android'}
        mapPadding={{ top: 48, right: 12, bottom: 160, left: 12 }}
        rotateEnabled={false}
        pitchEnabled={false}
        loadingEnabled
        liteMode={false}
      >
        {areaCenter && isValidPkCoord(areaCenter.latitude, areaCenter.longitude) ? (
          <Marker
            coordinate={areaCenter}
            title="Your area"
            description={areaLabel}
            pinColor="green"
          />
        ) : null}

        {activeAreaRoutes.map((route) => {
          const coords = sanitizeCoords(route.coordinates || []);
          if (coords.length < 2) return null;

          const ciroStatus = (route as any).ciroStatus;
          const status = ciroStatus || resolveRouteStatus(route, routes, areaKey);
          const meta = resolveRouteMeta(route, routes, areaKey);
          const isBlocked = status === 'blocked' || status === 'disrupted';
          const isAlt =
            (route as any).isAlternate ||
            status === 'rerouted' ||
            route.road === 'N55' ||
            route.id.includes('alt');
          const isRecommended =
            (route as any).isRecommended ||
            selectedRouteId === route.id ||
            (!isBlocked && !isAlt && status === 'clear');

          const strokeColor = isBlocked
            ? THEME.gouging
            : isRecommended
              ? '#3B82F6'
              : isAlt
                ? '#6366F1'
                : THEME.fair;
          const strokeWidth = isRecommended ? 7 : isBlocked ? 6 : 4;
          const dimmed = selectedRouteId && selectedRouteId !== route.id;

          const start = coords[0];
          const end = coords[coords.length - 1];

          return (
            <React.Fragment key={route.id}>
              <Polyline
                coordinates={coords}
                strokeColor={dimmed ? `${strokeColor}66` : strokeColor}
                strokeWidth={strokeWidth}
                lineDashPattern={isAlt && !isRecommended ? [10, 6] : undefined}
                zIndex={isBlocked ? 3 : isRecommended ? 4 : 2}
                tappable
                geodesic
              />
              <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={[styles.endpoint, { backgroundColor: THEME.fair }]} />
              </Marker>
              <Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View
                  style={[
                    styles.endpoint,
                    { backgroundColor: isBlocked ? THEME.gouging : '#3B82F6' },
                  ]}
                />
              </Marker>
              {isBlocked && midpoint(coords) ? (
                <Circle
                  center={midpoint(coords)!}
                  radius={800}
                  fillColor="rgba(226, 75, 74, 0.2)"
                  strokeColor="rgba(226, 75, 74, 0.6)"
                  strokeWidth={2}
                />
              ) : null}
              {meta.publicAlertUrdu ? null : null}
            </React.Fragment>
          );
        })}

        {affectedZones.map((zone) => {
          const c = zone.center;
          if (!c?.lat || !isValidPkCoord(c.lat, c.lng)) return null;
          return (
            <Circle
              key={`zone-${zone.id}`}
              center={{ latitude: c.lat, longitude: c.lng }}
              radius={zone.radiusMeters || 1200}
              fillColor="rgba(186, 26, 26, 0.12)"
              strokeColor="rgba(186, 26, 26, 0.5)"
              strokeWidth={2}
            />
          );
        })}

        {incidents.map((inc) => {
          const c = inc.locationCoords;
          if (!c?.lat || !isValidPkCoord(c.lat, c.lng)) return null;
          return (
            <React.Fragment key={inc.crisisId}>
              <Marker
                coordinate={{ latitude: c.lat, longitude: c.lng }}
                title={inc.type === 'accident' ? 'Accident' : `Crisis: ${inc.type}`}
                description={inc.location}
                pinColor="red"
              />
            </React.Fragment>
          );
        })}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#DDE4EA' },
  wrapFull: { flex: 1, borderRadius: 0 },
  map: { ...StyleSheet.absoluteFillObject },
  endpoint: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
