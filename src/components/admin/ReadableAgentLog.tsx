import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SPACING } from '../../lib/constants';
import { THEME } from '../../lib/theme';
import { humanizeAgentMessage } from '../../lib/humanizeAgentLog';

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
    borderBottomColor: THEME.outline,
  },
  label: { width: '38%', fontSize: 12, color: THEME.onSurfaceVariant, fontWeight: '600' },
  value: { flex: 1, fontSize: 13, color: THEME.onSurface, flexWrap: 'wrap' },
});

interface Props {
  entry: AgentLogEntry;
  expanded: boolean;
  onToggle: () => void;
}

export function ReadableAgentLog({ entry, expanded, onToggle }: Props) {
  const parsed = tryParseJson(entry.rawOutput);
  const timeStr = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '';
  const plain = humanizeAgentMessage(entry.agent || '', entry.action || '', entry.detail || '');

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
        <Text style={styles.agent}>{plain.title}</Text>
        <Text style={styles.time}>{timeStr}</Text>
      </View>
      <Text style={styles.detail}>{plain.detail}</Text>
      {plain.meta ? <Text style={styles.metaHint}>{plain.meta}</Text> : null}
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
    backgroundColor: THEME.surface,
    borderRadius: THEME.radiusCard,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: THEME.agentSupply,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  cardCritical: { borderLeftColor: THEME.error },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  agent: { fontSize: 15, fontWeight: '700', color: THEME.onSurface, flex: 1 },
  time: { fontSize: 11, color: THEME.onSurfaceVariant },
  detail: { fontSize: 14, color: THEME.onSurfaceVariant, lineHeight: 22, marginBottom: 6 },
  metaHint: { fontSize: 12, color: THEME.primary, marginBottom: 6 },
  tapHint: { fontSize: 11, color: THEME.onSurfaceVariant, fontStyle: 'italic' },
  breakPanel: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: THEME.surfaceDim,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  panelTitle: { fontSize: 13, fontWeight: '700', color: THEME.onSurface, marginBottom: 8 },
  reasonBlock: { marginTop: 8 },
  reasonLabel: { fontSize: 12, fontWeight: '600', color: THEME.onSurfaceVariant, marginBottom: 4 },
  reasonText: { fontSize: 14, color: THEME.onSurface, lineHeight: 22 },
  rawScroll: { maxHeight: 200, marginTop: SPACING.sm },
  rawFallback: { fontSize: 11, fontFamily: 'monospace', color: THEME.onSurfaceVariant },
});
