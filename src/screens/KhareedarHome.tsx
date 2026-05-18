import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BACKEND_URL } from '../lib/constants';
import { PriceCard } from '../components/PriceCard';
import { TruthCard } from '../components/TruthCard';
import { useMarketPrices } from '../hooks/useMarketPrices';
import { useTruthFeed } from '../hooks/useTruthFeed';
import { useUserStore } from '../store/userStore';
import { useRouteRecommendations } from '../hooks/useRouteRecommendations';
import { ScreenHeader } from '../components/ui/ScreenHeader';

const KhareedarHome = () => {
  const { area } = useUserStore();
  const displayArea = area || 'Surjani Town';
  const { prices, loading: pricesLoading } = useMarketPrices(displayArea);
  const { claims, loading: claimsLoading } = useTruthFeed(displayArea);
  const { recommendation } = useRouteRecommendations(displayArea);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${BACKEND_URL}/api/trigger`, { method: 'POST' });
    } catch {
      /* offline */
    }
    setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Bazar"
        subtitle={displayArea}
        right={<View style={styles.liveDot} />}
      />

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {recommendation?.public_alert_urdu ? (
          <View style={styles.supplyBanner}>
            <Text style={styles.bannerEn}>{recommendation.public_alert_english}</Text>
            <Text style={styles.bannerUr}>{recommendation.public_alert_urdu}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Real prices near you</Text>
        {pricesLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : prices.length > 0 ? (
          prices.slice(0, 8).map((price) => (
            <PriceCard
              key={price.id}
              itemName={price.itemName}
              itemNameUrdu={price.itemNameUrdu}
              price={price.price}
              fairPrice={price.fairPrice}
              shopName={price.shopName}
              distance="—"
              verdict={price.verdict || 'fair'}
            />
          ))
        ) : (
          <Text style={styles.empty}>No verified prices yet. Submit a report or wait for agents.</Text>
        )}

        <Text style={styles.sectionTitle}>Truth check</Text>
        {claimsLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : claims.length > 0 ? (
          claims.slice(0, 5).map((claim) => (
            <TruthCard
              key={claim.id}
              claimText={claim.text}
              verdict={claim.verdict}
              reasonUrdu={claim.reasonUrdu || claim.reason_urdu || claim.counterMessageUrdu || ''}
              confidence={claim.confidence}
            />
          ))
        ) : (
          <Text style={styles.empty}>No rumours verified yet. Backend scans Twitter every 2 min.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.fair,
  },
  content: { flex: 1 },
  supplyBanner: {
    margin: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: '#FFFAED',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  bannerEn: { fontSize: 13, color: COLORS.textPrimary },
  bannerUr: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6, textAlign: 'right' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  loader: { marginVertical: SPACING.xl },
  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    fontStyle: 'italic',
  },
});

export default KhareedarHome;
