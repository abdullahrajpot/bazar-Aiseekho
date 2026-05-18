import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/constants';
import { useAgentLog } from '../../hooks/useAgentLog';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Alerts = () => {
  const { logs, loading } = useAgentLog();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return { name: 'alert-decagram', color: COLORS.danger };
      case 'warning': return { name: 'alert', color: COLORS.warning };
      default: return { name: 'information-outline', color: COLORS.primary };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ہنگامی الرٹس | Agent Alerts</Text>
        <Text style={styles.subtitle}>Real-time critical alerts from Bazar agent network</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {logs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>All systems normal. No active alerts.</Text>
            </View>
          ) : (
            logs.map((log) => {
              const icon = getAlertIcon(log.severity);
              const dateStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              // Only decode detail if it is JSON
              let detailText = log.detail;
              try {
                const parsed = JSON.parse(log.detail);
                if (parsed.reasoning) {
                  detailText = parsed.reasoning;
                }
              } catch (e) {}

              return (
                <View key={log.id} style={[styles.card, log.severity === 'critical' && styles.cardCritical]}>
                  <View style={styles.cardHeader}>
                    <Icon name={icon.name} size={24} color={icon.color} style={{ marginRight: 8 }} />
                    <Text style={styles.agentType}>Agent: {log.agent.toUpperCase()}</Text>
                    <Text style={styles.time}>{dateStr}</Text>
                  </View>
                  <Text style={styles.action}>{log.action.replace(/_/g, ' ').toUpperCase()}</Text>
                  <Text style={styles.detail}>{detailText}</Text>
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
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.gray,
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
  cardCritical: {
    borderColor: COLORS.danger,
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  agentType: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  time: {
    fontSize: 12,
    color: COLORS.gray,
  },
  action: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6,
  },
  detail: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
});

export default Alerts;
