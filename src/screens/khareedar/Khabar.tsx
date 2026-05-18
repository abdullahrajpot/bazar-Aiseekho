import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, BACKEND_URL } from '../../lib/constants';
import { useTruthFeed } from '../../hooks/useTruthFeed';
import { useUserStore } from '../../store/userStore';
import { TruthCard } from '../../components/TruthCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { EmptyState } from '../../components/shared/EmptyState';
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
      <View style={styles.header}>
        <Text style={styles.title}>سچ فیڈ | Truth Feed</Text>
        <Text style={styles.subtitle}>AI verified news, Reddit & Google News scans</Text>
      </View>

      {loading ? (
        <LoadingState message="Truth feed load ho rahi hai..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.feedStatus}>
            <Icon name="rss" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={styles.feedStatusText}>
              Rumour agent polling free feeds every 2 min · {displayArea}
            </Text>
          </View>

          {claims.length === 0 ? (
            <EmptyState message="All clear. No active alerts or verified rumours in your area." />
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  feedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  feedStatusText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    flex: 1,
  },
  scroll: {
    padding: 16,
  },
});

export default Khabar;
