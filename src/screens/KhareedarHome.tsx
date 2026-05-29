import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../lib/theme';
import { BACKEND_URL } from '../lib/constants';
import { PriceCard } from '../components/PriceCard';
import { TruthCard } from '../components/TruthCard';
import { useMarketPrices } from '../hooks/useMarketPrices';
import { useTruthFeed } from '../hooks/useTruthFeed';
import { useUserStore } from '../store/userStore';
import { useCrisisEvents } from '../hooks/useCrisisEvents';
import { useRegionalMarket } from '../hooks/useRegionalMarket';
import { useCrisisSituation } from '../hooks/useCrisisSituation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DesignHeader } from '../components/ui/DesignHeader';

/** CIRO-first home — design: crisis banner → supply chips → agent prices → truth */
const KhareedarHome = ({ navigation }: any) => {
  const { area } = useUserStore();
  const displayArea = area || 'Surjani Town';
  const { prices, loading: pricesLoading } = useMarketPrices(displayArea);
  const { claims, loading: claimsLoading } = useTruthFeed(displayArea);
  const { crises, loading: crisesLoading } = useCrisisEvents(displayArea);
  const { supply, updatedAt } = useRegionalMarket(displayArea);
  const { situation } = useCrisisSituation(displayArea);
  const [refreshing, setRefreshing] = useState(false);

  const activeCrisis = crises.find((c) => c.status !== 'resolved');

  const agentPrices = prices.filter(
    (p) => p.shopName?.includes('CIRO') || String(p.id).includes('agent')
  );
  const displayPrices = agentPrices.length > 0 ? agentPrices : prices;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${BACKEND_URL}/api/trigger`, { method: 'POST' });
    } catch {
      /* offline */
    }
    setTimeout(() => setRefreshing(false), 1500);
  };

  const chipColor = (status: string) => {
    if (status === 'critical') return THEME.gouging;
    if (status === 'warning') return THEME.warning;
    return THEME.fair;
  };

  return (
    <SafeAreaView style={styles.container}>
      <DesignHeader
        subtitle={displayArea}
        showLive={Boolean(activeCrisis)}
        onRefresh={onRefresh}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}
      >
        {activeCrisis ? (
          <TouchableOpacity
            style={styles.crisisBanner}
            onPress={() => navigation.navigate('Map')}
          >
            <Icon name="alert" size={28} color={THEME.error} />
            <View style={styles.bannerBody}>
              <View style={styles.bannerTop}>
                <Text style={styles.bannerTitle}>
                  {activeCrisis.type.replace(/_/g, ' ')} — {activeCrisis.location}
                </Text>
                <Text style={styles.criticalPill}>CRITICAL</Text>
              </View>
              <Text style={styles.bannerDesc}>
                {situation?.impactSummary ||
                  activeCrisis.confidenceReason ||
                  'CIRO agents rerouting supply & notifying Rescue 1122.'}
              </Text>
              <Text style={styles.bannerLink}>VIEW MAP & ROUTES →</Text>
            </View>
          </TouchableOpacity>
        ) : crisesLoading ? (
          <ActivityIndicator color={THEME.primary} style={{ marginVertical: 16 }} />
        ) : (
          <View style={styles.clearBanner}>
            <Icon name="check-circle" size={22} color={THEME.fair} />
            <Text style={styles.clearText}>No active crisis in {displayArea} — monitoring live feeds</Text>
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabel}>LOCAL SUPPLY STATUS</Text>
          <Text style={styles.sectionMeta}>
            {updatedAt ? `Agent updated ${new Date(updatedAt).toLocaleTimeString()}` : 'Agent managed'}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {(supply.length ? supply : [{ itemId: 'atta', label: 'Atta', status: 'ok' }]).map((s) => (
            <View key={s.itemId} style={styles.chip}>
              <View style={[styles.chipDot, { backgroundColor: chipColor(s.status) }]} />
              <Text style={styles.chipText}>{s.label || s.itemId}</Text>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>MARKET TRUTH (AGENT VERIFIED)</Text>
        {pricesLoading ? (
          <ActivityIndicator color={THEME.primary} />
        ) : displayPrices.length > 0 ? (
          displayPrices.slice(0, 6).map((price) => (
            <PriceCard
              key={price.id}
              itemName={price.itemName}
              itemNameUrdu={price.itemNameUrdu}
              price={price.price}
              fairPrice={price.fairPrice}
              shopName={price.shopName}
              distance="Regional agent"
              verdict={price.verdict || 'fair'}
            />
          ))
        ) : (
          <Text style={styles.empty}>
            Prices appear automatically when CIRO detects crisis impact in your region.
          </Text>
        )}

        <Text style={styles.sectionLabel}>RUMOUR CHECK (AUTO)</Text>
        {claimsLoading ? (
          <ActivityIndicator color={THEME.primary} />
        ) : claims.length > 0 ? (
          claims.slice(0, 4).map((claim) => (
            <TruthCard
              key={claim.id}
              claimText={claim.text}
              verdict={claim.verdict}
              reasonUrdu={claim.reasonUrdu || claim.reason_urdu || ''}
              confidence={claim.confidence}
            />
          ))
        ) : (
          <Text style={styles.empty}>No rumours flagged for this area in the latest scan.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scroll: { padding: 16, paddingBottom: 32 },
  crisisBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: THEME.errorContainer,
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: THEME.error,
    marginBottom: 16,
  },
  bannerBody: { flex: 1 },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bannerTitle: { fontWeight: '700', fontSize: 15, color: THEME.onSurface, flex: 1 },
  criticalPill: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.error,
    backgroundColor: 'rgba(186,26,26,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bannerDesc: { fontSize: 13, color: THEME.onSurfaceVariant, marginTop: 6, lineHeight: 18 },
  bannerLink: { fontSize: 11, fontWeight: '700', color: THEME.error, marginTop: 8 },
  clearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E1F5EE',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  clearText: { flex: 1, fontSize: 13, color: THEME.secondary },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: THEME.onSurfaceVariant,
    marginTop: 12,
    marginBottom: 8,
  },
  sectionMeta: { fontSize: 11, color: THEME.primary },
  chips: { marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderWidth: 0.5,
    borderColor: THEME.outline,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
  },
  chipDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  chipText: { fontWeight: '600', fontSize: 13 },
  empty: { fontSize: 13, color: THEME.onSurfaceVariant, marginBottom: 12 },
});

export default KhareedarHome;
