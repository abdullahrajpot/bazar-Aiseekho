import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../lib/theme';

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
  const borderColor = v === 'gouging' ? THEME.gouging : v === 'high' ? THEME.warning : THEME.fair;
  const bg = v === 'gouging' ? THEME.errorContainer : THEME.surface;

  return (
    <View
      style={[
        styles.card,
        {
          borderLeftColor: borderColor,
          backgroundColor: bg,
          borderColor: v === 'gouging' ? THEME.gouging : v === 'high' ? THEME.warning : THEME.outline,
          borderWidth: v === 'fair' ? 0.5 : 2,
        },
      ]}
    >
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
    borderRadius: THEME.radiusCard,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#1A1F2E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 16, fontWeight: '700', color: THEME.onSurface },
  itemUrdu: { fontSize: 14, color: THEME.onSurfaceVariant, marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: 20, fontWeight: '800' },
  fairStrike: { fontSize: 12, color: THEME.onSurfaceVariant, textDecorationLine: 'line-through' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: THEME.outline,
  },
  shop: { fontSize: 12, color: THEME.onSurfaceVariant },
  tag: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  reported: { fontSize: 10, color: THEME.gouging, marginTop: 6 },
});
