import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../lib/constants';
import {
  CrisisSituation,
  CrisisSimulation,
  MapRouteEntry,
} from '../../hooks/useCrisisSituation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface CiroPanelProps {
  situation: CrisisSituation | null;
  simulation: CrisisSimulation | null;
  mapRoutes?: MapRouteEntry[];
  areaLabel: string;
}

export const CiroPanel: React.FC<CiroPanelProps> = ({
  situation,
  simulation,
  mapRoutes = [],
  areaLabel,
}) => {
  const active = situation?.active;
  const confidencePct = Math.round((situation?.confidence || 0) * 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Icon name="robot-outline" size={22} color={COLORS.primary} />
        <Text style={styles.title}>CIRO — Crisis Intelligence</Text>
      </View>

      <View style={[styles.badge, active ? styles.badgeAlert : styles.badgeOk]}>
        <Text style={styles.badgeLabel}>
          {situation?.situationLabel || 'Monitoring'}
          {active ? ` · ${confidencePct}% confidence` : ''}
        </Text>
        {situation?.situationLabelUrdu ? (
          <Text style={styles.badgeUrdu}>{situation.situationLabelUrdu}</Text>
        ) : null}
      </View>

      {situation?.explanationEnglish ? (
        <Text style={styles.explain}>{situation.explanationEnglish}</Text>
      ) : (
        <Text style={styles.explain}>
          Agents ingesting Twitter, WhatsApp, weather, maps & news for {areaLabel}.
        </Text>
      )}

      {situation?.impacts?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Impact</Text>
          {situation.impacts.map((imp, i) => (
            <Text key={i} style={styles.bullet}>
              • {imp}
            </Text>
          ))}
        </View>
      ) : null}

      {Array.isArray((situation as any)?.plan) && (situation as any).plan.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended actions</Text>
          {(situation as any).plan.slice(0, 4).map((a: any, i: number) => (
            <Text key={i} style={styles.bullet}>
              • [{a.type}] {a.description}
            </Text>
          ))}
        </View>
      ) : null}

      {simulation ? (
        <View style={styles.simBox}>
          <Text style={styles.sectionTitle}>Simulated execution</Text>
          <View style={styles.beforeAfter}>
            <View style={styles.col}>
              <Text style={styles.colLabel}>Before</Text>
              <Text style={styles.colVal}>
                {(simulation.before as any)?.congestionLevel || '—'}
              </Text>
            </View>
            <Icon name="arrow-right" size={18} color={COLORS.gray} />
            <View style={styles.col}>
              <Text style={styles.colLabel}>After</Text>
              <Text style={[styles.colVal, { color: COLORS.fair }]}>
                {(simulation.after as any)?.congestionLevel || '—'}
              </Text>
            </View>
          </View>
          {simulation.outcome ? (
            <Text style={styles.outcome}>{simulation.outcome}</Text>
          ) : null}
          {simulation.executionLog?.slice(0, 4).map((log, i) => (
            <Text key={i} style={styles.logLine}>
              ✓ {log.step.replace(/_/g, ' ')}
            </Text>
          ))}
        </View>
      ) : null}

      {mapRoutes.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Predicted routes</Text>
          {mapRoutes.map((r) => (
            <Text key={r.id} style={styles.routeLine}>
              {r.status === 'blocked' ? '🔴' : r.status === 'rerouted' ? '🔵' : '🟢'} {r.name}{' '}
              — {r.status}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.pipeline}>
        Pipeline: ingest → detect → plan → simulate → outcome
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  badge: { borderRadius: 8, padding: 10, marginBottom: 8 },
  badgeAlert: { backgroundColor: '#FEF2F2', borderLeftWidth: 4, borderLeftColor: COLORS.danger },
  badgeOk: { backgroundColor: '#ECFDF5', borderLeftWidth: 4, borderLeftColor: COLORS.fair },
  badgeLabel: { fontWeight: '700', fontSize: 14, color: '#1F2937' },
  badgeUrdu: { fontSize: 13, color: '#4B5563', marginTop: 4 },
  explain: { fontSize: 13, color: '#4B5563', lineHeight: 20, marginBottom: 8 },
  section: { marginTop: 8 },
  sectionTitle: { fontWeight: '700', fontSize: 13, color: COLORS.primary, marginBottom: 4 },
  bullet: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  simBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  beforeAfter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  col: { alignItems: 'center' },
  colLabel: { fontSize: 10, color: COLORS.gray },
  colVal: { fontSize: 12, fontWeight: '600' },
  outcome: { fontSize: 12, color: COLORS.primary, marginTop: 8, fontStyle: 'italic' },
  logLine: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  routeLine: { fontSize: 12, color: '#374151', marginTop: 2 },
  pipeline: { fontSize: 10, color: COLORS.gray, marginTop: 12, textAlign: 'center' },
});
