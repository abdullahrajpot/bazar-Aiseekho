import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { apiPost } from '../lib/api';
import { useUserStore } from '../store/userStore';
import { useSupplyStatus } from '../hooks/useSupplyStatus';
import { useCrisisSituation } from '../hooks/useCrisisSituation';
import { useAffectedZones } from '../hooks/useAffectedZones';
import { useCrisisEvents } from '../hooks/useCrisisEvents';
import { useMapIncidents } from '../hooks/useMapIncidents';
import { CrisisIntelMap } from '../components/map/CrisisIntelMap';
import { AgentMapOverlay } from '../components/map/AgentMapOverlay';
import { IncidentDetailSheet } from '../components/map/IncidentDetailSheet';
import { TimeRange } from '../lib/crisisSeverity';
import { AREAS } from '../lib/constants';
import { ref, update } from 'firebase/database';
import { db } from '../lib/firebase';

/** Dark crisis command map — autonomous CIRO agents, all crisis types */
const CrisisMapScreen = () => {
  const { area, uid, role, setRoleInfo } = useUserStore();
  const displayArea = area || 'Surjani Town';
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [selectedCrisisId, setSelectedCrisisId] = useState<string | null>(null);
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);

  const { routes } = useSupplyStatus();
  const { mapRoutes } = useCrisisSituation(displayArea);
  const { zones } = useAffectedZones(displayArea);
  const { crises: areaCrises } = useCrisisEvents(displayArea, timeRange);
  const { crises: globalCrises } = useCrisisEvents(null, timeRange);
  const incidents = useMapIncidents(displayArea);

  const crises = useMemo(() => {
    const byId = new Map<string, (typeof areaCrises)[0]>();
    [...globalCrises, ...areaCrises].forEach((c) => byId.set(c.id, c));
    return Array.from(byId.values()).sort((a, b) => (b.detectedAt || 0) - (a.detectedAt || 0));
  }, [areaCrises, globalCrises]);

  const selectedCrisis = crises.find((c) => c.id === selectedCrisisId) || null;

  const onRefresh = async () => {
    try {
      await apiPost('/api/trigger', {});
    } catch {
      /* map still works from Firebase */
    }
    if (crises.length > 0 && !selectedCrisisId) {
      setSelectedCrisisId(crises[0].id);
    }
  };

  const pickArea = async (label: string) => {
    if (role) setRoleInfo(role, label);
    setAreaPickerOpen(false);
    setSelectedCrisisId(null);
    if (uid) {
      try {
        await update(ref(db, `users/${uid}`), { area: label });
      } catch {
        /* non-critical */
      }
    }
  };

  const verifiedCount = crises.filter((c) => (c.confidence || 0) >= 0.55).length;

  useEffect(() => {
    if (crises.length > 0 && !selectedCrisisId) {
      setSelectedCrisisId(crises[0].id);
    }
  }, [crises.length, selectedCrisisId]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0e1626" />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* ── Full-screen map ── */}
        <CrisisIntelMap
          selectedArea={displayArea}
          crises={crises}
          selectedCrisisId={selectedCrisisId}
          onSelectCrisis={setSelectedCrisisId}
          mapRoutes={mapRoutes}
          routes={routes}
          affectedZones={zones}
          incidents={incidents}
        />

        {/* ── Agent header + time filter + legend ── */}
        <AgentMapOverlay
          agentLabel={`${verifiedCount}/${Math.max(crises.length, 1)} Crisis Verifier Agent`}
          agentSub={`Cross-checking news, weather, NDMA & maps · ${displayArea}`}
          timeRange={timeRange}
          onTimeRange={setTimeRange}
          incidentCount={crises.length}
          onRefresh={onRefresh}
          onMenuPress={() => setAreaPickerOpen(true)}
        />

        {/* ── Area selector button (bottom-left, above the incident sheet) ── */}
        {!selectedCrisis && (
          <TouchableOpacity
            style={styles.areaBtn}
            onPress={() => setAreaPickerOpen(true)}
            activeOpacity={0.85}
          >
            <Icon name="map-marker" size={16} color="#A5F3CA" />
            <Text style={styles.areaBtnText} numberOfLines={1}>
              {displayArea}
            </Text>
            <Icon name="chevron-up" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}

        {/* ── Incident detail bottom sheet ── */}
        <IncidentDetailSheet
          incident={selectedCrisis}
          onClose={() => setSelectedCrisisId(null)}
        />

        {/* ── Area picker modal ── */}
        <Modal
          visible={areaPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setAreaPickerOpen(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setAreaPickerOpen(false)}
          />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHead}>
              <Icon name="map-search" size={20} color="#A5F3CA" />
              <Text style={styles.pickerTitle}>Select your area</Text>
              <TouchableOpacity onPress={() => setAreaPickerOpen(false)}>
                <Icon name="close" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.pickerSub}>
              Map, routes and CIRO alerts update for the selected city
            </Text>
            <ScrollView
              style={styles.pickerScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.pickerGrid}
            >
              {AREAS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.areaChip, displayArea === a && styles.areaChipActive]}
                  onPress={() => pickArea(a)}
                >
                  <Text
                    style={[styles.areaChipText, displayArea === a && styles.areaChipTextActive]}
                    numberOfLines={2}
                  >
                    {a}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e1626' },
  container: { flex: 1 },

  // Area selector button
  areaBtn: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(22, 27, 42, 0.92)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(165, 243, 202, 0.3)',
    maxWidth: 200,
    zIndex: 15,
  },
  areaBtnText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  // Modal backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // Area picker sheet
  pickerSheet: {
    backgroundColor: '#161B2A',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 10,
    maxHeight: '72%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#4B5563',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  pickerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pickerTitle: {
    flex: 1,
    color: '#F3F4F6',
    fontSize: 17,
    fontWeight: '700',
  },
  pickerSub: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 14,
  },
  pickerScroll: { flexGrow: 0 },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  areaChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxWidth: '48%',
  },
  areaChipActive: {
    backgroundColor: '#1D6E4E',
    borderColor: '#A5F3CA',
  },
  areaChipText: { color: '#D1D5DB', fontSize: 12, fontWeight: '500' },
  areaChipTextActive: { color: '#fff', fontWeight: '700' },
});

export default CrisisMapScreen;
