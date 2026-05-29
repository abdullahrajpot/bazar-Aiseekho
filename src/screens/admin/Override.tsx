import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SPACING, MONITORED_ROUTES, GOODS, AREAS } from '../../lib/constants';
import { THEME } from '../../lib/theme';
import { normalizeAreaKey } from '../../lib/area';
import { ref, remove, update, set, get } from 'firebase/database';
import { db } from '../../lib/firebase';
import { useTruthFeed } from '../../hooks/useTruthFeed';
import { DesignHeader } from '../../components/ui/DesignHeader';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const STALE_ROUTE_IDS = ['m9_main', 'm2_main', 'N5_main'];
const ROUTE_STATUSES = ['clear', 'partial', 'blocked'] as const;
const VERDICTS = ['verified', 'false', 'unverified'] as const;

const Override = () => {
  const { claims } = useTruthFeed(null);
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(MONITORED_ROUTES[0].id);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [fairPriceArea, setFairPriceArea] = useState('Surjani Town');
  const [fairPriceItem, setFairPriceItem] = useState(GOODS[0].id);
  const [fairPriceValue, setFairPriceValue] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  const overrideRoadStatus = async (status: (typeof ROUTE_STATUSES)[number]) => {
    setLoading(true);
    try {
      await update(ref(db, `supply_status/${selectedRoute}`), {
        status,
        overriddenByAdmin: true,
        overriddenAt: Date.now(),
        updatedAt: Date.now(),
      });
      Alert.alert('Updated', `Route ${selectedRoute} set to ${status}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const overrideRumourVerdict = async (verdict: (typeof VERDICTS)[number]) => {
    if (!selectedClaim) {
      Alert.alert('Select claim', 'Pick a claim from the list first.');
      return;
    }
    setLoading(true);
    try {
      await update(ref(db, `truth_feed/${selectedClaim}`), {
        verdict,
        overriddenByAdmin: true,
        overriddenAt: Date.now(),
      });
      Alert.alert('Updated', `Claim verdict set to ${verdict}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const overrideFairPrice = async () => {
    const value = parseFloat(fairPriceValue);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid price', 'Enter a valid fair price in PKR.');
      return;
    }
    setLoading(true);
    try {
      const areaKey = normalizeAreaKey(fairPriceArea);
      await set(ref(db, `prices/${areaKey}/${fairPriceItem}/fairPrice`), value);
      Alert.alert('Updated', `Fair price for ${fairPriceItem} in ${areaKey} set to Rs ${value}.`);
      setFairPriceValue('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const broadcastMessage = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      Alert.alert('Missing fields', 'Enter title and body for broadcast.');
      return;
    }
    setLoading(true);
    try {
      const usersSnap = await get(ref(db, 'users'));
      const users = usersSnap.val() || {};
      const tokens: string[] = [];
      Object.values(users).forEach((user: any) => {
        if (user?.expoPushToken) tokens.push(user.expoPushToken);
      });

      if (tokens.length === 0) {
        Alert.alert('No tokens', 'No registered push tokens found in users node.');
        return;
      }

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          tokens.map((to) => ({
            to,
            title: broadcastTitle,
            body: broadcastBody,
            data: { type: 'broadcast' },
          }))
        ),
      });
      Alert.alert('Sent', `Broadcast sent to ${tokens.length} devices.`);
      setBroadcastTitle('');
      setBroadcastBody('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const clearStaleSimulationData = async () => {
    setLoading(true);
    try {
      for (const routeId of STALE_ROUTE_IDS) {
        await remove(ref(db, `supply_status/${routeId}`));
      }
      Alert.alert('Cleared', 'Removed old simulated route test data.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <DesignHeader
        title="Admin override"
        subtitle="Emergency only — agents normally control routes & truth"
        showLive={false}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Road status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {MONITORED_ROUTES.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.chip, selectedRoute === r.id && styles.chipActive]}
                onPress={() => setSelectedRoute(r.id)}
              >
                <Text style={[styles.chipText, selectedRoute === r.id && styles.chipTextActive]}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.btnRow}>
            {ROUTE_STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.smallBtn}
                onPress={() => overrideRoadStatus(s)}
                disabled={loading}
              >
                <Text style={styles.smallBtnText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rumour verdict</Text>
          {claims.length === 0 ? (
            <Text style={styles.hint}>No claims in truth_feed yet.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {claims.slice(0, 8).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, selectedClaim === c.id && styles.chipActive]}
                  onPress={() => setSelectedClaim(c.id)}
                >
                  <Text
                    style={[styles.chipText, selectedClaim === c.id && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {(c.text || '').slice(0, 30)}…
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <View style={styles.btnRow}>
            {VERDICTS.map((v) => (
              <TouchableOpacity
                key={v}
                style={styles.smallBtn}
                onPress={() => overrideRumourVerdict(v)}
                disabled={loading}
              >
                <Text style={styles.smallBtnText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fair price baseline</Text>
          <Text style={styles.label}>Area</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {AREAS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, fairPriceArea === a && styles.chipActive]}
                onPress={() => setFairPriceArea(a)}
              >
                <Text style={[styles.chipText, fairPriceArea === a && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Item</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {GOODS.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[styles.chip, fairPriceItem === g.id && styles.chipActive]}
                onPress={() => setFairPriceItem(g.id)}
              >
                <Text style={[styles.chipText, fairPriceItem === g.id && styles.chipTextActive]}>
                  {g.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput
            style={styles.input}
            placeholder="Fair price (PKR)"
            keyboardType="numeric"
            value={fairPriceValue}
            onChangeText={setFairPriceValue}
          />
          <TouchableOpacity style={styles.btn} onPress={overrideFairPrice} disabled={loading}>
            <Text style={styles.btnText}>Set fair price</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Broadcast push</Text>
          <TextInput
            style={styles.input}
            placeholder="Title"
            value={broadcastTitle}
            onChangeText={setBroadcastTitle}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Message body"
            value={broadcastBody}
            onChangeText={setBroadcastBody}
            multiline
          />
          <TouchableOpacity style={styles.btn} onPress={broadcastMessage} disabled={loading}>
            <Text style={styles.btnText}>Send broadcast</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.btnSecondary} onPress={clearStaleSimulationData} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={THEME.onPrimary} />
            ) : (
              <>
                <Icon name="database-remove" size={20} color={THEME.onPrimary} style={{ marginRight: 8 }} />
                <Text style={styles.btnText}>Clear stale test route data</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: THEME.outline,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: THEME.onSurface, marginBottom: SPACING.md },
  hint: { fontSize: 13, color: THEME.onSurfaceVariant, marginBottom: SPACING.sm },
  label: { fontSize: 12, color: THEME.onSurfaceVariant, marginBottom: SPACING.xs },
  chipRow: { marginBottom: SPACING.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: THEME.background,
    marginRight: SPACING.sm,
    maxWidth: 160,
  },
  chipActive: { backgroundColor: THEME.primary },
  chipText: { fontSize: 12, color: THEME.onSurfaceVariant },
  chipTextActive: { color: THEME.onPrimary, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  smallBtn: {
    flex: 1,
    minWidth: 80,
    backgroundColor: THEME.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  smallBtnText: { color: THEME.onPrimary, fontWeight: '600', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: THEME.outline,
    borderRadius: 8,
    padding: 12,
    marginBottom: SPACING.sm,
    backgroundColor: THEME.background,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  btn: {
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: THEME.gray,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  btnText: { color: THEME.onPrimary, fontWeight: '700' },
});

export default Override;
