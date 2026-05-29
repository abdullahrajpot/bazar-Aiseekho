import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../../lib/theme';

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 32, alignItems: 'center' },
  text: { fontSize: 14, color: THEME.onSurfaceVariant, textAlign: 'center', lineHeight: 22 },
});
