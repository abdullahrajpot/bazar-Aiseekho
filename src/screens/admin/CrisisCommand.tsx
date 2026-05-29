import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BACKEND_URL } from '../../lib/constants';
import { THEME } from '../../lib/theme';
import { DesignHeader } from '../../components/ui/DesignHeader';
import { useCrisisEvents } from '../../hooks/useCrisisEvents';
import { useActionLog } from '../../hooks/useActionLog';
import { useUserStore } from '../../store/userStore';
import { CiroPanel } from '../../components/ciro/CiroPanel';
import { useCrisisSituation } from '../../hooks/useCrisisSituation';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const CrisisCommand = ({ navigation }: any) => {
  const { area } = useUserStore();
  const displayArea = area || 'Surjani Town';
  const { crises, loading } = useCrisisEvents(displayArea);
  const { entries } = useActionLog();
  const { situation, simulation, mapRoutes } = useCrisisSituation(displayArea);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const active = crises.filter((c) => c.status !== 'resolved');

  const submitCrisis = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/crisis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, area: displayArea }),
      });
      const data = await res.json();
      setResult(data);
      setText('');
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetch(`${BACKEND_URL}/api/trigger`, { method: 'POST' }).catch(() => {});
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <DesignHeader
        title="Crisis Command"
        subtitle={displayArea}
        showLive={active.length > 0}
        onRefresh={onRefresh}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.inputCard}>
          <Text style={styles.label}>Report situation (text)</Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="G-10 mein pani bhar gaya hai, gaariyan phans gayi hain"
            value={text}
            onChangeText={setText}
          />
          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={submitCrisis}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Detect crisis (Groq agents)</Text>
            )}
          </TouchableOpacity>
          {result?.crisisDetected && (
            <Text style={styles.ok}>
              Detected: {result.type} — {result.location} ({Math.round((result.confidence || 0) * 100)}%)
            </Text>
          )}
          {result?.crisisDetected && result.crisisId && (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => navigation.navigate('CrisisSimulate', { crisisId: result.crisisId })}
            >
              <Text style={styles.linkText}>View live simulation →</Text>
            </TouchableOpacity>
          )}
        </View>

        <CiroPanel situation={situation} simulation={simulation} mapRoutes={mapRoutes} areaLabel={displayArea} />

        <Text style={styles.section}>Active crises</Text>
        {loading ? (
          <ActivityIndicator color={THEME.primary} />
        ) : active.length === 0 ? (
          <Text style={styles.empty}>No active crisis events — submit a report above.</Text>
        ) : (
          active.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.crisisCard}
              onPress={() => navigation.navigate('CrisisSimulate', { crisisId: c.id })}
            >
              <Icon name="alert-octagon" size={22} color={THEME.error} />
              <View style={styles.crisisBody}>
                <Text style={styles.crisisTitle}>{c.type.replace(/_/g, ' ')} — {c.location}</Text>
                <Text style={styles.crisisMeta}>
                  {c.severity} · {Math.round((c.confidence || 0) * 100)}% · Rescue 1122 notified
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.section}>Agent action log</Text>
        {entries.slice(0, 10).map((e) => (
          <View key={e.id} style={styles.logRow}>
            <Text style={styles.logAgent}>{e.agent}</Text>
            <Text style={styles.logDetail} numberOfLines={2}>{e.detail}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scroll: { padding: 16, paddingBottom: 40 },
  inputCard: {
    backgroundColor: THEME.surface,
    padding: 14,
    borderRadius: THEME.radiusCard,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  label: { fontSize: 11, fontWeight: '700', color: THEME.onSurfaceVariant, marginBottom: 6 },
  input: {
    borderWidth: 0.5,
    borderColor: THEME.outline,
    borderRadius: THEME.radiusBtn,
    padding: 10,
    minHeight: 70,
    marginBottom: 10,
    color: THEME.onSurface,
  },
  btn: { backgroundColor: THEME.primaryContainer, padding: 12, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: THEME.onPrimary, fontWeight: '600' },
  ok: { marginTop: 8, color: THEME.fair, fontSize: 13 },
  linkBtn: { marginTop: 8 },
  linkText: { color: THEME.tertiary, fontWeight: '600' },
  section: { fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 8, color: THEME.onSurface },
  empty: { color: THEME.onSurfaceVariant, fontSize: 13 },
  crisisCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: THEME.surface,
    padding: 12,
    borderRadius: THEME.radiusCard,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: THEME.error,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  crisisBody: { flex: 1 },
  crisisTitle: { fontWeight: '700', fontSize: 14, color: THEME.onSurface },
  crisisMeta: { fontSize: 12, color: THEME.onSurfaceVariant, marginTop: 2 },
  logRow: {
    backgroundColor: THEME.surface,
    padding: 8,
    borderRadius: THEME.radiusBtn,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  logAgent: { fontSize: 11, fontWeight: '700', color: THEME.agentCiro },
  logDetail: { fontSize: 12, color: THEME.onSurfaceVariant },
});

export default CrisisCommand;
