import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../lib/constants';
import { useAdminStats } from '../hooks/useAdminStats';
import { useAgentLog } from '../hooks/useAgentLog';
import { useSupplyStatus } from '../hooks/useSupplyStatus';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { CrisisTimeline } from '../components/admin/CrisisTimeline';
import { ReadableAgentLog } from '../components/admin/ReadableAgentLog';

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
  </View>
);

const AdminDashboard = () => {
  const stats = useAdminStats();
  const { logs, loading } = useAgentLog();
  const { routes } = useSupplyStatus();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasCrisis = Object.values(routes).some(
    (r: any) => r.status === 'blocked' || r.status === 'partial' || r.status === 'disrupted'
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Bazar Admin"
        subtitle="Live agent orchestration"
        right={
          <View style={[styles.pill, hasCrisis && styles.pillDanger]}>
            <Text style={styles.pillText}>{hasCrisis ? 'Crisis Active' : 'Monitoring'}</Text>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsRow}>
          <StatCard label="Supply breaks" value={stats.breaksDetected || 0} color={COLORS.danger} />
          <StatCard label="Routes rerouted" value={stats.routesRerouted || 0} color={COLORS.primary} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Rumours suppressed" value={stats.rumoursSuppressed || 0} color={COLORS.fair} />
          <StatCard label="Gouging flagged" value={stats.gougingShopsFlagged || 0} color={COLORS.warning} />
        </View>

        <CrisisTimeline />

        <Text style={styles.sectionTitle}>Live agent log</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : logs.length === 0 ? (
          <Text style={styles.empty}>No agent activity yet. Run the backend to start polling APIs.</Text>
        ) : (
          logs.map((entry) => (
            <ReadableAgentLog
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: { fontSize: 12, color: COLORS.textSecondary },
  statValue: { fontSize: 28, fontWeight: '700', marginTop: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginVertical: SPACING.lg,
  },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: SPACING.xl },
  pill: {
    backgroundColor: '#E8F5EF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillDanger: { backgroundColor: '#FDE8E8' },
  pillText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
});

export default AdminDashboard;
