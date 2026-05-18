import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../store/userStore';
import { COLORS, AREAS } from '../lib/constants';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

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

  const pickArea = (label: string) => {
    if (!role) {
      Alert.alert('Role required', 'Sign in as khareedar, dukandar, or admin first.');
      return;
    }
    setRoleInfo(role, label);
    setPickerOpen(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Icon name="account" size={64} color={COLORS.white} />
          </View>
          <Text style={styles.username}>{role ? role.toUpperCase() : 'Guest User'}</Text>
          <Text style={styles.email}>{uid}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Profile Information</Text>

          <View style={styles.infoRow}>
            <Icon name="shield-account-outline" size={24} color={COLORS.primary} style={styles.rowIcon} />
            <View>
              <Text style={styles.infoLabel}>Assigned Role</Text>
              <Text style={styles.infoValue}>{role ? role.charAt(0).toUpperCase() + role.slice(1) : 'None'}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Icon name="map-marker-outline" size={24} color={COLORS.primary} style={styles.rowIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Your market (Pakistan)</Text>
              <Text style={styles.infoValue}>{area || 'Not selected — tap below'}</Text>
              <TouchableOpacity style={styles.areaBtn} onPress={() => setPickerOpen(!pickerOpen)}>
                <Icon name="map-search-outline" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
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
                Truth feed, fair prices, and gouging lists follow this area. Supply map stays on Karachi monitored
                highways (national corridor).
              </Text>
            </View>
          </View>

          {role === 'dukandar' && (
            <View style={styles.infoRow}>
              <Icon name="storefront-outline" size={24} color={COLORS.primary} style={styles.rowIcon} />
              <View>
                <Text style={styles.infoLabel}>Registered Shop ID</Text>
                <Text style={styles.infoValue}>{shopId || 'Pending'}</Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={24} color={COLORS.white} style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  email: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  rowIcon: {
    marginRight: 16,
    marginTop: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.gray,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 2,
  },
  areaBtn: {
    marginTop: 10,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  areaBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxWidth: '48%',
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white, fontWeight: '600' },
  areaHint: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 10,
    lineHeight: 16,
  },
  logoutButton: {
    backgroundColor: COLORS.danger,
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default Profile;
