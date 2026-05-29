import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { THEME } from '../../lib/theme';

interface DesignHeaderProps {
  title?: string;
  subtitle?: string;
  showLive?: boolean;
  onRefresh?: () => void;
  onBack?: () => void;
  right?: React.ReactNode;
  style?: ViewStyle;
}

/** Top bar — DOC/stitch design: Bazar + CIRO + optional LIVE badge */
export const DesignHeader: React.FC<DesignHeaderProps> = ({
  title = 'Bazar + CIRO',
  subtitle,
  showLive = true,
  onRefresh,
  onBack,
  right,
  style,
}) => (
  <View style={[styles.wrap, style]}>
    <View style={styles.row}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Icon name="arrow-left" size={24} color={THEME.primary} />
        </TouchableOpacity>
      ) : (
        <Icon name="radar" size={22} color={THEME.primary} />
      )}
      <Text style={styles.title}>{title}</Text>
      {showLive ? (
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      ) : null}
      <View style={styles.right}>
        {onRefresh ? (
          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            <Icon name="refresh" size={22} color={THEME.onSurfaceVariant} />
          </TouchableOpacity>
        ) : null}
        {right}
      </View>
    </View>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: THEME.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: THEME.outline,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: THEME.primary, flex: 1 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.errorContainer,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.error, marginRight: 4 },
  liveText: { fontSize: 9, fontWeight: '700', color: THEME.error, letterSpacing: 0.5 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 4 },
  subtitle: { fontSize: 13, color: THEME.onSurfaceVariant, marginTop: 6 },
});
