import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider, useTranslation } from '../src/i18n';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { LocationProvider } from '../src/context/LocationContext';

function HeaderRight() {
  const { activeRole, switchRole } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.headerRightContainer}>
      {activeRole === 'PROVIDER' ? (
        <TouchableOpacity
          style={styles.proActionBtn}
          onPress={() => router.push('/provider/inbox')}
        >
          <Text style={styles.proActionText}>Jobs</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.roleBadge} onPress={switchRole}>
        <Text style={styles.roleText}>
          {activeRole === 'REQUESTER' ? t('requesterMode') : t('providerMode')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function RootNavigation() {
  const { t } = useTranslation();

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0f172a',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          headerRight: () => <HeaderRight />,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: t('appName'),
          }}
        />
        <Stack.Screen
          name="provider/[id]"
          options={{
            title: 'Provider Profile',
          }}
        />
        <Stack.Screen
          name="booking/new"
          options={{
            title: t('bookingSummary'),
          }}
        />
        <Stack.Screen
          name="booking/[id]"
          options={{
            title: 'Job Tracking',
          }}
        />
        <Stack.Screen
          name="chat/[bookingId]"
          options={{
            title: t('chatTitle'),
          }}
        />
        <Stack.Screen
          name="review/[bookingId]"
          options={{
            title: t('leaveReviewTitle'),
          }}
        />
        <Stack.Screen
          name="provider/onboarding"
          options={{
            title: t('proOnboardingTitle'),
          }}
        />
        <Stack.Screen
          name="provider/inbox"
          options={{
            title: 'Pro Job Inbox',
          }}
        />
        <Stack.Screen
          name="provider/earnings"
          options={{
            title: t('proEarningsTitle'),
          }}
        />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <LocationProvider>
          <RootNavigation />
        </LocationProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  proActionBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  proActionText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '600',
  },
});
