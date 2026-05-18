import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, GOODS } from '../../lib/constants';
import { normalizeAreaKey } from '../../lib/area';
import { useUserStore } from '../../store/userStore';
import { ref, push, set } from 'firebase/database';
import { db } from '../../lib/firebase';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Prices = () => {
  const { area, uid, shopId } = useUserStore();
  const [selectedGood, setSelectedGood] = useState(GOODS[0].id);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!price) {
      Alert.alert('Error', 'Please enter a price.');
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
      const resolvedShopId = shopId || `shop_${uid}`;

      await set(newReportRef, {
        itemId: selectedGood,
        area: normalizeAreaKey(area || 'Surjani Town'),
        price: priceNum,
        shopId: resolvedShopId,
        shopName: 'Dukandar Official Shop',
        submittedBy: 'dukandar',
        submitterUid: uid,
        timestamp: Date.now(),
      });

      Alert.alert('Success', 'Price submitted. AI agent will assess within seconds.');
      setPrice('');
    } catch (e: any) {
      Alert.alert('Submission Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>قیمتیں اپ ڈیٹ کریں | Update Prices</Text>
          <Text style={styles.subtitle}>Submit your current stock prices to ensure transparency</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Select Good to Update</Text>
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

          <Text style={styles.label}>Your Retail Price (Rs)</Text>
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
              <Icon name="tag-outline" size={20} color={COLORS.white} style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Publish Good Price</Text>
            </TouchableOpacity>
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
});

export default Prices;
