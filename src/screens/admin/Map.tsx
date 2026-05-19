import React, { useState, useMemo } from 'react';
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
import { useSignals } from '../../hooks/useSignals';
import { useUserStore } from '../../store/userStore';
import { CrisisMapView } from '../../components/map/CrisisMapView';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { LoadingState } from '../../components/shared/LoadingState';
import { EmptyState } from '../../components/shared/EmptyState';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { normalizeAreaKey, getAreaSpecificRoutes, resolveRouteMeta } from '../../lib/area';
import { useCrisisSituation } from '../../hooks/useCrisisSituation';
import { CiroPanel } from '../../components/ciro/CiroPanel';

const MapScreen = () => {
  const { area } = useUserStore();
  const displayArea = area || 'Surjani Town';
  const { routes, loading: supplyLoading } = useSupplyStatus();
  const { prices, loading: pricesLoading } = useMarketPrices(displayArea);
  const { shopsRecord, loading: shopsLoading } = useShops();
  const { claims } = useTruthFeed(displayArea);
  const { signals } = useSignals(displayArea);
  const { situation, simulation, mapRoutes } = useCrisisSituation(displayArea);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'routes' | 'gouging'>('routes');

  const gougingReports = prices.filter((p) => p.verdict === 'gouging');

  const areaKey = normalizeAreaKey(displayArea);

  const localSignals = useMemo(() => {
    if (!displayArea) return [];
    const city = displayArea.toLowerCase().split(' — ')[0];
    return (signals || []).filter((s) => {
      const text = (s.text || '').toLowerCase();
      const social =
        s.source === 'twitter' ||
        s.source === 'whatsapp' ||
        s.source === 'google_news' ||
        s.source === 'reddit' ||
        s.source === 'ndma';
      if (!social) return false;
      return (
        s.area === areaKey ||
        text.includes(areaKey.replace(/_/g, ' ')) ||
        (city.length > 2 && text.includes(city))
      );
    });
  }, [signals, displayArea, areaKey]);

  const areaRoutes = useMemo(() => {
    return getAreaSpecificRoutes(displayArea);
  }, [displayArea]);

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
    <SafeAreaView style={styles.containerFlex}>
      <ScreenHeader
        title="Crisis Map"
        subtitle={`${displayArea} · live routes · shops · agent scans`}
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

      <View style={styles.mapCard}>
        <CrisisMapView
          routes={routes}
          shopsRecord={shopsRecord}
          claims={claims}
          selectedArea={displayArea}
          height={360}
          ciroMapRoutes={mapRoutes}
        />
      </View>

      {loading ? (
        <LoadingState message="Route analysis load ho rahi hai..." />
      ) : (
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          nestedScrollEnabled={Platform.OS === 'android'}
        >
          <CiroPanel
            situation={situation}
            simulation={simulation}
            mapRoutes={mapRoutes}
            areaLabel={displayArea}
          />

          {/* Twitter / WhatsApp scanned feed */}
          <View style={styles.newsSection}>
            <View style={styles.newsHeader}>
              <Icon name="twitter" size={20} color="#1DA1F2" style={{ marginRight: 8 }} />
              <Text style={styles.newsTitle}>Scanned Twitter News Feed — {displayArea}</Text>
            </View>
            {localSignals.length > 0 ? (
              localSignals.map((sig, idx) => (
                <View key={idx} style={styles.newsCardItem}>
                  <View style={styles.newsMetaRow}>
                    <View style={styles.newsAlertBadge}>
                      <Icon name="alert-decagram" size={14} color={COLORS.danger} style={{ marginRight: 4 }} />
                      <Text style={styles.newsAlertBadgeText}>Incident Alert</Text>
                    </View>
                    <Text style={styles.newsTimeText}>
                      Scanned {new Date(sig.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={styles.newsBodyText}>{sig.text}</Text>
                </View>
              ))
            ) : (
              <View style={styles.newsCardItemEmpty}>
                <Icon name="antenna" size={24} color={COLORS.primary} style={{ marginBottom: 6 }} />
                <Text style={styles.newsEmptyText}>
                  Agents scanned RSS, Reddit, and news for {displayArea}. No unusual corridor alerts in the last cycle.
                </Text>
              </View>
            )}
          </View>

          {activeTab === 'routes' ? (
            areaRoutes.length === 0 ? (
              <EmptyState message="No route data yet — start backend agents to poll OpenRouteService." />
            ) : (
              areaRoutes.map((areaRoute) => {
                const backendRoute = resolveRouteMeta(areaRoute, routes, areaKey);
                const status = backendRoute.status || 'clear';
                const isBlocked = status === 'blocked' || status === 'disrupted';
                const isPartial = status === 'partial' || status === 'rerouted';
                
                const speed = isBlocked
                  ? '0 km/h (No Passage)'
                  : isPartial
                    ? '15 km/h (Slow Transit due to waterlogging)'
                    : '60 km/h (Optimal Flow)';
                    
                const badgeLabel = isBlocked
                  ? 'BLOCKED'
                  : isPartial
                    ? 'HEAVY TRAFFIC'
                    : 'FLOWING CLEAN';
                    
                const badgeColor = isBlocked
                  ? COLORS.danger
                  : isPartial
                    ? COLORS.warning
                    : COLORS.fair;

                const reasoning = backendRoute.reasoning || (isBlocked ? `Bazar Telemetry identified active transit obstruction on ${areaRoute.road} route. Rerouting initialized.` : null);
                const alternate = backendRoute.alternate || (isBlocked ? (areaRoute.road === 'M9' ? 'N55' : 'local') : null);

                return (
                  <View key={areaRoute.id} style={styles.listCard}>
                    <View style={styles.row}>
                      <Icon name="road-variant" size={26} color={routeColor(status)} />
                      <View style={styles.flex}>
                        <View style={styles.cardHeaderRow}>
                          <Text style={styles.cardTitle}>{areaRoute.name}</Text>
                          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
                            <Text style={styles.badgeText}>{badgeLabel}</Text>
                          </View>
                        </View>
                        
                        <View style={styles.metaBox}>
                          <View style={styles.metaRow}>
                            <Icon name="speedometer" size={14} color={COLORS.gray} style={{ marginRight: 6 }} />
                            <Text style={styles.metaVal}>{speed}</Text>
                          </View>
                          <View style={styles.metaRow}>
                            <Icon name="clock-outline" size={14} color={COLORS.gray} style={{ marginRight: 6 }} />
                            <Text style={styles.metaVal}>Delay: +{backendRoute.extraMinutes ?? backendRoute.extra_minutes ?? 0} mins</Text>
                          </View>
                        </View>

                        {reasoning ? (
                          <View style={styles.reasoningBox}>
                            <Icon name="radar" size={16} color={COLORS.danger} style={{ marginRight: 6, marginTop: 2 }} />
                            <Text style={styles.reasoningText}>
                              <Text style={{ fontWeight: '700' }}>Scanned Cause: </Text>
                              {reasoning}
                            </Text>
                          </View>
                        ) : null}

                        {alternate ? (
                          <View style={styles.altBox}>
                            <Icon name="directions-fork" size={16} color={COLORS.primary} style={{ marginRight: 6 }} />
                            <Text style={styles.altText}>
                              <Text style={{ fontWeight: '700' }}>Re-routing Recommendation: </Text>
                              Use {alternate === 'N55' ? 'N55 alternate bypass' : alternate} safely.
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
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
  containerFlex: { flex: 1, backgroundColor: COLORS.background },
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
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  listScroll: { flex: 1 },
  mapCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
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
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  metaBox: { flexDirection: 'row', gap: 16, marginTop: 8, flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaVal: { fontSize: 13, color: COLORS.textSecondary },
  reasoningBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#FEE2E2' },
  reasoningText: { fontSize: 12, color: '#991B1B', flex: 1, lineHeight: 18 },
  altBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#D1FAE5' },
  altText: { fontSize: 12, color: '#065F46', flex: 1 },
  newsSection: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.lg, marginBottom: SPACING.lg },
  newsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  newsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  newsCardItem: { backgroundColor: COLORS.background, borderRadius: 10, padding: 12, borderLeftWidth: 4, borderLeftColor: '#1DA1F2', marginBottom: SPACING.sm },
  newsMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  newsAlertBadge: { flexDirection: 'row', alignItems: 'center' },
  newsAlertBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.danger },
  newsTimeText: { fontSize: 11, color: COLORS.textTertiary },
  newsBodyText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
  newsCardItemEmpty: { alignItems: 'center', paddingVertical: SPACING.lg },
  newsEmptyText: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 },
});

export default MapScreen;
