import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPACING } from '../../lib/constants';

export interface AgentLogEntry {
  id: string;
  agent?: string;
  action?: string;
  detail?: string;
  severity?: string;
  rawOutput?: string;
  timestamp?: number;
}

const AGENT_LABELS: Record<string, string> = {
  supply_break_detector: 'Supply break detector',
  orchestrator: 'Orchestrator',
  rumour_detector: 'Rumour detector',
  truth_publisher: 'Truth publisher',
  price_engine: 'Price engine',
  supply_router: 'Supply router',
  dispatch: 'Dispatch',
};

function formatAgent(agent?: string) {
  if (!agent) return 'Agent';
  return AGENT_LABELS[agent] || agent.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function tryParseJson(raw?: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function Row({ label, value }: { label: string; value: string | number | boolean | undefined | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{String(value)}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  label: { width: '38%', fontSize: 12, color: COLORS.textTertiary, fontWeight: '600' },
  value: { flex: 1, fontSize: 13, color: COLORS.textPrimary, flexWrap: 'wrap' },
});

interface Props {
  entry: AgentLogEntry;
  expanded: boolean;
  onToggle: () => void;
}

export function ReadableAgentLog({ entry, expanded, onToggle }: Props) {
  const parsed = tryParseJson(entry.rawOutput);
  const timeStr = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '';

  const isBreakPayload =
    parsed &&
    typeof parsed.break === 'boolean' &&
    (parsed.type !== undefined || parsed.road !== undefined || parsed.reasoning !== undefined);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.card, entry.severity === 'critical' && styles.cardCritical]}
      onPress={onToggle}
    >
      <View style={styles.headerRow}>
        <Text style={styles.agent}>{formatAgent(entry.agent)}</Text>
        <Text style={styles.time}>{timeStr}</Text>
      </View>
      {entry.action ? (
        <View style={styles.actionPill}>
          <Text style={styles.actionText}>{entry.action}</Text>
        </View>
      ) : null}
      {entry.detail ? <Text style={styles.detail}>{entry.detail}</Text> : null}
      <Text style={styles.tapHint}>{expanded ? 'Tap to collapse' : 'Tap for structured details'}</Text>

      {expanded && isBreakPayload ? (
        <View style={styles.breakPanel}>
          <Text style={styles.panelTitle}>Analysis summary</Text>
          <Row label="Supply break" value={parsed.break ? 'Yes' : 'No'} />
          <Row label="Type" value={parsed.type as string} />
          <Row label="Road / route" value={parsed.road as string} />
          <Row label="Severity" value={parsed.severity as number} />
          <Row label="Confidence" value={parsed.confidence as number} />
          <Row label="Shortage (hours)" value={parsed.shortage_hours as number} />
          {Array.isArray(parsed.goods) && parsed.goods.length > 0 ? (
            <Row label="Goods" value={(parsed.goods as string[]).join(', ')} />
          ) : null}
          {Array.isArray(parsed.areas) && parsed.areas.length > 0 ? (
            <Row label="Areas" value={(parsed.areas as string[]).join(', ')} />
          ) : null}
          {parsed.reasoning ? (
            <View style={styles.reasonBlock}>
              <Text style={styles.reasonLabel}>Reasoning</Text>
              <Text style={styles.reasonText}>{String(parsed.reasoning)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {expanded && parsed && !isBreakPayload ? (
        <ScrollView style={styles.rawScroll} nestedScrollEnabled>
          <Text style={styles.rawFallback}>{JSON.stringify(parsed, null, 2)}</Text>
        </ScrollView>
      ) : null}

      {expanded && !parsed && entry.rawOutput ? (
        <ScrollView style={styles.rawScroll} nestedScrollEnabled>
          <Text style={styles.rawFallback}>{entry.rawOutput}</Text>
        </ScrollView>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardCritical: { borderLeftColor: COLORS.danger },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  agent: { fontSize: 15, fontWeight: '700', color: COLORS.primary, flex: 1 },
  time: { fontSize: 11, color: COLORS.textTertiary },
  actionPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  detail: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 6 },
  tapHint: { fontSize: 11, color: COLORS.textTertiary, fontStyle: 'italic' },
  breakPanel: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  panelTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  reasonBlock: { marginTop: 8 },
  reasonLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textTertiary, marginBottom: 4 },
  reasonText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 22 },
  rawScroll: { maxHeight: 200, marginTop: SPACING.sm },
  rawFallback: { fontSize: 11, fontFamily: 'monospace', color: COLORS.textSecondary },
});
