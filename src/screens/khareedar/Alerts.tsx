import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, BACKEND_URL } from '../../lib/constants';
import { useAgentLog } from '../../hooks/useAgentLog';
import { useUserStore } from '../../store/userStore';
import { useSignals } from '../../hooks/useSignals';
import { useAreaAlerts } from '../../hooks/useAreaAlerts';
import { useTruthFeed } from '../../hooks/useTruthFeed';
import { useCrisisSituation } from '../../hooks/useCrisisSituation';
import { CiroPanel } from '../../components/ciro/CiroPanel';
import { useRouteRecommendations } from '../../hooks/useRouteRecommendations';
import { normalizeAreaKey } from '../../lib/area';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const SOCIAL_SOURCES = new Set([
  'twitter',
  'whatsapp',
  'google_news',
  'reddit',
  'ndma',
  'free_feeds',
]);

function matchesArea(text: string, areaKey: string, displayArea: string) {
  const t = text.toLowerCase();
  const keySpaced = areaKey.replace(/_/g, ' ');
  const city = displayArea.toLowerCase().split(' — ')[0].trim();
  return (
    t.includes(keySpaced) ||
    t.includes(displayArea.toLowerCase()) ||
    (city.length > 3 && t.includes(city))
  );
}

const Alerts = () => {
  const { logs, loading: logsLoading } = useAgentLog();
  const { area } = useUserStore();
  const displayArea = area || 'Surjani Town';
  const { signals, loading: signalsLoading } = useSignals(displayArea);
  const { alerts: areaAlerts, loading: areaAlertsLoading } = useAreaAlerts(displayArea);
  const { claims: truthClaims } = useTruthFeed(displayArea);
  const { situation, simulation, mapRoutes } = useCrisisSituation(displayArea);
  const { recommendation } = useRouteRecommendations(area);
  const [refreshing, setRefreshing] = useState(false);

  const areaKey = normalizeAreaKey(displayArea);
  const loading = logsLoading || signalsLoading || areaAlertsLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`${BACKEND_URL}/api/trigger`, { method: 'POST' });
    } catch {
      /* offline */
    }
    setTimeout(() => setRefreshing(false), 1500);
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { name: 'alert-decagram', color: COLORS.danger };
      case 'warning':
        return { name: 'alert', color: COLORS.warning };
      default:
        return { name: 'information-outline', color: COLORS.primary };
    }
  };

  const combinedAlerts = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    areaAlerts.forEach((a) => {
      const id = `area-${a.id}`;
      if (seen.has(id)) return;
      seen.add(id);
      list.push({
        id,
        agent: a.agent,
        action: a.action,
        severity: a.severity || 'info',
        detail: a.detail,
        timestamp: a.timestamp || Date.now(),
      });
    });

    truthClaims.slice(0, 8).forEach((c) => {
      const id = `truth-${c.id}`;
      if (seen.has(id)) return;
      seen.add(id);
      const detail =
        c.reasonUrdu ||
        c.reason_urdu ||
        c.reasonEnglish ||
        `${c.verdict}: ${c.text?.slice(0, 120)}`;
      list.push({
        id,
        agent: 'rumour_detector',
        action: c.verdict === 'false' ? 'rumour_debunked' : `claim_${c.verdict}`,
        severity: c.verdict === 'false' ? 'warning' : c.verdict === 'verified' ? 'critical' : 'info',
        detail,
        timestamp: c.timestamp || Date.now(),
      });
    });

    (signals || []).forEach((sig, idx) => {
      if (!SOCIAL_SOURCES.has(sig.source) && sig.source !== 'weather') return;
      const text = sig.text || '';
      if (!matchesArea(text, areaKey, displayArea) && sig.area !== areaKey) return;

      const id = `sig-${sig.source}-${idx}-${sig.timestamp}`;
      if (seen.has(id)) return;
      seen.add(id);

      const isCrisis =
        (sig.score || 0) >= 5 ||
        /\b(block|flood|shortage|strike|band|مہنگا|بند)\b/i.test(text);

      list.push({
        id,
        agent: `signal_scanner (${sig.source})`,
        action: isCrisis ? 'area_incident_detected' : 'area_feed_monitored',
        severity: isCrisis ? 'warning' : 'info',
        detail: text,
        timestamp: sig.timestamp || Date.now(),
      });
    });

    logs.forEach((log) => {
      let detailText = log.detail || '';
      try {
        const parsed = JSON.parse(log.detail);
        if (parsed.reasoning) detailText = parsed.reasoning;
      } catch {
        /* plain text */
      }

      const blob = `${detailText} ${log.agent} ${log.action}`.toLowerCase();
      const areaHit =
        blob.includes(areaKey.replace(/_/g, ' ')) ||
        blob.includes(displayArea.toLowerCase()) ||
        log.severity === 'critical';

      if (!areaHit) return;

      const id = `log-${log.id}`;
      if (seen.has(id)) return;
      seen.add(id);

      list.push({
        id,
        agent: log.agent || 'agent',
        action: log.action || 'update',
        severity: log.severity || 'info',
        detail: detailText,
        timestamp: log.timestamp || Date.now(),
      });
    });

    if (recommendation?.public_alert_urdu || recommendation?.public_alert_english) {
      list.unshift({
        id: 'route-rec',
        agent: 'supply_router',
        action: 'route_recommendation',
        severity: 'warning',
        detail:
          recommendation.public_alert_urdu ||
          recommendation.public_alert_english ||
          recommendation.recommended_route,
        timestamp: recommendation.updated || Date.now(),
      });
    }

    list.sort((a, b) => b.timestamp - a.timestamp);

    if (list.length === 0) {
      list.push({
        id: 'monitoring',
        agent: 'area_monitor',
        action: 'surveillance_active',
        severity: 'info',
        detail: `Agents are monitoring RSS, Reddit, weather, and routes for ${displayArea}. No incidents flagged in the latest scan.`,
        timestamp: Date.now(),
      });
    }

    return list.slice(0, 25);
  }, [logs, signals, areaAlerts, truthClaims, displayArea, areaKey, recommendation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ہنگامی الرٹس | Agent Alerts</Text>
        <Text style={styles.subtitle}>
          Scanned for <Text style={styles.areaHighlight}>{displayArea}</Text> only
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <CiroPanel
            situation={situation}
            simulation={simulation}
            mapRoutes={mapRoutes}
            areaLabel={displayArea}
          />

          <View style={styles.scannerBadge}>
            <View style={styles.badgeRow}>
              <Icon name="radar" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={styles.badgeText}>
                AI agents scanning social + news for {displayArea}
              </Text>
            </View>
            <Text style={styles.badgeSub}>
              {signals.length} live signals · pull to refresh agents
            </Text>
          </View>

          {combinedAlerts.map((log) => {
            const icon = getAlertIcon(log.severity);
            const dateStr = new Date(log.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View
                key={log.id}
                style={[
                  styles.card,
                  log.severity === 'critical' && styles.cardCritical,
                  log.severity === 'info' && styles.cardInfo,
                ]}
              >
                <View style={styles.cardHeader}>
                  <Icon name={icon.name} size={24} color={icon.color} style={{ marginRight: 8 }} />
                  <Text style={styles.agentType}>{log.agent.replace(/_/g, ' ')}</Text>
                  <Text style={styles.time}>{dateStr}</Text>
                </View>
                <Text style={styles.action}>{log.action.replace(/_/g, ' ').toUpperCase()}</Text>
                <Text style={styles.detail}>{log.detail}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  subtitle: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  areaHighlight: { color: COLORS.primary, fontWeight: 'bold' },
  scannerBadge: {
    backgroundColor: '#EBF5F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  badgeText: { color: '#0F5132', fontSize: 14, fontWeight: '600', flex: 1 },
  badgeSub: { color: '#146C43', fontSize: 12, marginLeft: 28 },
  scroll: { padding: 16 },
  loader: { marginTop: 40 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  cardCritical: { borderColor: COLORS.danger, borderLeftWidth: 4 },
  cardInfo: { borderColor: COLORS.primary, borderLeftWidth: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  agentType: { fontWeight: 'bold', fontSize: 14, color: '#374151', flex: 1 },
  time: { fontSize: 12, color: COLORS.gray },
  action: { fontSize: 15, fontWeight: 'bold', color: '#1F2937', marginBottom: 6 },
  detail: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
});

export default Alerts;
