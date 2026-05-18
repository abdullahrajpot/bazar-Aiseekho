import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, GOODS, BASELINE_PRICES } from '../lib/constants';
import { useUserStore } from '../store/userStore';
import { useSupplyStatus } from '../hooks/useSupplyStatus';
import { useRouteRecommendations } from '../hooks/useRouteRecommendations';
import { useMarketPrices } from '../hooks/useMarketPrices';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatAreaLabel, normalizeAreaKey } from '../lib/area';

const DukandarHome = () => {
  const { area } = useUserStore();
  const displayArea = area || 'Surjani Town';
  const areaSubtitle =
    area && !area.includes('—') && area.includes('_')
      ? formatAreaLabel(normalizeAreaKey(area))
      : displayArea;
  const { routes, loading: supplyLoading } = useSupplyStatus();
  const { recommendation, loading: recLoading } = useRouteRecommendations(displayArea);
  const { prices, loading: pricesLoading } = useMarketPrices(displayArea);

  const disrupted = Object.values(routes).some(
    (r: any) => r.status === 'blocked' || r.status === 'partial' || r.status === 'disrupted'
  );
  const hasReroute = recommendation?.route_status === 'rerouted';

  const fairByItem = GOODS.map((good) => {
    const reports = prices.filter((p) => p.itemId === good.id);
    const latest = reports[0];
    const agentFair = latest?.fairPrice && latest.fairPrice > 0 ? latest.fairPrice : 0;
    const baseline = BASELINE_PRICES[good.id]?.normal ?? 0;
    const displayFair = agentFair > 0 ? agentFair : baseline;
    const fromAgent = agentFair > 0;
    return {
      ...good,
      fairPrice: displayFair,
      fromAgent,
      myPrice: latest?.price,
      verdict: latest?.verdict,
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Bazar — Dukandar"
        subtitle={areaSubtitle}
        right={
          <View style={[styles.badge, disrupted || hasReroute ? styles.badgeWarn : styles.badgeOk]}>
            <Text style={styles.badgeText}>
              {hasReroute ? 'Rerouted' : disrupted ? 'Delay' : 'Normal'}
            </Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {(hasReroute || disrupted) && (
          <View style={styles.alert}>
            <Icon name="truck-fast" size={22} color={COLORS.accent} />
            <View style={styles.alertBody}>
              <Text style={styles.alertTitle}>Supply routing update</Text>
              <Text style={styles.alertUrdu}>
                {recommendation?.public_alert_urdu ||
                  'سپلائی کی صورتحال بدلی ہے — نیچے محفوظ راستہ دیکھیں۔'}
              </Text>
              {recommendation?.alternate_route ? (
                <View style={styles.etaChip}>
                  <Text style={styles.etaText}>
                    Safest route: {recommendation.alternate_route} · +{recommendation.eta_extra_minutes || 0} min · Safety {recommendation.safety_score || '—'}%
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {hasReroute && (
          <View style={styles.routeCard}>
            <Text style={styles.routeLabel}>AI safest route (from live analysis)</Text>
            <Text style={styles.routePath}>{recommendation?.recommended_route}</Text>
            <Text style={styles.routeMeta}>
              Avoid: {recommendation?.blocked_road} · Goods: {(recommendation?.goods || []).join(', ') || 'general'}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Aaj ke fair prices</Text>
        {pricesLoading || supplyLoading || recLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
        ) : (
          fairByItem.map((row) => (
            <View
              key={row.id}
              style={[styles.priceRow, row.verdict === 'gouging' && styles.priceRowDanger]}
            >
              <View>
                <Text style={styles.itemEn}>{row.name}</Text>
                <Text style={styles.itemUr}>{row.nameUrdu}</Text>
              </View>
              <View style={styles.priceRight}>
                {row.fairPrice > 0 ? (
                  <>
                    <Text style={styles.fair}>Rs {row.fairPrice}</Text>
                    <Text style={styles.fairSource}>
                      {row.fromAgent ? 'Area agent fair' : 'National baseline (until local reports)'}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.pending}>Awaiting agent</Text>
                )}
                {row.myPrice ? (
                  <Text style={styles.myPrice}>Your last: Rs {row.myPrice}</Text>
                ) : null}
              </View>
            </View>
          ))
        )}

        {!hasReroute && !disrupted && !recLoading && (
          <Text style={styles.hint}>
            Routes clear on live maps. Local fair prices appear after reports in your selected area; baseline shows meanwhile.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeOk: { backgroundColor: '#E8F5EF' },
  badgeWarn: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  alert: {
    flexDirection: 'row',
    backgroundColor: '#FFFAED',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    padding: SPACING.lg,
    borderRadius: 10,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  alertBody: { flex: 1 },
  alertTitle: { fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  alertUrdu: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'right' },
  etaChip: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  etaText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },
  routeCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  routeLabel: { fontSize: 12, color: COLORS.textTertiary, fontWeight: '600' },
  routePath: { fontSize: 15, fontWeight: '600', color: COLORS.primary, marginTop: 4 },
  routeMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 10,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  priceRowDanger: { backgroundColor: '#FFF5F5', borderColor: COLORS.gouging },
  itemEn: { fontWeight: '600', color: COLORS.textPrimary },
  itemUr: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  priceRight: { alignItems: 'flex-end' },
  fair: { fontSize: 18, fontWeight: '700', color: COLORS.fair },
  fairSource: { fontSize: 10, color: COLORS.textTertiary, marginTop: 4, maxWidth: 160, textAlign: 'right' },
  pending: { fontSize: 12, color: COLORS.textTertiary },
  myPrice: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  hint: { fontSize: 13, color: COLORS.textTertiary, textAlign: 'center', marginTop: SPACING.lg },
});

export default DukandarHome;
