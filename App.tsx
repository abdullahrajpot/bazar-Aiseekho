import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import Login from './src/screens/Login';
import Signup from './src/screens/Signup';
import Onboarding from './src/screens/Onboarding';
import KhareedarHome from './src/screens/KhareedarHome';
import Khabar from './src/screens/khareedar/Khabar';
import Report from './src/screens/khareedar/Report';
import Alerts from './src/screens/khareedar/Alerts';
import CrisisMapScreen from './src/screens/CrisisMapScreen';
import AdminDashboard from './src/screens/AdminDashboard';
import CrisisCommand from './src/screens/admin/CrisisCommand';
import CrisisSimulate from './src/screens/admin/CrisisSimulate';
import Override from './src/screens/admin/Override';
import Profile from './src/screens/Profile';

import { useUserStore } from './src/store/userStore';
import { useUserRole } from './src/hooks/useUserRole';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/lib/firebase';
import { ActivityIndicator, View } from 'react-native';
import { THEME } from './src/lib/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/** Citizen / user — crisis-first navigation (design) */
const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: THEME.primary,
  tabBarInactiveTintColor: THEME.onSurfaceVariant,
  tabBarStyle: {
    backgroundColor: THEME.surface,
    borderTopWidth: 0.5,
    borderTopColor: THEME.outline,
    paddingBottom: 4,
    height: 60,
  },
  tabBarLabelStyle: { fontSize: 10, fontWeight: '600' as const },
};

const UserTabs = () => (
  <Tab.Navigator screenOptions={tabScreenOptions}>
    <Tab.Screen
      name="Home"
      component={KhareedarHome}
      options={{ tabBarIcon: ({ color }) => <Icon name="home" size={24} color={color} /> }}
    />
    <Tab.Screen
      name="Map"
      component={CrisisMapScreen}
      options={{ tabBarIcon: ({ color }) => <Icon name="map" size={26} color={color} /> }}
    />
    <Tab.Screen
      name="Report"
      component={Report}
      options={{ tabBarIcon: ({ color }) => <Icon name="plus-circle" size={24} color={color} /> }}
    />
    <Tab.Screen
      name="Alerts"
      component={Alerts}
      options={{ tabBarIcon: ({ color }) => <Icon name="bell" size={24} color={color} /> }}
    />
    <Tab.Screen
      name="Profile"
      component={Profile}
      options={{ tabBarIcon: ({ color }) => <Icon name="account" size={24} color={color} /> }}
    />
  </Tab.Navigator>
);

const AdminStack = createNativeStackNavigator();
const AdminTabsInner = () => (
  <Tab.Navigator screenOptions={tabScreenOptions}>
    <Tab.Screen name="Dashboard" component={AdminDashboard} options={{ tabBarIcon: ({ color }) => <Icon name="view-dashboard" size={24} color={color} /> }} />
    <Tab.Screen name="Crisis" component={CrisisCommand} options={{ tabBarIcon: ({ color }) => <Icon name="alert-octagon" size={24} color={color} /> }} />
    <Tab.Screen name="Map" component={CrisisMapScreen} options={{ tabBarIcon: ({ color }) => <Icon name="map" size={24} color={color} /> }} />
    <Tab.Screen name="Khabar" component={Khabar} options={{ tabBarIcon: ({ color }) => <Icon name="newspaper" size={24} color={color} /> }} />
    <Tab.Screen name="Override" component={Override} options={{ tabBarIcon: ({ color }) => <Icon name="tune" size={24} color={color} /> }} />
    <Tab.Screen name="Profile" component={Profile} options={{ tabBarIcon: ({ color }) => <Icon name="account" size={24} color={color} /> }} />
  </Tab.Navigator>
);

const AdminTabs = () => (
  <AdminStack.Navigator screenOptions={{ headerShown: false }}>
    <AdminStack.Screen name="AdminMain" component={AdminTabsInner} />
    <AdminStack.Screen name="CrisisSimulate" component={CrisisSimulate} />
  </AdminStack.Navigator>
);

const MainTabs = () => {
  const { role } = useUserRole();
  if (!role) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }
  if (role === 'admin') return <AdminTabs />;
  return <UserTabs />;
};

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const { uid, setUser, role } = useUserStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUser(user.uid);
      else useUserStore.getState().logout();
      setInitializing(false);
    });
    return () => unsubscribe();
  }, [setUser]);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!uid ? (
            <>
              <Stack.Screen name="Login" component={Login} />
              <Stack.Screen name="Signup" component={Signup} />
            </>
          ) : !role ? (
            <Stack.Screen name="Onboarding" component={Onboarding} />
          ) : (
            <Stack.Screen name="MainTabs" component={MainTabs} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
