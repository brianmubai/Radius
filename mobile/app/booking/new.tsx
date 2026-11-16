import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n';
import { apiRequest } from '../../src/api/client';

export default function NewBookingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    providerId: string;
    providerName: string;
    category: string;
  }>();

  const [priceInput, setPriceInput] = useState<string>('150');
  const [isUrgent, setIsUrgent] = useState<boolean>(false);
  const [hasDamageProtection, setHasDamageProtection] = useState<boolean>(true);
  const [address, setAddress] = useState<string>('742 Evergreen Terrace');
  const [jobDescription, setJobDescription] = useState<string>(
    'Need urgent diagnostic and fix for electrical circuit tripping.'
  );
  const [loading, setLoading] = useState<boolean>(false);

  const agreedAmountDollars = parseFloat(priceInput) || 0;
  const agreedAmountCents = Math.round(agreedAmountDollars * 100);

  // Pricing Engine calculations
  // Requester booking fee: 5% with $2.50 (250 cents) minimum
  const percentageFee = Math.round(agreedAmountCents * 0.05);
  const bookingFeeCents = Math.max(250, percentageFee);

  // Urgent surcharge: $20.00 (2000 cents) if active
  const isUrgentEligible = ['mechanics', 'tree-removal', 'locksmith', 'plumbing', 'electrical'].includes(
    params.category || ''
  );
  const urgentSurchargeCents = isUrgent && isUrgentEligible ? 2000 : 0;

  // City tax (8.5% default)
  const cityTaxCents = Math.round(agreedAmountCents * 0.085);

  // Damage protection fee ($9.99 flat)
  const damageProtectionFeeCents = hasDamageProtection ? 999 : 0;

  const totalChargedCents =
    agreedAmountCents + bookingFeeCents + urgentSurchargeCents + cityTaxCents + damageProtectionFeeCents;

  const handleConfirmAndPay = async () => {
    try {
      setLoading(true);
      // In live environment, calls backend /api/v1/bookings/instant
      // and launches Stripe PaymentSheet
      const mockBookingId = `book-${Date.now().toString().substring(7)}`;

      Alert.alert(
        'Stripe PaymentSheet',
        `$${(totalChargedCents / 100).toFixed(2)} authorized and placed in escrow hold.`,
        [
          {
            text: 'Track Job',
            onPress: () =>
              router.replace({
                pathname: `/booking/${mockBookingId}`,
                params: {
                  providerName: params.providerName || 'Dave Vance',
                  agreedAmount: (agreedAmountCents / 100).toFixed(2),
                  grossAmount: (totalChargedCents / 100).toFixed(2),
                },
              }),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Booking Error', err.message || 'Payment authorization failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Service Details</Text>
        <Text style={styles.providerName}>{params.providerName || 'Verified Pro'}</Text>
        <Text style={styles.categoryBadge}>{(params.category || 'General').toUpperCase()}</Text>

        <Text style={styles.inputLabel}>Job Description</Text>
        <TextInput
          style={styles.textInputArea}
          value={jobDescription}
          onChangeText={setJobDescription}
          multiline
        />

        <Text style={styles.inputLabel}>Service Location (Private)</Text>
        <TextInput
          style={styles.textInput}
          value={address}
          onChangeText={setAddress}
        />
        <Text style={styles.privateNote}>{t('exactAddressRevealedOnBooking')}</Text>

        <Text style={styles.inputLabel}>Agreed Amount ($)</Text>
        <TextInput
          style={styles.textInput}
          value={priceInput}
          onChangeText={setPriceInput}
          keyboardType="numeric"
        />

        {isUrgentEligible && (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Urgent 24/7 Dispatch</Text>
              <Text style={styles.switchDesc}>Priority fast dispatch within 45 minutes.</Text>
            </View>
            <Switch value={isUrgent} onValueChange={setIsUrgent} />
          </View>
        )}

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>{t('damageProtectionTitle')}</Text>
            <Text style={styles.switchDesc}>{t('damageProtectionDesc')}</Text>
          </View>
          <Switch value={hasDamageProtection} onValueChange={setHasDamageProtection} />
        </View>
      </View>

      {/* Pricing Module Breakdown */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Price & Escrow Breakdown</Text>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('agreedAmount')}</Text>
          <Text style={styles.breakdownValue}>${agreedAmountDollars.toFixed(2)}</Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('requesterBookingFee')} (5%, min $2.50)</Text>
          <Text style={styles.breakdownValue}>${(bookingFeeCents / 100).toFixed(2)}</Text>
        </View>

        {urgentSurchargeCents > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('urgentSurcharge')}</Text>
            <Text style={styles.breakdownValue}>${(urgentSurchargeCents / 100).toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{t('cityTax')} (8.5%)</Text>
          <Text style={styles.breakdownValue}>${(cityTaxCents / 100).toFixed(2)}</Text>
        </View>

        {hasDamageProtection && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('damageProtectionFee')}</Text>
            <Text style={styles.breakdownValue}>$9.99</Text>
          </View>
        )}

        <View style={[styles.breakdownRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>{t('totalCharge')}</Text>
          <Text style={styles.totalValue}>${(totalChargedCents / 100).toFixed(2)}</Text>
        </View>

        <View style={styles.escrowNotice}>
          <Text style={styles.escrowNoticeText}>{t('feeProtectionNotice')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.payButton, loading && { opacity: 0.7 }]}
          onPress={handleConfirmAndPay}
          disabled={loading}
        >
          <Text style={styles.payButtonText}>
            {loading ? 'Authorizing...' : t('confirmAndPay')}
          </Text>
        </TouchableOpacity>
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  categoryBadge: {
    color: '#0284c7',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  textInputArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 60,
    marginBottom: 12,
  },
  privateNote: {
    fontSize: 11,
    color: '#64748b',
    marginTop: -8,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  switchDesc: {
    fontSize: 11,
    color: '#64748b',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#475569',
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0284c7',
  },
  escrowNotice: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginVertical: 16,
  },
  escrowNoticeText: {
    fontSize: 12,
    color: '#15803d',
    lineHeight: 16,
  },
  payButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
