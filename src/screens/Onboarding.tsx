import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, set } from 'firebase/database';
import { db } from '../lib/firebase';
import { useUserStore } from '../store/userStore';
import { COLORS, AREAS } from '../lib/constants';

const Onboarding = ({ navigation }: any) => {
  const { uid, setRoleInfo } = useUserStore();
  const [role, setRole] = useState<'khareedar' | 'dukandar' | 'admin' | null>(null);
  const [area, setArea] = useState(AREAS[0]);
  const [shopName, setShopName] = useState('');

  const handleComplete = async () => {
    if (!role) {
      Alert.alert('Error', 'Please select a role');
      return;
    }
    if (role === 'dukandar' && !shopName) {
      Alert.alert('Error', 'Please enter your shop name');
      return;
    }

    try {
      let shopId = null;

      // If Dukandar, create a shop record
      if (role === 'dukandar') {
        shopId = `shop_${uid}_${Date.now()}`;
        await set(ref(db, `shops/${shopId}`), {
          name: shopName,
          area: area.toLowerCase().replace(' ', '_'),
          ownerUid: uid,
          reputation: 'fair',
          warningCount: 0,
          registeredAt: Date.now(),
        });
      }

      // Update user record
      const areaFormatted = area.toLowerCase().replace(' ', '_');
      await set(ref(db, `users/${uid}`), {
        role,
        area: areaFormatted,
        shopId: shopId || null,
        registeredAt: Date.now(),
      });

      setRoleInfo(role, areaFormatted, shopId || undefined);

      // Navigate to the main app layout
      navigation.replace('MainTabs');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Welcome to Bazar</Text>
        <Text style={styles.subtitle}>Who are you?</Text>

        <TouchableOpacity
          style={[styles.card, role === 'khareedar' && styles.cardSelected]}
          onPress={() => setRole('khareedar')}
        >
          <Text style={styles.cardTitle}>Khareedar (Consumer)</Text>
          <Text style={styles.cardDesc}>I want to check prices and verify rumours</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, role === 'dukandar' && styles.cardSelected]}
          onPress={() => setRole('dukandar')}
        >
          <Text style={styles.cardTitle}>Dukandar (Shopkeeper)</Text>
          <Text style={styles.cardDesc}>I want to get supply alerts and set fair prices</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, role === 'admin' && styles.cardSelected]}
          onPress={() => setRole('admin')}
        >
          <Text style={styles.cardTitle}>Admin / NDMA</Text>
          <Text style={styles.cardDesc}>I am a system coordinator</Text>
        </TouchableOpacity>

        {role && (
          <View style={styles.detailsSection}>
            <Text style={styles.label}>Select your area:</Text>
            <View style={styles.areaGrid}>
              {AREAS.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.areaChip, area === a && styles.areaChipSelected]}
                  onPress={() => setArea(a)}
                >
                  <Text style={[styles.areaText, area === a && styles.areaTextSelected]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {role === 'dukandar' && (
              <>
                <Text style={[styles.label, { marginTop: 20 }]}>Shop Name:</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Al-Noor Kiryana"
                  value={shopName}
                  onChangeText={setShopName}
                />
              </>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleComplete}>
              <Text style={styles.submitBtnText}>Continue to App</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.primary, marginBottom: 8 },
  subtitle: { fontSize: 18, color: COLORS.gray, marginBottom: 24 },
  card: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 2,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDF4',
  },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  cardDesc: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  detailsSection: { marginTop: 24 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#374151' },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  areaChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.white, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.lightGray,
  },
  areaChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  areaText: { color: COLORS.gray },
  areaTextSelected: { color: COLORS.white, fontWeight: 'bold' },
  input: {
    backgroundColor: COLORS.white, padding: 16,
    borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray,
    color: '#000000',
  },
  submitBtn: {
    backgroundColor: COLORS.primary, padding: 16,
    borderRadius: 8, alignItems: 'center', marginTop: 32,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
});

export default Onboarding;
