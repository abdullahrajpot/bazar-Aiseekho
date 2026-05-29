import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { THEME } from '../../lib/theme';
import { humanizeRouteStatus } from '../../lib/humanizeAgentLog';

export interface RouteOption {
  id: string;
  name: string;
  status: string;
  isRecommended?: boolean;
  isAlternate?: boolean;
  extraMinutes?: number;
}

interface Props {
  routes: RouteOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  areaLabel: string;
  crisisActive?: boolean;
}

/** Uber/Careem-style route picker below the map */
export const RouteBottomSheet: React.FC<Props> = ({
  routes,
  selectedId,
  onSelect,
  areaLabel,
  crisisActive,
}) => {
  const recommended = routes.find((r) => r.isRecommended) || routes.find((r) => r.status === 'clear');

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{crisisActive ? 'Crisis routes' : 'Recommended route'}</Text>
          <Text style={styles.sub}>{areaLabel} · swipe routes below</Text>
        </View>
        <Icon name="map-marker-path" size={28} color={THEME.primary} />
      </View>

      {recommended ? (
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>BEST ROUTE NOW</Text>
          <Text style={styles.heroName}>{recommended.name}</Text>
          <Text style={styles.heroDesc}>
            {humanizeRouteStatus(recommended.status, recommended.name, recommended.extraMinutes)}
          </Text>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
        {routes.map((r) => {
          const selected = r.id === selectedId;
          const blocked = r.status === 'blocked' || r.status === 'disrupted';
          const alt = r.isAlternate || r.status === 'rerouted';
          const color = blocked ? THEME.gouging : alt ? '#3B82F6' : THEME.fair;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.chip, selected && styles.chipSelected, { borderColor: color }]}
              onPress={() => onSelect(r.id)}
            >
              <View style={[styles.chipBar, { backgroundColor: color }]} />
              <Text style={styles.chipName} numberOfLines={2}>
                {r.name}
              </Text>
              <Text style={[styles.chipStatus, { color }]}>
                {blocked ? 'Avoid' : alt ? 'Alternate' : 'Clear'}
              </Text>
              {r.extraMinutes ? (
                <Text style={styles.chipEta}>+{r.extraMinutes} min</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.legendRow}>
        <Legend color={THEME.fair} label="Clear — use this" />
        <Legend color="#3B82F6" label="Alternate" />
        <Legend color={THEME.gouging} label="Blocked" />
      </View>
    </View>
  );
};

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: THEME.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderColor: THEME.outline,
    maxHeight: 280,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.outline,
    alignSelf: 'center',
    marginBottom: 10,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 17, fontWeight: '700', color: THEME.onSurface },
  sub: { fontSize: 12, color: THEME.onSurfaceVariant, marginTop: 2 },
  heroCard: {
    backgroundColor: THEME.surfaceContainer,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: THEME.primary,
  },
  heroLabel: { fontSize: 10, fontWeight: '700', color: THEME.primary, letterSpacing: 0.5 },
  heroName: { fontSize: 16, fontWeight: '700', color: THEME.onSurface, marginTop: 4 },
  heroDesc: { fontSize: 13, color: THEME.onSurfaceVariant, marginTop: 4, lineHeight: 18 },
  strip: { marginBottom: 10 },
  chip: {
    width: 140,
    marginRight: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: THEME.surfaceDim,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  chipSelected: { backgroundColor: THEME.surface, borderWidth: 2 },
  chipBar: { height: 4, borderRadius: 2, marginBottom: 8 },
  chipName: { fontSize: 13, fontWeight: '600', color: THEME.onSurface },
  chipStatus: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  chipEta: { fontSize: 10, color: THEME.onSurfaceVariant, marginTop: 2 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: THEME.onSurfaceVariant },
});
