import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../../lib/theme';
import { BACKEND_URL } from '../../lib/constants';
import { useTruthFeed } from '../../hooks/useTruthFeed';
import { useUserStore } from '../../store/userStore';
import { TruthCard } from '../../components/TruthCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { EmptyState } from '../../components/shared/EmptyState';
import { DesignHeader } from '../../components/ui/DesignHeader';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Khabar = () => {
  const { area } = useUserStore();
  const displayArea = area || 'Surjani Town';
  const { claims, loading } = useTruthFeed(displayArea);
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
      <DesignHeader
        title="سچ فیڈ | Truth"
        subtitle={`Rumour agent · ${displayArea}`}
        showLive={claims.length > 0}
        onRefresh={onRefresh}
      />

      {loading ? (
        <LoadingState message="Truth feed load ho rahi hai..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.feedStatus}>
            <Icon name="rss" size={20} color={THEME.primary} />
            <Text style={styles.feedStatusText}>
              AI scans Reddit & news every 2 min · {claims.length} claims
            </Text>
          </View>

          {claims.length === 0 ? (
            <EmptyState message="All clear. No active rumours flagged for your area." />
          ) : (
            claims.map((claim) => (
              <TruthCard
                key={claim.id}
                claimText={claim.text}
                verdict={claim.verdict}
                reasonUrdu={
                  claim.reasonUrdu ||
                  claim.reason_urdu ||
                  claim.counterMessageUrdu ||
                  claim.counter_message ||
                  'تفتیش جاری ہے'
                }
                confidence={claim.confidence || 0.9}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  feedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.surfaceContainer,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: THEME.radiusCard,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: THEME.primary,
  },
  feedStatusText: { fontSize: 12, color: THEME.primary, fontWeight: '600', flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
});

export default Khabar;
