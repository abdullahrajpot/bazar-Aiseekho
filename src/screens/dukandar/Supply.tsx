import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/constants';
import { useSupplyStatus } from '../../hooks/useSupplyStatus';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Supply = () => {
  const { supplyStatus, loading } = useSupplyStatus();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'blocked':
      case 'disrupted':
        return COLORS.danger;
      case 'partial':
      case 'rerouted':
        return COLORS.warning;
      case 'clear':
        return COLORS.fair;
      default:
        return COLORS.textTertiary;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>سپلائی بورڈ | Supply Route Board</Text>
        <Text style={styles.subtitle}>Real-time routing ETA & delay alerts from Bazar AI dispatch</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {Object.keys(supplyStatus).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="truck-check-outline" size={64} color={COLORS.secondary} />
              <Text style={styles.emptyText}>All supply routes running on time. No active disruptions.</Text>
            </View>
          ) : (
            Object.keys(supplyStatus).map((routeId) => {
              const route = supplyStatus[routeId];
              const statusColor = getStatusColor(route.status);

              return (
                <View key={routeId} style={[styles.card, { borderLeftColor: statusColor, borderLeftWidth: 4 }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.routeName}>{route.route_name || routeId.toUpperCase().replace(/_/g, ' ')}</Text>
                    <View style={[styles.badge, { backgroundColor: statusColor }]}>
                      <Text style={styles.badgeText}>{route.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.etaRow}>
                    <Icon name="clock-outline" size={20} color={COLORS.gray} style={{ marginRight: 8 }} />
                    <Text style={styles.etaText}>
                      Delay: <Text style={{ fontWeight: 'bold', color: route.extra_minutes > 0 ? COLORS.danger : COLORS.secondary }}>
                        +{route.extra_minutes || 0} mins
                      </Text>
                    </Text>
                  </View>

                  {(route.alternate_route || route.alternate) && (
                    <View style={styles.rerouteContainer}>
                      <View style={styles.rerouteHeader}>
                        <Icon name="directions-fork" size={16} color={COLORS.warning} style={{ marginRight: 6 }} />
                        <Text style={styles.rerouteTitle}>Safest alternate (agent + HERE Maps)</Text>
                      </View>
                      <Text style={styles.rerouteText}>{route.alternate_route || route.alternate}</Text>
                    </View>
                  )}

                  {route.reasoning && (
                    <Text style={styles.reasonText}>Reason: {route.reasoning}</Text>
                  )}
                </View>
              );
            })
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
  scroll: {
    padding: 16,
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
    marginBottom: 12,
  },
  routeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  etaText: {
    fontSize: 15,
    color: '#4B5563',
  },
  rerouteContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginBottom: 12,
  },
  rerouteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rerouteTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#D97706',
  },
  rerouteText: {
    fontSize: 14,
    color: '#78350F',
    fontWeight: '500',
  },
  reasonText: {
    fontSize: 13,
    color: COLORS.gray,
    fontStyle: 'italic',
  },
});

export default Supply;
