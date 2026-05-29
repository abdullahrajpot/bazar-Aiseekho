import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GOODS } from '../../lib/constants';
import { THEME } from '../../lib/theme';
import { submitIncidentReport, submitRumourClaim } from '../../lib/reportIncident';
import { DesignHeader } from '../../components/ui/DesignHeader';
import { normalizeAreaKey } from '../../lib/area';
import { useUserStore } from '../../store/userStore';
import { ref, push, set } from 'firebase/database';
import { db } from '../../lib/firebase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Report = () => {
  const { area, uid } = useUserStore();
  const [mode, setMode] = useState<'incident' | 'claim'>('incident');
  const [incidentText, setIncidentText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [selectedGood, setSelectedGood] = useState(GOODS[0].id);
  const [shopName, setShopName] = useState('');
  const [price, setPrice] = useState('');
  const [claimText, setClaimText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!shopName || !price) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Error', 'Please enter a valid price.');
      return;
    }

    setLoading(true);
    try {
      const reportsRef = ref(db, 'price_submissions');
      const newReportRef = push(reportsRef);

      await set(newReportRef, {
        itemId: selectedGood,
        area: normalizeAreaKey(area || 'Surjani Town'),
        price: priceNum,
        shopName,
        shopId: `shop_${uid}`,
        submittedBy: 'khareedar',
        submitterUid: uid,
        timestamp: Date.now(),
      });

      Alert.alert('Success', 'Price submitted. AI agent will assess within seconds.');
      setShopName('');
      setPrice('');
    } catch (e: any) {
      Alert.alert('Submission Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const pickIncidentPhoto = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.7,
    });
    if (result.assets?.[0]) {
      setImageUri(result.assets[0].uri || null);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  const handleIncidentSubmit = async () => {
    if (!incidentText.trim() && !imageBase64) {
      Alert.alert('Error', 'Describe the incident or upload a photo.');
      return;
    }
    setLoading(true);
    try {
      const data = await submitIncidentReport({
        text: incidentText,
        area: area || 'Surjani Town',
        uid,
        imageBase64,
      });
      if (data.crisisDetected) {
        Alert.alert(
          data.viaFirebase ? 'Report saved' : 'CIRO response',
          data.viaFirebase
            ? `${data.message}\n\nOpen Map tab to see your pin.`
            : `${data.type} at ${data.location}\nRescue 1122 notified · ${Math.round((data.confidence || 0) * 100)}%`
        );
      } else {
        Alert.alert('Report received', data.message || 'Agents are monitoring.');
      }
      setIncidentText('');
      setImageUri(null);
      setImageBase64(null);
    } catch (e: any) {
      Alert.alert('Could not save report', e.message || 'Check internet & Firebase.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSubmit = async () => {
    if (!claimText.trim()) {
      Alert.alert('Error', 'Enter what you heard.');
      return;
    }
    setLoading(true);
    try {
      const data = await submitRumourClaim(claimText, area || 'Surjani Town');
      Alert.alert('Truth check', `Verdict: ${data.verdict || 'pending'}`);
      setClaimText('');
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Check internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <DesignHeader
        title="Report to CIRO"
        subtitle="Photo → agents → Rescue 1122 / Police"
        showLive
      />
      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'incident' && styles.modeBtnActive]}
            onPress={() => setMode('incident')}
          >
            <Text style={[styles.modeText, mode === 'incident' && styles.modeTextActive]}>Incident + Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'claim' && styles.modeBtnActive]}
            onPress={() => setMode('claim')}
          >
            <Text style={[styles.modeText, mode === 'claim' && styles.modeTextActive]}>Rumour</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {mode === 'incident' ? (
            <>
              <Text style={styles.label}>Report accident / flood / blockage</Text>
              <Text style={styles.hint}>
                CIRO agents analyse photo (Groq Vision), notify Rescue 1122, Police (15), and update the map.
              </Text>
              <TextInput
                style={[styles.input, styles.claimInput]}
                placeholder="e.g. M9 par accident, 2 gaariyan..."
                placeholderTextColor={THEME.outlineVariant}
                value={incidentText}
                onChangeText={setIncidentText}
                multiline
              />
              <TouchableOpacity style={styles.photoBtn} onPress={pickIncidentPhoto}>
                <Icon name="camera" size={20} color={THEME.primary} />
                <Text style={styles.photoBtnText}>
                  {imageUri ? 'Change photo' : 'Upload incident photo'}
                </Text>
              </TouchableOpacity>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
              ) : null}
              {loading ? (
                <ActivityIndicator size="large" color={THEME.primary} style={styles.loader} />
              ) : (
                <TouchableOpacity style={styles.button} onPress={handleIncidentSubmit}>
                  <Icon name="alert-octagon" size={20} color={THEME.onPrimary} style={{ marginRight: 8 }} />
                  <Text style={styles.buttonText}>Send to CIRO + 1122</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <Text style={styles.label}>Aapne kya suna?</Text>
              <TextInput
                style={[styles.input, styles.claimInput]}
                placeholder="Urdu ya English mein likhein"
                placeholderTextColor={THEME.outlineVariant}
                value={claimText}
                onChangeText={setClaimText}
                multiline
              />
              {loading ? (
                <ActivityIndicator size="large" color={THEME.primary} style={styles.loader} />
              ) : (
                <TouchableOpacity style={styles.button} onPress={handleClaimSubmit}>
                  <Text style={styles.buttonText}>Verify with live data</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: THEME.surface,
    borderRadius: THEME.radiusCard,
    padding: 20,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  label: { fontSize: 14, fontWeight: '600', color: THEME.onSurface, marginBottom: 8 },
  input: {
    backgroundColor: THEME.surfaceDim,
    borderWidth: 0.5,
    borderColor: THEME.outline,
    borderRadius: THEME.radiusBtn,
    padding: 14,
    fontSize: 16,
    color: THEME.onSurface,
    marginBottom: 16,
  },
  button: {
    backgroundColor: THEME.primaryContainer,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: THEME.onPrimary, fontSize: 16, fontWeight: '600' },
  loader: { marginTop: 10 },
  modeRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: THEME.surfaceDim,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  modeBtnActive: { backgroundColor: THEME.primary },
  modeText: { fontWeight: '600', color: THEME.onSurfaceVariant },
  modeTextActive: { color: THEME.onPrimary },
  claimInput: { minHeight: 100, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: THEME.onSurfaceVariant, marginBottom: 10, lineHeight: 18 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 0.5,
    borderColor: THEME.primary,
    borderRadius: THEME.radiusBtn,
    marginBottom: 12,
  },
  photoBtnText: { color: THEME.primary, fontWeight: '600' },
  preview: { width: '100%', height: 160, borderRadius: THEME.radiusCard, marginBottom: 16 },
});

export default Report;
