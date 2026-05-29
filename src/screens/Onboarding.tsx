import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, set } from 'firebase/database';
import { db } from '../lib/firebase';
import { useUserStore } from '../store/userStore';
import { AREAS } from '../lib/constants';
import { THEME } from '../lib/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Onboarding = ({ navigation }: any) => {
  const { uid, setRoleInfo } = useUserStore();
  const [role, setRole] = useState<'khareedar' | 'admin' | null>(null);
  const [area, setArea] = useState(AREAS[0]);

  const handleComplete = async () => {
    if (!role) {
      Alert.alert('Select role', 'Choose Citizen or Admin');
      return;
    }
    try {
      await set(ref(db, `users/${uid}`), {
        role,
        area,
        registeredAt: Date.now(),
      });
      setRoleInfo(role, area);
      navigation.replace('MainTabs');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Icon name="radar" size={40} color={THEME.primary} />
          <Text style={styles.title}>Bazar + CIRO</Text>
          <Text style={styles.subtitle}>Crisis intelligence for your city</Text>
        </View>

        <TouchableOpacity
          style={[styles.card, role === 'khareedar' && styles.cardSelected]}
          onPress={() => setRole('khareedar')}
        >
          <Icon name="account" size={28} color={THEME.primary} />
          <Text style={styles.cardTitle}>Citizen</Text>
          <Text style={styles.cardDesc}>Crisis map, alerts, report incidents, market truth</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, role === 'admin' && styles.cardSelected]}
          onPress={() => setRole('admin')}
        >
          <Icon name="shield-account" size={28} color={THEME.tertiary} />
          <Text style={styles.cardTitle}>Admin / Command</Text>
          <Text style={styles.cardDesc}>Crisis command centre, simulation, overrides</Text>
        </TouchableOpacity>

        {role && (
          <>
            <Text style={styles.label}>Your area (for local alerts)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {AREAS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.areaChip, area === a && styles.areaChipActive]}
                  onPress={() => setArea(a)}
                >
                  <Text style={[styles.areaChipText, area === a && styles.areaChipTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <TouchableOpacity style={styles.button} onPress={handleComplete}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scroll: { padding: 24 },
  hero: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontWeight: '700', color: THEME.primary, marginTop: 12 },
  subtitle: { fontSize: 14, color: THEME.onSurfaceVariant, marginTop: 4 },
  card: {
    backgroundColor: THEME.surface,
    padding: 20,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: THEME.outline,
    alignItems: 'center',
  },
  cardSelected: { borderColor: THEME.primary, borderWidth: 2, backgroundColor: THEME.surfaceDim },
  cardTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  cardDesc: { fontSize: 13, color: THEME.onSurfaceVariant, textAlign: 'center', marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  areaChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: THEME.outline,
    marginRight: 8,
    backgroundColor: THEME.surface,
  },
  areaChipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  areaChipText: { fontSize: 13, color: THEME.onSurface },
  areaChipTextActive: { color: THEME.onPrimary },
  button: {
    backgroundColor: THEME.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: THEME.onPrimary, fontWeight: '700', fontSize: 16 },
});

export default Onboarding;
