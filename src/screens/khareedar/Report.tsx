import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, GOODS, BACKEND_URL } from '../../lib/constants';
import { normalizeAreaKey } from '../../lib/area';
import { useUserStore } from '../../store/userStore';
import { ref, push, set } from 'firebase/database';
import { db } from '../../lib/firebase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Report = () => {
  const { area, uid } = useUserStore();
  const [mode, setMode] = useState<'price' | 'claim'>('price');
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

  const handleClaimSubmit = async () => {
    if (!claimText.trim()) {
      Alert.alert('Error', 'Enter what you heard.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: claimText, area: normalizeAreaKey(area || 'surjani') }),
      });
      const data = await res.json();
      Alert.alert('Truth check', `Verdict: ${data.verdict || 'pending'}`);
      setClaimText('');
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Backend unreachable. Start agents on port 3000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Report</Text>
          <Text style={styles.subtitle}>Price gouging or rumour — verified against live APIs</Text>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'price' && styles.modeBtnActive]}
            onPress={() => setMode('price')}
          >
            <Text style={[styles.modeText, mode === 'price' && styles.modeTextActive]}>Price</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'claim' && styles.modeBtnActive]}
            onPress={() => setMode('claim')}
          >
            <Text style={[styles.modeText, mode === 'claim' && styles.modeTextActive]}>Rumour</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {mode === 'price' ? (
            <>
          <Text style={styles.label}>Select Item</Text>
          <View style={styles.goodsContainer}>
            {GOODS.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.goodItem,
                  selectedGood === item.id && styles.goodItemSelected,
                ]}
                onPress={() => setSelectedGood(item.id)}
              >
                <Text style={[styles.goodText, selectedGood === item.id && styles.goodTextSelected]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Shop / Cart Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Al-Makkah Kiryana, Rehri Wala"
            placeholderTextColor={COLORS.gray}
            value={shopName}
            onChangeText={setShopName}
          />

          <Text style={styles.label}>Reported Price (Rs)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter price in PKR"
            placeholderTextColor={COLORS.gray}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
          ) : (
            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
              <Icon name="check-circle" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Submit Price Report</Text>
            </TouchableOpacity>
          )}
            </>
          ) : (
            <>
              <Text style={styles.label}>Aapne kya suna?</Text>
              <TextInput
                style={[styles.input, styles.claimInput]}
                placeholder="Urdu ya English mein likhein"
                placeholderTextColor={COLORS.gray}
                value={claimText}
                onChangeText={setClaimText}
                multiline
              />
              {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  goodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  goodItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: COLORS.background,
  },
  goodItemSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  goodText: {
    color: '#374151',
    fontSize: 14,
  },
  goodTextSelected: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#000000',
    marginBottom: 20,
  },
  button: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 10,
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
  },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeText: { fontWeight: '600', color: COLORS.gray },
  modeTextActive: { color: COLORS.white },
  claimInput: { minHeight: 100, textAlignVertical: 'top' },
});

export default Report;
