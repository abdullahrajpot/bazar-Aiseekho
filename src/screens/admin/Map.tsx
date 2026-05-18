import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BACKEND_URL } from '../../lib/constants';
import { useSupplyStatus } from '../../hooks/useSupplyStatus';
import { useMarketPrices } from '../../hooks/useMarketPrices';
import { useShops } from '../../hooks/useShops';
import { useTruthFeed } from '../../hooks/useTruthFeed';
import { useUserStore } from '../../store/userStore';
import { CrisisMapView } from '../../components/map/CrisisMapView';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { LoadingState } from '../../components/shared/LoadingState';
import { EmptyState } from '../../components/shared/EmptyState';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const MapScreen = () => {
  const { area } = useUserStore();
  const displayArea = area || 'Surjani Town';
  const { routes, loading: supplyLoading } = useSupplyStatus();
  const { prices, loading: pricesLoading } = useMarketPrices(displayArea);
  const { shopsRecord, loading: shopsLoading } = useShops();
  const { claims } = useTruthFeed(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'routes' | 'gouging'>('routes');

  const gougingReports = prices.filter((p) => p.verdict === 'gouging');
  const loading = supplyLoading || pricesLoading || shopsLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${BACKEND_URL}/api/trigger`, { method: 'POST' });
    } catch {
      /* backend may be offline */
    }
    setTimeout(() => setRefreshing(false), 1200);
  };

  const routeColor = (status?: string) => {
    if (status === 'blocked' || status === 'disrupted') return COLORS.danger;
    if (status === 'partial' || status === 'rerouted') return COLORS.warning;
    return COLORS.fair;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Crisis Map"
        subtitle="Live routes · shop reputation · rumour hotspots"
      />

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'routes' && styles.tabActive]}
          onPress={() => setActiveTab('routes')}
        >
          <Text style={[styles.tabText, activeTab === 'routes' && styles.tabTextActive]}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'gouging' && styles.tabActive]}
          onPress={() => setActiveTab('gouging')}
        >
          <Text style={[styles.tabText, activeTab === 'gouging' && styles.tabTextActive]}>Gouging</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingState message="Map data load ho rahi hai..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          nestedScrollEnabled={Platform.OS === 'android'}
        >
          <View style={styles.mapCard}>
            <CrisisMapView routes={routes} shopsRecord={shopsRecord} claims={claims} />
          </View>

          {activeTab === 'routes' ? (
            Object.keys(routes).length === 0 ? (
              <EmptyState message="No route data yet — start backend agents to poll OpenRouteService." />
            ) : (
              Object.entries(routes).map(([routeId, route]) => (
                <View key={routeId} style={styles.listCard}>
                  <View style={styles.row}>
                    <Icon name="road-variant" size={22} color={routeColor(route.status as string)} />
                    <View style={styles.flex}>
                      <Text style={styles.cardTitle}>{route.route_name || routeId}</Text>
                      <Text style={styles.cardMeta}>
                        {(route.status || 'clear').toUpperCase()} · +
                        {route.extraMinutes ?? route.extra_minutes ?? 0} min
                      </Text>
                      {route.alternate ? (
                        <Text style={styles.alt}>Safest alternate: {route.alternate}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))
            )
          ) : gougingReports.length === 0 ? (
            <EmptyState message="No gouging flags in this area." />
          ) : (
            gougingReports.map((report) => (
              <View key={report.id} style={styles.listCard}>
                <Text style={styles.cardTitle}>{report.shopName}</Text>
                <Text style={styles.cardMeta}>
                  {report.itemName}: Rs {report.price} (fair Rs {report.fairPrice})
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.white },
  scroll: { padding: SPACING.lg },
  mapCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.sm,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  flex: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  cardMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  alt: { fontSize: 13, color: COLORS.primary, marginTop: 4, fontWeight: '500' },
});

export default MapScreen;
