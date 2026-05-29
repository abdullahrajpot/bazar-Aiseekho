import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type TimeRange = '24h' | '7d' | 'all';

interface Props {
  agentLabel: string;
  agentSub: string;
  timeRange: TimeRange;
  onTimeRange: (r: TimeRange) => void;
  incidentCount: number;
  onRefresh?: () => void;
  onMenuPress?: () => void;
}

export const AgentMapOverlay: React.FC<Props> = ({
  agentLabel,
  agentSub,
  timeRange,
  onTimeRange,
  incidentCount,
  onRefresh,
  onMenuPress,
}) => (
  <View style={styles.wrap} pointerEvents="box-none">
    <View style={styles.agentBar}>
      <TouchableOpacity style={styles.menuBtn} onPress={onMenuPress}>
        <Icon name="menu" size={22} color="#E8EAED" />
      </TouchableOpacity>
      <View style={styles.agentText}>
        <Text style={styles.agentTitle}>{agentLabel}</Text>
        <Text style={styles.agentSub} numberOfLines={1}>{agentSub}</Text>
      </View>
      <TouchableOpacity onPress={onRefresh} style={styles.bellBtn}>
        <Icon name="bell-outline" size={22} color="#E8EAED" />
        {incidentCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{incidentCount > 9 ? '9+' : incidentCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>

    <View style={styles.filterRow}>
      {(['24h', '7d', 'all'] as TimeRange[]).map((r) => (
        <TouchableOpacity
          key={r}
          style={[styles.filterBtn, timeRange === r && styles.filterActive]}
          onPress={() => onTimeRange(r)}
        >
          <Text style={[styles.filterText, timeRange === r && styles.filterTextActive]}>
            {r === 'all' ? 'All' : r}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    <View style={styles.legend}>
      <Text style={styles.legendTitle}>SEVERITY</Text>
      {[
        { c: '#8B0000', l: 'CRITICAL' },
        { c: '#E24B4A', l: 'HIGH' },
        { c: '#F59E0B', l: 'MEDIUM' },
        { c: '#14B8A6', l: 'LOW' },
      ].map(({ c, l }) => (
        <View key={l} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: c }]} />
          <Text style={styles.legendLabel}>{l}</Text>
        </View>
      ))}
      <View style={styles.divider} />
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#E24B4A' }]} />
        <Text style={styles.legendLabel}>BLOCKED</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
        <Text style={styles.legendLabel}>CLEAR</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
        <Text style={styles.legendLabel}>ALT ROUTE</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  agentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(22, 27, 42, 0.92)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  menuBtn: { padding: 4, marginRight: 8 },
  agentText: { flex: 1 },
  agentTitle: { color: '#F3F4F6', fontSize: 15, fontWeight: '700' },
  agentSub: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  bellBtn: { padding: 4 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  filterRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(22, 27, 42, 0.88)',
    borderRadius: 20,
    padding: 4,
    gap: 4,
  },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  filterActive: { backgroundColor: '#1D6E4E' },
  filterText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  legend: {
    position: 'absolute',
    right: 12,
    top: 100,
    backgroundColor: 'rgba(22, 27, 42, 0.9)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  legendTitle: { color: '#6B7280', fontSize: 9, fontWeight: '700', marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: '#D1D5DB', fontSize: 9, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 5 },
});
