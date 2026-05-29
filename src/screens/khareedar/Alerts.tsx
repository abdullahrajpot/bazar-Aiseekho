import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../../lib/theme';
import { BACKEND_URL } from '../../lib/constants';
import { useAgentLog } from '../../hooks/useAgentLog';
import { useActionLog } from '../../hooks/useActionLog';
import { DesignHeader } from '../../components/ui/DesignHeader';
import { IntelligenceCard } from '../../components/ui/IntelligenceCard';
import { humanizeAgentMessage } from '../../lib/humanizeAgentLog';
import { useUserStore } from '../../store/userStore';
import { useSignals } from '../../hooks/useSignals';
import { useAreaAlerts } from '../../hooks/useAreaAlerts';
import { useTruthFeed } from '../../hooks/useTruthFeed';
import { useCrisisSituation } from '../../hooks/useCrisisSituation';
import { CiroPanel } from '../../components/ciro/CiroPanel';
import { useRouteRecommendations } from '../../hooks/useRouteRecommendations';
import { normalizeAreaKey } from '../../lib/area';
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
  const { entries: ciroLogs } = useActionLog();
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
        return { name: 'alert-decagram', color: THEME.error };
      case 'warning':
        return { name: 'alert', color: THEME.warning };
      default:
        return { name: 'information-outline', color: THEME.primary };
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

    ciroLogs.slice(0, 15).forEach((e) => {
      const id = `ciro-${e.id}`;
      if (seen.has(id)) return;
      seen.add(id);
      list.push({
        id,
        agent: e.agent || 'ciro',
        action: e.action || 'update',
        severity: e.severity === 'critical' ? 'critical' : 'info',
        detail: e.detail || '',
        timestamp: e.timestamp || Date.now(),
      });
    });

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
  }, [logs, signals, areaAlerts, truthClaims, ciroLogs, displayArea, areaKey, recommendation]);

  const agentStrip = (agent: string): 'ciro' | 'supply' | 'truth' | 'default' => {
    if (agent.includes('ciro') || agent.includes('crisis') || agent.includes('emergency')) return 'ciro';
    if (agent.includes('supply') || agent.includes('router')) return 'supply';
    if (agent.includes('rumour') || agent.includes('truth')) return 'truth';
    return 'default';
  };

  return (
    <SafeAreaView style={styles.container}>
      <DesignHeader
        title="Crisis alerts"
        subtitle={`Live intelligence for ${displayArea}`}
        showLive
        onRefresh={onRefresh}
      />

      {loading ? (
        <ActivityIndicator size="large" color={THEME.primary} style={styles.loader} />
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

          <Text style={styles.sectionLabel}>INTELLIGENCE FEED · {signals.length} signals</Text>

          {combinedAlerts.map((log) => {
            const icon = getAlertIcon(log.severity);
            const plain = humanizeAgentMessage(log.agent, log.action, log.detail);
            return (
              <IntelligenceCard
                key={log.id}
                agent={agentStrip(log.agent)}
                severity={
                  log.severity === 'critical'
                    ? 'critical'
                    : log.severity === 'warning'
                      ? 'warning'
                      : 'info'
                }
                title={plain.title}
                detail={plain.detail}
                timestamp={log.timestamp}
                meta={plain.meta}
                icon={icon.name}
              />
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scroll: { padding: 16, paddingBottom: 32 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: THEME.onSurfaceVariant,
    marginBottom: 12,
  },
  loader: { marginTop: 40 },
});

export default Alerts;
