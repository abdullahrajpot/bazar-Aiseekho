import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../lib/constants';

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
      ? { label: 'Sach — Verified', color: COLORS.verified, bg: '#F0FBF6' }
      : verdict === 'false'
        ? { label: 'Jhoot — False', color: COLORS.false, bg: '#FFF0F0' }
        : { label: 'Check ho raha hai…', color: COLORS.unverified, bg: '#FFFBF0' };

  return (
    <View style={[styles.card, { backgroundColor: details.bg, borderTopColor: details.color }]}>
      <View style={[styles.badge, { backgroundColor: details.color }]}>
        <Text style={styles.badgeText}>{details.label}</Text>
      </View>
      <Text style={styles.claimText}>{claimText}</Text>
      <Text style={styles.reasonText}>{reasonUrdu}</Text>
      <Text style={styles.confidence}>Confidence: {(confidence * 100).toFixed(0)}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: SPACING.sm,
  },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  claimText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  reasonText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'right' },
  confidence: { fontSize: 10, color: COLORS.textTertiary, marginTop: SPACING.sm, textAlign: 'right' },
});
