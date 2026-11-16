import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n';
import { useAuth } from '../../src/context/AuthContext';

type BookingStatus = 'BOOKED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAID_OUT' | 'DISPUTED';

export default function BookingTrackingScreen() {
  const { t } = useTranslation();
  const { activeRole } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    providerName?: string;
    agreedAmount?: string;
    grossAmount?: string;
  }>();

  const [status, setStatus] = useState<BookingStatus>('BOOKED');

  const handleStartJob = () => {
    setStatus('IN_PROGRESS');
  };

  const handleMarkComplete = () => {
    setStatus('COMPLETED');
  };

  const handleConfirmPayout = () => {
    Alert.alert(
      'Confirm Job Completion',
      'This will capture customer funds from escrow and transfer payout to the provider minus 12% commission.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Release',
          onPress: () => {
            setStatus('PAID_OUT');
            Alert.alert('Payout Released', 'Provider funds released! Please leave a review.');
          },
        },
      ]
    );
  };

  const handleDispute = () => {
    Alert.prompt
      ? Alert.prompt('Open Dispute', 'Describe the issue for mediation:', (reason) => {
          setStatus('DISPUTED');
          Alert.alert('Dispute Registered', 'Escrow funds have been frozen pending admin review.');
        })
      : (() => {
          setStatus('DISPUTED');
          Alert.alert('Dispute Registered', 'Escrow funds have been frozen pending admin review.');
        })();
  };

  return (
    <ScrollView style={styles.container}>
      {/* State Machine Status Header */}
      <View style={styles.statusCard}>
        <Text style={styles.bookingNumber}>Booking #{params.id || '4481'}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {status === 'BOOKED' && t('statusBooked')}
            {status === 'IN_PROGRESS' && t('statusInProgress')}
            {status === 'COMPLETED' && t('statusCompleted')}
            {status === 'PAID_OUT' && t('statusPaidOut')}
            {status === 'DISPUTED' && t('statusDisputed')}
          </Text>
        </View>

        {/* State Flow Stepper */}
        <View style={styles.stepperContainer}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View
            style={[
              styles.stepLine,
              ['IN_PROGRESS', 'COMPLETED', 'PAID_OUT'].includes(status) && styles.stepLineActive,
            ]}
          />
          <View
            style={[
              styles.stepDot,
              ['IN_PROGRESS', 'COMPLETED', 'PAID_OUT'].includes(status) && styles.stepDotActive,
            ]}
          />
          <View
            style={[
              styles.stepLine,
              ['COMPLETED', 'PAID_OUT'].includes(status) && styles.stepLineActive,
            ]}
          />
          <View
            style={[
              styles.stepDot,
              ['COMPLETED', 'PAID_OUT'].includes(status) && styles.stepDotActive,
            ]}
          />
          <View
            style={[
              styles.stepLine,
              status === 'PAID_OUT' && styles.stepLineActive,
            ]}
          />
          <View
            style={[
              styles.stepDot,
              status === 'PAID_OUT' && styles.stepDotActive,
            ]}
          />
        </View>

        {status === 'COMPLETED' && (
          <Text style={styles.autoConfirmNotice}>{t('autoConfirmNote')}</Text>
        )}
      </View>

      {/* Confirmed Contact & Location Details */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Confirmed Service Info</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Provider:</Text>
          <Text style={styles.infoValue}>{params.providerName || 'Dave Vance'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Verified Phone:</Text>
          <Text style={styles.infoValue}>+1 (415) 555-4321</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Exact Address:</Text>
          <Text style={styles.infoValue}>742 Evergreen Terrace, San Francisco, CA</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Escrow Held:</Text>
          <Text style={styles.infoValue}>${params.grossAmount || '157.50'}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Chat Button */}
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => router.push(`/chat/${params.id}`)}
        >
          <Text style={styles.chatButtonText}>{t('chatTitle')}</Text>
        </TouchableOpacity>

        {/* Provider Controls */}
        {activeRole === 'PROVIDER' && status === 'BOOKED' && (
          <TouchableOpacity style={styles.primaryButton} onPress={handleStartJob}>
            <Text style={styles.primaryButtonText}>Start Job (In Progress)</Text>
          </TouchableOpacity>
        )}

        {activeRole === 'PROVIDER' && status === 'IN_PROGRESS' && (
          <TouchableOpacity style={styles.primaryButton} onPress={handleMarkComplete}>
            <Text style={styles.primaryButtonText}>{t('markJobComplete')}</Text>
          </TouchableOpacity>
        )}

        {/* Requester Controls */}
        {activeRole === 'REQUESTER' && status === 'COMPLETED' && (
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPayout}>
            <Text style={styles.confirmButtonText}>{t('confirmCompletionAndRelease')}</Text>
          </TouchableOpacity>
        )}

        {/* Review Button */}
        {(status === 'COMPLETED' || status === 'PAID_OUT') && (
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={() => router.push(`/review/${params.id}`)}
          >
            <Text style={styles.reviewButtonText}>★ {t('leaveReviewTitle')}</Text>
          </TouchableOpacity>
        )}

        {/* Dispute Button */}
        {status !== 'PAID_OUT' && status !== 'DISPUTED' && (
          <TouchableOpacity style={styles.disputeButton} onPress={handleDispute}>
            <Text style={styles.disputeButtonText}>{t('openDispute')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  bookingNumber: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 6,
  },
  statusBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    width: '80%',
    justifyContent: 'center',
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#cbd5e1',
  },
  stepDotActive: {
    backgroundColor: '#0284c7',
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#e2e8f0',
  },
  stepLineActive: {
    backgroundColor: '#0284c7',
  },
  autoConfirmNotice: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
    marginTop: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    maxWidth: '65%',
    textAlign: 'right',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  chatButton: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  reviewButton: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reviewButtonText: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '700',
  },
  disputeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disputeButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
});
