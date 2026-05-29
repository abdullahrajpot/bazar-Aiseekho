import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../lib/theme';

interface TruthCardProps {
  claimText: string;
  verdict: 'verified' | 'unverified' | 'false';
  reasonUrdu: string;
  confidence: number;
}

export const TruthCard: React.FC<TruthCardProps> = ({
  claimText,
  verdict,
  reasonUrdu,
  confidence,
}) => {
  const details =
    verdict === 'verified'
      ? { label: 'VERIFIED', color: THEME.fair, bg: '#E1F5EE', strip: THEME.agentTruth }
      : verdict === 'false'
        ? { label: 'FALSE RUMOUR', color: THEME.gouging, bg: THEME.errorContainer, strip: THEME.gouging }
        : { label: 'UNVERIFIED', color: THEME.warning, bg: '#FAEEDA', strip: THEME.warning };

  return (
    <View style={[styles.card, { backgroundColor: details.bg, borderLeftColor: details.strip }]}>
      <View style={[styles.badge, { backgroundColor: `${details.color}22` }]}>
        <Text style={[styles.badgeText, { color: details.color }]}>{details.label}</Text>
      </View>
      <Text style={styles.claimText}>{claimText}</Text>
      <Text style={styles.reasonText}>{reasonUrdu}</Text>
      <Text style={styles.confidence}>Confidence: {(confidence * 100).toFixed(0)}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: THEME.radiusCard,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 8,
  },
  badgeText: { color: THEME.onPrimary, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  claimText: { fontSize: 15, fontWeight: '600', color: THEME.onSurface, marginBottom: 8 },
  reasonText: { fontSize: 14, color: THEME.onSurfaceVariant, textAlign: 'right', lineHeight: 22 },
  confidence: { fontSize: 10, color: THEME.onSurfaceVariant, marginTop: 8, textAlign: 'right' },
});
