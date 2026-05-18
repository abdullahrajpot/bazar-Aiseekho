import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../lib/constants';

interface PriceCardProps {
  itemName: string;
  itemNameUrdu: string;
  price: number;
  fairPrice: number;
  shopName: string;
  distance: string;
  verdict: 'fair' | 'high' | 'gouging' | null;
}

export const PriceCard: React.FC<PriceCardProps> = ({
  itemName,
  itemNameUrdu,
  price,
  fairPrice,
  shopName,
  distance,
  verdict,
}) => {
  const v = verdict || 'fair';
  const borderColor =
    v === 'gouging' ? COLORS.gouging : v === 'high' ? COLORS.high : COLORS.fair;
  const bg = v === 'gouging' ? '#FFF5F5' : COLORS.surface;

  return (
    <View style={[styles.card, { borderLeftColor: borderColor, backgroundColor: bg }]}>
      <View style={styles.row}>
        <View>
          <Text style={styles.itemName}>{itemName}</Text>
          <Text style={styles.itemUrdu}>{itemNameUrdu}</Text>
        </View>
        <View style={styles.priceCol}>
          <Text style={[styles.price, { color: borderColor }]}>Rs {price}</Text>
          {v !== 'fair' && fairPrice > 0 ? (
            <Text style={styles.fairStrike}>Fair: Rs {fairPrice}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.shop}>{shopName} {distance !== '—' ? `· ${distance}` : ''}</Text>
        <Text style={[styles.tag, { color: borderColor }]}>{v.toUpperCase()}</Text>
      </View>
      {v === 'gouging' ? <Text style={styles.reported}>Reported to system</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  itemUrdu: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: 18, fontWeight: '800' },
  fairStrike: { fontSize: 12, color: COLORS.textTertiary, textDecorationLine: 'line-through' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  shop: { fontSize: 12, color: COLORS.textSecondary },
  tag: { fontSize: 11, fontWeight: '700' },
  reported: { fontSize: 10, color: COLORS.gouging, marginTop: 6 },
});
