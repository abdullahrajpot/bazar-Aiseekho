import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useUserStore } from '../store/userStore';
import { THEME } from '../lib/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Signup = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useUserStore();

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Missing fields', 'Fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user.uid);
      navigation.replace('Onboarding');
    } catch (error: any) {
      if (error.code === 'auth/configuration-not-found') {
        Alert.alert(
          'Firebase setup',
          'Enable Email/Password in Firebase Console → Authentication → Sign-in method.'
        );
      } else {
        Alert.alert('Signup failed', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoCircle}>
            <Text style={styles.logoLetter}>B</Text>
          </View>
          <Text style={styles.title}>Join Bazar</Text>
          <Text style={styles.urduTagline}>اکاؤنٹ بنائیں</Text>
          <Text style={styles.taglineEn}>Citizen access to CIRO crisis intelligence</Text>

          <View style={styles.form}>
            <Text style={styles.label}>EMAIL</Text>
            <View style={styles.inputWrap}>
              <Icon name="email-outline" size={20} color={THEME.onSurfaceVariant} />
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={THEME.outlineVariant}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Icon name="lock-outline" size={20} color={THEME.onSurfaceVariant} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={THEME.outlineVariant}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <View style={styles.inputWrap}>
              <Icon name="lock-check-outline" size={20} color={THEME.onSurfaceVariant} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={THEME.outlineVariant}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={THEME.primary} style={{ marginTop: 16 }} />
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup}>
                <Text style={styles.primaryBtnText}>Create account</Text>
                <Icon name="account-plus" size={20} color={THEME.onPrimary} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Already have an account? </Text>
            <Text style={styles.linkBold}>Sign in</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Icon name="shield-check" size={14} color={THEME.onSurfaceVariant} />
            <Text style={styles.footerMeta}>Secured by CIRO Intelligence Engine</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center', maxWidth: 440, alignSelf: 'center', width: '100%' },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.primary,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: THEME.outline,
  },
  logoLetter: { fontSize: 32, fontWeight: '700', color: THEME.onPrimary },
  title: { fontSize: 28, fontWeight: '700', color: THEME.primary, textAlign: 'center' },
  urduTagline: { fontSize: 18, color: THEME.onSurfaceVariant, textAlign: 'center', marginTop: 8 },
  taglineEn: { fontSize: 13, color: THEME.onSurfaceVariant, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  form: { width: '100%' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: THEME.onSurfaceVariant,
    marginBottom: 6,
    marginTop: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.surface,
    borderWidth: 0.5,
    borderColor: THEME.outline,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 8,
  },
  input: { flex: 1, fontSize: 16, color: THEME.onSurface },
  primaryBtn: {
    backgroundColor: THEME.primaryContainer,
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  primaryBtnText: { color: THEME.onPrimary, fontSize: 16, fontWeight: '600' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  linkText: { fontSize: 15, color: THEME.onSurfaceVariant },
  linkBold: { fontSize: 15, fontWeight: '700', color: THEME.primary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
  },
  footerMeta: { fontSize: 12, color: THEME.onSurfaceVariant },
});

export default Signup;
