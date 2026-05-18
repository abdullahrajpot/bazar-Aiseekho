import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/constants';
import { useShops } from '../../hooks/useShops';
import { ref, update } from 'firebase/database';
import { db } from '../../lib/firebase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Shops = () => {
  const [filter, setFilter] = useState<'all' | 'flagged'>('all');
  const { shops, loading } = useShops(filter === 'flagged' ? 'flagged' : undefined);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleResetReputation = (shopId: string) => {
    Alert.alert(
      'Reset Shop warnings',
      'Are you sure you want to reset this shop\'s warnings and restore reputation to fair?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              const shopRef = ref(db, `shops/${shopId}`);
              await update(shopRef, {
                reputation: 'fair',
                warning_count: 0,
              });
              Alert.alert('Success', 'Shop reputation restored.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const getReputationBadge = (reputation: string) => {
    switch (reputation) {
      case 'flagged': return { label: 'FLAGGED', color: COLORS.danger };
      case 'at_risk': return { label: 'AT RISK', color: COLORS.warning };
      default: return { label: 'FAIR', color: COLORS.secondary };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>دکانداروں کا آڈٹ | Shop Auditing</Text>
        <Text style={styles.subtitle}>Audit registered shops and manage warnings / reputation</Text>
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>All Shops</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'flagged' && styles.filterBtnActive]}
          onPress={() => setFilter('flagged')}
        >
          <Text style={[styles.filterBtnText, filter === 'flagged' && styles.filterBtnTextActive]}>Flagged / Warned</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {shops.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="store-alert-outline" size={64} color={COLORS.gray} />
              <Text style={styles.emptyText}>No shops matching this filter found.</Text>
            </View>
          ) : (
            shops.map((shop) => {
              const badge = getReputationBadge(shop.reputation);

              return (
                <View key={shop.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.shopName}>{shop.name || 'Unnamed Shop'}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.color }]}>
                      <Text style={styles.badgeText}>{badge.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.infoText}>Area: {shop.area || 'Unknown'}</Text>
                  <Text style={styles.infoText}>Warnings Count: {shop.warning_count || 0}</Text>

                  {shop.reputation !== 'fair' && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleResetReputation(shop.id)}
                    >
                      <Icon name="restore" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.actionBtnText}>Reset Reputation & Warnings</Text>
                    </TouchableOpacity>
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
  filterBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: COLORS.background,
  },
  filterBtnActive: {
    backgroundColor: COLORS.lightGray,
  },
  filterBtnText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  filterBtnTextActive: {
    color: COLORS.primary,
    fontWeight: 'bold',
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
    marginBottom: 10,
  },
  shopName: {
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
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  actionBtnText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});

export default Shops;
