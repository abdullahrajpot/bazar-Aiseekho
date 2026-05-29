import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { CrisisEvent } from '../../hooks/useCrisisEvents';
import { crisisTypeLabel, minutesSince, severityColors } from '../../lib/crisisSeverity';

interface Props {
  incident: CrisisEvent | null;
  onClose: () => void;
}

export const IncidentDetailSheet: React.FC<Props> = ({ incident, onClose }) => {
  if (!incident) return null;
  const sev = severityColors(incident.severity);
  const radiusKm = incident.severity === 'critical' ? 3.5 : incident.severity === 'high' ? 2.5 : 1.5;

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.head}>
        <View style={[styles.sevDot, { backgroundColor: sev.pin }]} />
        <Text style={styles.title} numberOfLines={1}>
          {crisisTypeLabel(incident.type)} — {incident.location}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Icon name="close" size={22} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.timer}>{minutesSince(incident.detectedAt)}</Text>
      <Text style={styles.impact}>
        Affected area · Radius ~{radiusKm} km · Confidence{' '}
        {Math.round((incident.confidence || 0.7) * 100)}%
      </Text>

      <View style={styles.tags}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{Math.round((incident.confidence || 0) * 100)}%</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{sev.label}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>CIRO_AGENT</Text>
        </View>
      </View>

      {incident.confidenceReason ? (
        <Text style={styles.reason} numberOfLines={3}>
          {incident.confidenceReason}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn}>
          <Icon name="information-outline" size={18} color="#A5F3CA" />
          <Text style={styles.actionText}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Icon name="map-marker-path" size={18} color="#A5F3CA" />
          <Text style={styles.actionText}>Trace route</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Icon name="history" size={18} color="#A5F3CA" />
          <Text style={styles.actionText}>Baseline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(22, 27, 42, 0.96)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#4B5563',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sevDot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
  timer: { color: '#9CA3AF', fontSize: 12, marginTop: 8 },
  impact: { color: '#D1D5DB', fontSize: 13, marginTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: { color: '#E5E7EB', fontSize: 11, fontWeight: '600' },
  reason: { color: '#9CA3AF', fontSize: 12, marginTop: 10, lineHeight: 18 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionText: { color: '#A5F3CA', fontSize: 11, fontWeight: '600' },
});
