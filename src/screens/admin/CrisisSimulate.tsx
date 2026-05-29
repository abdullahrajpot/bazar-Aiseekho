import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BACKEND_URL } from '../../lib/constants';
import { THEME } from '../../lib/theme';
import { DesignHeader } from '../../components/ui/DesignHeader';
import { useSimulation } from '../../hooks/useSimulation';
import { useActionLog } from '../../hooks/useActionLog';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const CrisisSimulate = ({ route, navigation }: any) => {
  const crisisId = route.params?.crisisId;
  const { simulation, loading, steps } = useSimulation(crisisId);
  const { entries } = useActionLog(crisisId);
  const [situation, setSituation] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [outcome, setOutcome] = useState<any>(null);

  useEffect(() => {
    if (!crisisId) return;
    fetch(`${BACKEND_URL}/api/crisis-event/${crisisId}`)
      .then((r) => r.json())
      .then((d) => {
        setSituation(d.situation);
        setPlan(d.plan);
        setOutcome(d.outcome);
      })
      .catch(() => {});
  }, [crisisId]);

  const stepStyle = (status: string) => {
    if (status === 'completed') return { border: THEME.fair, bg: '#E1F5EE' };
    if (status === 'in_progress') return { border: THEME.warning, bg: '#FAEEDA' };
    return { border: THEME.outline, bg: THEME.surface };
  };

  return (
    <SafeAreaView style={styles.container}>
      <DesignHeader title="Response simulation" showLive onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {situation && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Situation analysis</Text>
            <Text>{situation.impactSummary}</Text>
            <Text style={styles.conf}>
              Confidence: {Math.round((situation.confidence || 0) * 100)}%
            </Text>
          </View>
        )}

        {plan?.actions?.map((a: any) => (
          <View key={a.id} style={styles.actionRow}>
            <Text style={styles.actionTitle}>{a.title}</Text>
            <Text style={styles.agency}>{a.targetAgency} · {a.status}</Text>
          </View>
        ))}

        <Text style={styles.section}>Live execution steps</Text>
        {loading && !steps.length ? (
          <ActivityIndicator color={THEME.primary} />
        ) : (
          steps.map((step) => {
            const s = stepStyle(step.status);
            return (
              <View key={step.stepId} style={[styles.step, { borderLeftColor: s.border, backgroundColor: s.bg }]}>
                <Text style={styles.stepTitle}>
                  {step.stepId}. {step.title}
                </Text>
                <Text style={styles.stepDesc}>{step.description}</Text>
                {step.ticketId && (
                  <Text style={styles.ticket}>Ticket #{step.ticketId} · Rescue 1122 / Police</Text>
                )}
                <Text style={styles.badge}>{step.status}</Text>
              </View>
            );
          })
        )}

        {outcome && (
          <View style={styles.outcome}>
            <Text style={styles.outcomeTitle}>Outcome</Text>
            <Text>Congestion reduced: {outcome.reductionPercent}%</Text>
            <Text>Response time: {outcome.timeToResponseMinutes} min</Text>
          </View>
        )}

        <Text style={styles.section}>Action log</Text>
        {entries.slice(0, 8).map((e) => (
          <Text key={e.id} style={styles.log}>
            [{e.agent}] {e.detail}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: THEME.surface },
  title: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16 },
  card: { backgroundColor: THEME.surface, padding: 14, borderRadius: 10, marginBottom: 12 },
  cardTitle: { fontWeight: '700', marginBottom: 6 },
  conf: { marginTop: 6, fontSize: 12, color: THEME.primary },
  actionRow: { backgroundColor: THEME.surface, padding: 10, borderRadius: 8, marginBottom: 6 },
  actionTitle: { fontWeight: '600', fontSize: 13 },
  agency: { fontSize: 11, color: THEME.onSurfaceVariant },
  section: { fontWeight: '700', marginTop: 12, marginBottom: 8 },
  step: { padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4 },
  stepTitle: { fontWeight: '700', fontSize: 13 },
  stepDesc: { fontSize: 12, marginTop: 4, color: THEME.onSurfaceVariant },
  ticket: { fontSize: 11, marginTop: 4, fontStyle: 'italic', color: THEME.error },
  badge: { fontSize: 10, marginTop: 4, fontWeight: '700' },
  outcome: { backgroundColor: '#E1F5EE', padding: 14, borderRadius: 10, marginTop: 12 },
  outcomeTitle: { fontWeight: '700', marginBottom: 6 },
  log: { fontSize: 11, color: THEME.onSurfaceVariant, marginBottom: 4 },
});

export default CrisisSimulate;
