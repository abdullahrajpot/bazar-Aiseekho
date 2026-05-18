import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../lib/constants';
import { useAgentLog } from '../../hooks/useAgentLog';

const AGENT_COLORS: Record<string, string> = {
  supply_break_detector: COLORS.gouging,
  rumour_detector: '#D85A30',
  supply_router: COLORS.fair,
  price_engine: COLORS.warning,
  signal_aggregator: COLORS.gray,
  truth_publisher: COLORS.fair,
};

function formatTime(ts?: number) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const CrisisTimeline = () => {
  const { logs } = useAgentLog();
  const recent = logs.slice(0, 10);

  if (recent.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Crisis timeline</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {[...recent].reverse().map((entry, i) => {
            const color = AGENT_COLORS[entry.agent] || COLORS.gray;
            return (
              <View key={entry.id} style={styles.item}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.agent}>{entry.agent?.replace(/_/g, ' ')}</Text>
                <Text style={styles.action} numberOfLines={2}>
                  {entry.detail || entry.action}
                </Text>
                <Text style={styles.time}>{formatTime(entry.timestamp)}</Text>
                {i < recent.length - 1 ? <View style={styles.line} /> : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: SPACING.lg, marginBottom: SPACING.md },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: SPACING.sm },
  item: { width: 140, alignItems: 'center', position: 'relative' },
  dot: { width: 12, height: 12, borderRadius: 6, marginBottom: 6 },
  agent: { fontSize: 10, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  action: { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4 },
  time: { fontSize: 9, color: COLORS.textTertiary, marginTop: 4 },
  line: {
    position: 'absolute',
    right: -20,
    top: 5,
    width: 40,
    height: 2,
    backgroundColor: COLORS.border,
  },
});
