import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../store/userStore';
import { AREAS } from '../lib/constants';
import { THEME } from '../lib/theme';
import { DesignHeader } from '../components/ui/DesignHeader';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { ref, update } from 'firebase/database';

const Profile = () => {
  const { uid, role, area, shopId, logout, setRoleInfo } = useUserStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              logout();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const pickArea = async (label: string) => {
    if (!role) {
      Alert.alert('Role required', 'Sign in as citizen or admin first.');
      return;
    }
    setRoleInfo(role, label);
    setPickerOpen(false);

    if (uid) {
      try {
        await update(ref(db, `users/${uid}`), { area: label });
      } catch (err: any) {
        console.warn('Could not update area in Firebase:', err.message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <DesignHeader title="Profile" showLive={false} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Icon name="account" size={64} color={THEME.onPrimary} />
          </View>
          <Text style={styles.username}>
            {role === 'khareedar' ? 'Citizen' : role === 'admin' ? 'Admin' : 'Guest'}
          </Text>
          <Text style={styles.email}>{uid}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Profile Information</Text>

          <View style={styles.infoRow}>
            <Icon name="shield-account-outline" size={24} color={THEME.primary} style={styles.rowIcon} />
            <View>
              <Text style={styles.infoLabel}>Assigned Role</Text>
              <Text style={styles.infoValue}>{role ? role.charAt(0).toUpperCase() + role.slice(1) : 'None'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Icon name="map-marker-outline" size={24} color={THEME.tertiary} style={styles.rowIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Your market (Pakistan)</Text>
              <Text style={styles.infoValue}>{area || 'Not selected — tap below'}</Text>
              <TouchableOpacity style={styles.areaBtn} onPress={() => setPickerOpen(!pickerOpen)}>
                <Icon name="map-search-outline" size={18} color={THEME.onPrimary} style={{ marginRight: 8 }} />
                <Text style={styles.areaBtnText}>{pickerOpen ? 'Hide cities' : 'Choose city / area'}</Text>
              </TouchableOpacity>
              {pickerOpen ? (
                <View style={styles.chipWrap}>
                  {AREAS.map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[styles.chip, area === a && styles.chipActive]}
                      onPress={() => pickArea(a)}
                    >
                      <Text style={[styles.chipText, area === a && styles.chipTextActive]} numberOfLines={2}>
                        {a}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <Text style={styles.areaHint}>
                CIRO map, crisis alerts, routes, and agent-managed prices update for this area after you change it.
              </Text>
            </View>
          </View>

        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={24} color={THEME.onPrimary} style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: THEME.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  username: { fontSize: 22, fontWeight: '700', color: THEME.onSurface },
  email: { fontSize: 12, color: THEME.onSurfaceVariant, marginTop: 4 },
  infoCard: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radiusCard,
    padding: 20,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: THEME.onSurface, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  rowIcon: { marginRight: 14, marginTop: 2 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: THEME.onSurfaceVariant, letterSpacing: 0.3 },
  infoValue: { fontSize: 16, fontWeight: '600', color: THEME.onSurface, marginTop: 2 },
  areaBtn: {
    marginTop: 10,
    backgroundColor: THEME.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: THEME.radiusBtn,
  },
  areaBtnText: { color: THEME.onPrimary, fontWeight: '700', fontSize: 14 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: THEME.radiusBtn,
    backgroundColor: THEME.surfaceDim,
    borderWidth: 0.5,
    borderColor: THEME.outline,
    maxWidth: '48%',
  },
  chipActive: { backgroundColor: THEME.primary, borderColor: THEME.primary },
  chipText: { fontSize: 12, color: THEME.onSurfaceVariant },
  chipTextActive: { color: THEME.onPrimary, fontWeight: '600' },
  areaHint: { fontSize: 11, color: THEME.onSurfaceVariant, marginTop: 10, lineHeight: 16 },
  logoutButton: {
    backgroundColor: THEME.error,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: { marginRight: 8 },
  logoutText: { color: THEME.onPrimary, fontSize: 16, fontWeight: '600' },
});

export default Profile;
