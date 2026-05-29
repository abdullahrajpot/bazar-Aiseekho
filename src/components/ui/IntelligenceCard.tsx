import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { THEME } from '../../lib/theme';

type Severity = 'critical' | 'warning' | 'info';
type AgentStrip = 'ciro' | 'supply' | 'truth' | 'default';

interface IntelligenceCardProps {
  agent?: AgentStrip;
  severity?: Severity;
  title: string;
  detail: string;
  timestamp?: number;
  meta?: string;
  icon?: string;
  style?: ViewStyle;
}

const STRIP: Record<AgentStrip, string> = {
  ciro: THEME.agentCiro,
  supply: THEME.agentSupply,
  truth: THEME.agentTruth,
  default: THEME.primary,
};

const SEV: Record<Severity, { bg: string; border: string; text: string }> = {
  critical: { bg: THEME.errorContainer, border: THEME.error, text: THEME.error },
  warning: { bg: '#FAEEDA', border: THEME.warning, text: '#633806' },
  info: { bg: THEME.surfaceDim, border: THEME.primary, text: THEME.onSurface },
};

/** Intelligence card — 4px left agent strip + severity pill (design system) */
export const IntelligenceCard: React.FC<IntelligenceCardProps> = ({
  agent = 'default',
  severity = 'info',
  title,
  detail,
  timestamp,
  meta,
  icon = 'information-outline',
  style,
}) => {
  const sev = SEV[severity];
  return (
    <View style={[styles.card, { borderLeftColor: STRIP[agent] }, style]}>
      <View style={styles.head}>
        <Icon name={icon} size={20} color={sev.text} style={{ marginRight: 8 }} />
        <Text style={styles.agent}>{title}</Text>
        {timestamp ? (
          <Text style={styles.time}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
      </View>
      <View style={[styles.pill, { backgroundColor: `${sev.border}18` }]}>
        <Text style={[styles.pillText, { color: sev.text }]}>{severity.toUpperCase()}</Text>
      </View>
      <Text style={styles.detail}>{detail}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radiusCard,
    padding: 14,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: THEME.outline,
    borderLeftWidth: 4,
    shadowColor: '#1A1F2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  agent: { flex: 1, fontSize: 13, fontWeight: '700', color: THEME.onSurface },
  time: { fontSize: 11, color: THEME.onSurfaceVariant },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 8,
  },
  pillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  detail: { fontSize: 14, color: THEME.onSurfaceVariant, lineHeight: 20 },
  meta: { fontSize: 11, color: THEME.onSurfaceVariant, marginTop: 6, fontStyle: 'italic' },
});
