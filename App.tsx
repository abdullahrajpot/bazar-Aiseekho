import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Auth Screens
import Login from './src/screens/Login';
import Signup from './src/screens/Signup';
import Onboarding from './src/screens/Onboarding';

// Khareedar Screens
import KhareedarHome from './src/screens/KhareedarHome';
import Khabar from './src/screens/khareedar/Khabar';
import Report from './src/screens/khareedar/Report';
import Alerts from './src/screens/khareedar/Alerts';

// Dukandar Screens
import DukandarHome from './src/screens/DukandarHome';
import Prices from './src/screens/dukandar/Prices';
import Supply from './src/screens/dukandar/Supply';

// Admin Screens
import AdminDashboard from './src/screens/AdminDashboard';
import MapScreen from './src/screens/admin/Map';
import Shops from './src/screens/admin/Shops';
import Override from './src/screens/admin/Override';

// Global Screens
import Profile from './src/screens/Profile';

// Stores and hooks
import { useUserStore } from './src/store/userStore';
import { useUserRole } from './src/hooks/useUserRole';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/lib/firebase';
import { ActivityIndicator, View } from 'react-native';
import { COLORS } from './src/lib/constants';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const KhareedarTabs = () => (
  <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: COLORS.primary }}>
    <Tab.Screen name="Home" component={KhareedarHome} options={{ tabBarIcon: ({color}) => <Icon name="home" size={24} color={color} /> }} />
    <Tab.Screen name="Khabar" component={Khabar} options={{ tabBarIcon: ({color}) => <Icon name="newspaper" size={24} color={color} /> }} />
    <Tab.Screen name="Report" component={Report} options={{ tabBarIcon: ({color}) => <Icon name="plus-box" size={24} color={color} /> }} />
    <Tab.Screen name="Alerts" component={Alerts} options={{ tabBarIcon: ({color}) => <Icon name="bell" size={24} color={color} /> }} />
    <Tab.Screen name="Profile" component={Profile} options={{ tabBarIcon: ({color}) => <Icon name="account" size={24} color={color} /> }} />
  </Tab.Navigator>
);

const DukandarTabs = () => (
  <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: COLORS.primary }}>
    <Tab.Screen name="Home" component={DukandarHome} options={{ tabBarIcon: ({color}) => <Icon name="store" size={24} color={color} /> }} />
    <Tab.Screen name="Prices" component={Prices} options={{ tabBarIcon: ({color}) => <Icon name="tag" size={24} color={color} /> }} />
    <Tab.Screen name="Supply" component={Supply} options={{ tabBarIcon: ({color}) => <Icon name="truck" size={24} color={color} /> }} />
    <Tab.Screen name="Profile" component={Profile} options={{ tabBarIcon: ({color}) => <Icon name="account" size={24} color={color} /> }} />
  </Tab.Navigator>
);

const AdminTabs = () => (
  <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: COLORS.primary }}>
    <Tab.Screen name="Dashboard" component={AdminDashboard} options={{ tabBarIcon: ({color}) => <Icon name="view-dashboard" size={24} color={color} /> }} />
    <Tab.Screen name="Map" component={MapScreen} options={{ tabBarIcon: ({color}) => <Icon name="map" size={24} color={color} /> }} />
    <Tab.Screen name="Shops" component={Shops} options={{ tabBarIcon: ({color}) => <Icon name="storefront" size={24} color={color} /> }} />
    <Tab.Screen name="Override" component={Override} options={{ tabBarIcon: ({color}) => <Icon name="tune" size={24} color={color} /> }} />
    <Tab.Screen name="Profile" component={Profile} options={{ tabBarIcon: ({color}) => <Icon name="account" size={24} color={color} /> }} />
  </Tab.Navigator>
);

const MainTabs = () => {
  const { role } = useUserRole();

  if (!role) {
    return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><ActivityIndicator size="large" color={COLORS.primary}/></View>;
  }

  if (role === 'khareedar') {return <KhareedarTabs />;}
  if (role === 'dukandar') {return <DukandarTabs />;}
  if (role === 'admin') {return <AdminTabs />;}

  return null;
};

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const { uid, setUser, role } = useUserStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user.uid);
      } else {
        useUserStore.getState().logout();
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, [setUser]);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
