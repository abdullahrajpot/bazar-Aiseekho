import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { LatLng, Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  COLORS,
  MONITORED_ROUTES,
  ROUTE_COORDINATES,
  AREA_COORDINATES,
  ROUTE_COLORS,
  SHOP_COLORS,
} from '../../lib/constants';
import { TruthClaim } from '../../hooks/useTruthFeed';
import { normalizeAreaKey } from '../../lib/area';

/** Karachi supply corridor — keeps map on Pakistan even before native tiles load */
const DEFAULT_REGION = {
  latitude: 24.89,
  longitude: 67.04,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

interface CrisisMapViewProps {
  routes: Record<string, any>;
  shopsRecord: Record<string, any>;
  claims?: TruthClaim[];
  selectedArea?: string | null;
  height?: number;
}

function roadToRouteId(road?: string) {
  const map: Record<string, string> = {
    M9: 'M9_surjani',
    N55: 'N55_alt',
    SHP: 'SHP_mandi',
    local: 'local_orangi',
  };
  return road ? map[road] || `${road}_alt` : null;
}

function resolveRouteStatus(routeId: string, road: string, routes: Record<string, any>) {
  return routes[routeId]?.status || routes[road]?.status || 'clear';
}

function resolveAlternate(routeId: string, road: string, routes: Record<string, any>) {
  return routes[routeId]?.alternate || routes[road]?.alternate;
}

export const CrisisMapView: React.FC<CrisisMapViewProps> = ({
  routes,
  shopsRecord,
  claims = [],
  selectedArea,
  height = 320,
}) => {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  const routeCoords = useMemo(() => {
    const list: LatLng[] = [];
    for (const route of MONITORED_ROUTES) {
      const seg = ROUTE_COORDINATES[route.id];
      if (seg?.length) list.push(...seg);
    }
    return list;
  }, []);

  const activeCoord = useMemo(() => {
    if (!selectedArea) return null;
    const key = normalizeAreaKey(selectedArea);
    return AREA_COORDINATES[key] || null;
  }, [selectedArea]);

  const fitRoutes = useCallback(() => {
    if (!mapRef.current) return;
    if (activeCoord) {
      mapRef.current.animateToRegion({
        latitude: activeCoord.latitude,
        longitude: activeCoord.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 1000);
    } else if (routeCoords.length >= 2) {
      mapRef.current.fitToCoordinates(routeCoords, {
        edgePadding: { top: 48, right: 28, bottom: 100, left: 28 },
        animated: Platform.OS === 'ios',
      });
    }
  }, [routeCoords, activeCoord]);

  useEffect(() => {
    if (!mapReady) return;
    const id = setTimeout(fitRoutes, Platform.OS === 'android' ? 400 : 100);
    return () => clearTimeout(id);
  }, [mapReady, fitRoutes, routes, activeCoord]);

  const rumourAreas = claims
    .filter((c) => c.verdict === 'false' && c.area)
    .map((c) => AREA_COORDINATES[c.area!])
    .filter(Boolean);

  return (
    <View style={[styles.wrap, { height }]} collapsable={false}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        onMapReady={() => {
          setMapReady(true);
          fitRoutes();
        }}
        mapPadding={{ top: 8, right: 0, bottom: 72, left: 0 }}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={false}
        loadingEnabled
      >
        {MONITORED_ROUTES.map((route) => {
          const coords = ROUTE_COORDINATES[route.id];
          if (!coords) return null;

          const status = resolveRouteStatus(route.id, route.road, routes);
          const isBlocked = status === 'blocked' || status === 'disrupted';
          const strokeColor = ROUTE_COLORS[status] || COLORS.gray;

          const alternateRoad = resolveAlternate(route.id, route.road, routes);
          const altRouteId = roadToRouteId(alternateRoad);
          const altCoords = altRouteId ? ROUTE_COORDINATES[altRouteId] : null;

          return (
            <React.Fragment key={route.id}>
              <Polyline
                coordinates={coords}
                strokeColor={strokeColor}
                strokeWidth={isBlocked ? 5 : 3}
                lineDashPattern={status === 'partial' ? [10, 5] : undefined}
              />
              {isBlocked && altCoords ? (
                <Polyline
                  coordinates={altCoords}
                  strokeColor={COLORS.fair}
                  strokeWidth={2}
                  lineDashPattern={[6, 4]}
                />
              ) : null}
            </React.Fragment>
          );
        })}

        {Object.entries(shopsRecord).map(([shopId, shop]: [string, any]) => {
          if (!shop?.location?.lat || !shop?.location?.lng) return null;
          const colour = SHOP_COLORS[shop.reputation] || COLORS.gray;
          return (
            <Marker
              key={shopId}
              coordinate={{ latitude: shop.location.lat, longitude: shop.location.lng }}
              title={shop.name || shopId}
              description={`${shop.reputation || 'unknown'} — ${shop.warningCount ?? shop.warning_count ?? 0} warnings`}
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
            radius={600}
            fillColor="rgba(226, 75, 74, 0.12)"
            strokeColor="rgba(226, 75, 74, 0.3)"
            strokeWidth={1}
          />
        ))}
      </MapView>

      <View style={styles.legend} pointerEvents="box-none">
        {[
          { colour: COLORS.fair, label: 'Clear' },
          { colour: COLORS.warning, label: 'Partial' },
          { colour: COLORS.gouging, label: 'Blocked' },
        ].map(({ colour, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: colour }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
        <View style={styles.legendDivider} />
        {[
          { colour: COLORS.fair, label: 'Fair shop' },
          { colour: COLORS.gouging, label: 'Gouging' },
        ].map(({ colour, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colour }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.mapCaption} pointerEvents="none">
        Karachi monitored routes (live agent status)
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#E8EDF2' },
  map: { ...StyleSheet.absoluteFillObject },
  shopDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  legend: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: 6,
  },
  mapCaption: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendLine: { width: 16, height: 4, borderRadius: 2 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: COLORS.textSecondary },
  legendDivider: { width: 1, height: 14, backgroundColor: COLORS.border },
});
