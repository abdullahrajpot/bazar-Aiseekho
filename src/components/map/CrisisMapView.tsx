import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, LayoutChangeEvent } from 'react-native';
import MapView, { LatLng, Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { COLORS, AREA_COORDINATES, ROUTE_COLORS, SHOP_COLORS } from '../../lib/constants';
import { TruthClaim } from '../../hooks/useTruthFeed';
import {
  normalizeAreaKey,
  getAreaSpecificRoutes,
  resolveRouteStatus,
  resolveRouteMeta,
  formatAreaLabel,
} from '../../lib/area';

import { MapRouteEntry } from '../../hooks/useCrisisSituation';

interface CrisisMapViewProps {
  routes: Record<string, any>;
  shopsRecord: Record<string, any>;
  claims?: TruthClaim[];
  selectedArea?: string | null;
  height?: number;
  ciroMapRoutes?: MapRouteEntry[];
}

function midpoint(coords: LatLng[]): LatLng | null {
  if (!coords.length) return null;
  const i = Math.floor(coords.length / 2);
  return coords[i];
}

export const CrisisMapView: React.FC<CrisisMapViewProps> = ({
  routes,
  shopsRecord,
  claims = [],
  selectedArea,
  height = 360,
  ciroMapRoutes = [],
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
      }));
    }
    return getAreaSpecificRoutes(selectedArea);
  }, [selectedArea, ciroMapRoutes]);

  const activeRouteCoords = useMemo(() => {
    const list: LatLng[] = [];
    for (const r of activeAreaRoutes) {
      if (r.coordinates?.length) list.push(...r.coordinates);
    }
    return list;
  }, [activeAreaRoutes]);

  const initialRegion = useMemo(() => {
    const c = AREA_COORDINATES[areaKey];
    if (!c) {
      return { latitude: 24.89, longitude: 67.04, latitudeDelta: 0.12, longitudeDelta: 0.12 };
    }
    return {
      latitude: c.latitude,
      longitude: c.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [areaKey]);

  const filteredShops = useMemo(() => {
    const out: Record<string, any> = {};
    Object.entries(shopsRecord).forEach(([id, shop]) => {
      if (!shop?.location?.lat) return;
      if (!shop.area || shop.area === areaKey) out[id] = shop;
    });
    return out;
  }, [shopsRecord, areaKey]);

  const fitMap = useCallback(() => {
    if (!mapRef.current) return;
    if (activeRouteCoords.length >= 2) {
      mapRef.current.fitToCoordinates(activeRouteCoords, {
        edgePadding: { top: 56, right: 32, bottom: 88, left: 32 },
        animated: false,
      });
    } else if (AREA_COORDINATES[areaKey]) {
      const c = AREA_COORDINATES[areaKey];
      mapRef.current.animateToRegion(
        {
          latitude: c.latitude,
          longitude: c.longitude,
          latitudeDelta: 0.07,
          longitudeDelta: 0.07,
        },
        0
      );
    }
  }, [activeRouteCoords, areaKey]);

  useEffect(() => {
    if (!mapReady || !layoutDone) return;
    const t1 = setTimeout(fitMap, 100);
    const t2 = setTimeout(fitMap, Platform.OS === 'android' ? 800 : 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mapReady, layoutDone, fitMap, areaKey, routes]);

  const rumourAreas = claims
    .filter((c) => c.verdict === 'false' && c.area === areaKey)
    .map((c) => AREA_COORDINATES[c.area!])
    .filter(Boolean);

  const onLayout = (_e: LayoutChangeEvent) => {
    setLayoutDone(true);
  };

  return (
    <View style={[styles.wrap, { height }]} collapsable={false} onLayout={onLayout}>
      <MapView
        key={`map-${areaKey}`}
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        onMapReady={() => setMapReady(true)}
        mapPadding={{ top: 40, right: 0, bottom: 72, left: 0 }}
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled
        zoomEnabled
        loadingEnabled
        liteMode={false}
      >
        {activeAreaRoutes.map((route) => {
          const coords = route.coordinates;
          if (!coords?.length) return null;

          const ciroStatus = (route as any).ciroStatus;
          const status = ciroStatus || resolveRouteStatus(route, routes, areaKey);
          const meta = resolveRouteMeta(route, routes, areaKey);
          const isBlocked = status === 'blocked' || status === 'disrupted';
          const isPartial =
            status === 'partial' || status === 'rerouted' || (route as any).isRecommended;
          const strokeColor =
            isBlocked ? COLORS.gouging : isPartial ? COLORS.warning : COLORS.fair;
          const strokeWidth = isBlocked ? 6 : isPartial ? 4 : 3;

          const altRoute = activeAreaRoutes.find(
            (r) => r.id !== route.id && (r.road === 'alt' || r.road === 'N55' || r.id.endsWith('_alt'))
          );

          const center = midpoint(coords);

          return (
            <React.Fragment key={route.id}>
              <Polyline
                coordinates={coords}
                strokeColor={strokeColor}
                strokeWidth={strokeWidth}
                lineDashPattern={isPartial ? [12, 6] : undefined}
                zIndex={isBlocked ? 3 : 1}
              />
              {isBlocked && altRoute ? (
                <Polyline
                  coordinates={altRoute.coordinates}
                  strokeColor="#3B82F6"
                  strokeWidth={3}
                  lineDashPattern={[8, 5]}
                  zIndex={2}
                />
              ) : null}
              {isBlocked && center ? (
                <Circle
                  center={center}
                  radius={900}
                  fillColor="rgba(226, 75, 74, 0.22)"
                  strokeColor="rgba(226, 75, 74, 0.65)"
                  strokeWidth={2}
                  zIndex={4}
                />
              ) : null}
              {center ? (
                <Marker coordinate={center} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                  <View style={[styles.routeDot, { backgroundColor: strokeColor }]} />
                </Marker>
              ) : null}
              {meta.publicAlertUrdu ? null : null}
            </React.Fragment>
          );
        })}

        {Object.entries(filteredShops).map(([shopId, shop]: [string, any]) => {
          const colour = SHOP_COLORS[shop.reputation] || COLORS.gray;
          return (
            <Marker
              key={shopId}
              coordinate={{ latitude: shop.location.lat, longitude: shop.location.lng }}
              title={shop.name || shopId}
              description={`${shop.reputation || 'unknown'}`}
              tracksViewChanges={false}
            >
              <View style={[styles.shopDot, { backgroundColor: colour }]} />
            </Marker>
          );
        })}

        {rumourAreas.map((coord, i) => (
          <Circle
            key={`rumour-${i}`}
            center={coord}
            radius={700}
            fillColor="rgba(226, 75, 74, 0.1)"
            strokeColor="rgba(226, 75, 74, 0.35)"
            strokeWidth={1}
          />
        ))}
      </MapView>

      <Text style={styles.mapCaption} pointerEvents="none">
        {areaLabel} — live agent routes (green clear · blue alternate · red disruption)
      </Text>

      <View style={styles.legend} pointerEvents="none">
        {[
          { colour: COLORS.fair, label: 'Clear' },
          { colour: '#3B82F6', label: 'Alternate' },
          { colour: COLORS.warning, label: 'Delay' },
          { colour: COLORS.gouging, label: 'Blocked' },
        ].map(({ colour, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: colour }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#DDE4EA' },
  map: { ...StyleSheet.absoluteFillObject },
  routeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  shopDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  legend: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 10,
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 4,
  },
  mapCaption: {
    position: 'absolute',
    top: 6,
    left: 8,
    right: 8,
    fontSize: 10,
    color: COLORS.textPrimary,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 6,
    fontWeight: '600',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendLine: { width: 14, height: 4, borderRadius: 2 },
  legendText: { fontSize: 9, color: COLORS.textSecondary },
});
