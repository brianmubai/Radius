import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { activeRole } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<'NONE' | 'RADIUS_PLUS' | 'PRO_PLUS'>('NONE');

  const handleSubscribe = (plan: 'RADIUS_PLUS' | 'PRO_PLUS') => {
    Alert.alert(
      'Stripe Billing',
      `Subscribe to ${plan === 'RADIUS_PLUS' ? 'Radius Plus ($19.99/mo)' : 'Pro Plus ($49.00/mo)'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Subscription',
          onPress: () => {
            setCurrentPlan(plan);
            Alert.alert(
              'Subscription Active',
              plan === 'RADIUS_PLUS'
                ? 'Radius Plus is active! Your next 10 bookings have $0 booking fees.'
                : 'Pro Plus is active! Your commission is reduced to 8% and your profile is featured in search results.'
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {activeRole === 'REQUESTER' ? (
        <View style={styles.planCard}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>CUSTOMER MEMBERSHIP</Text>
          </View>
          <Text style={styles.planTitle}>Radius Plus</Text>
          <Text style={styles.planPrice}>$19.99 <Text style={styles.planCycle}>/ month</Text></Text>
          <Text style={styles.planDesc}>
            Save on home maintenance, repairs, and recurring trade services.
          </Text>

          <View style={styles.benefitList}>
            <Text style={styles.benefitItem}>✓ $0 Platform Booking Fees (up to 10 bookings/mo)</Text>
            <Text style={styles.benefitItem}>✓ Priority matching with top-rated emergency pros</Text>
            <Text style={styles.benefitItem}>✓ Extended 96-hour escrow inspection protection</Text>
            <Text style={styles.benefitItem}>✓ Cancel anytime with 1 tap</Text>
          </View>

          <TouchableOpacity
            style={[styles.subBtn, currentPlan === 'RADIUS_PLUS' && styles.subBtnActive]}
            onPress={() => handleSubscribe('RADIUS_PLUS')}
            disabled={currentPlan === 'RADIUS_PLUS'}
          >
            <Text style={styles.subBtnText}>
              {currentPlan === 'RADIUS_PLUS' ? 'Current Plan' : 'Join Radius Plus'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.planCard}>
          <View style={[styles.planBadge, { backgroundColor: '#fef3c7' }]}>
            <Text style={[styles.planBadgeText, { color: '#b45309' }]}>PRO ACCELERATOR</Text>
          </View>
          <Text style={styles.planTitle}>Pro Plus</Text>
          <Text style={styles.planPrice}>$49.00 <Text style={styles.planCycle}>/ month</Text></Text>
          <Text style={styles.planDesc}>
            Maximize job volume and keep more of every dollar you earn.
          </Text>

          <View style={styles.benefitList}>
            <Text style={styles.benefitItem}>✓ 8% Commission Rate (reduced from 12% default)</Text>
            <Text style={styles.benefitItem}>✓ Featured Placement: Top of search results in radius</Text>
            <Text style={styles.benefitItem}>✓ Gold PRO PLUS Badge on profile and bids</Text>
            <Text style={styles.benefitItem}>✓ Immediate SMS & Push notification on urgent requests</Text>
          </View>

          <TouchableOpacity
            style={[styles.subBtn, currentPlan === 'PRO_PLUS' && styles.subBtnActive]}
            onPress={() => handleSubscribe('PRO_PLUS')}
            disabled={currentPlan === 'PRO_PLUS'}
          >
            <Text style={styles.subBtnText}>
              {currentPlan === 'PRO_PLUS' ? 'Current Plan' : 'Upgrade to Pro Plus'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#0284c7',
    marginBottom: 24,
  },
  planBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284c7',
  },
  planTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0284c7',
    marginVertical: 8,
  },
  planCycle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  planDesc: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 20,
    lineHeight: 20,
  },
  benefitList: {
    gap: 12,
    marginBottom: 24,
  },
  benefitItem: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  subBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  subBtnActive: {
    backgroundColor: '#10b981',
  },
  subBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
