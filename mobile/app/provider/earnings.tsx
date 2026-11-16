import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from '../../src/i18n';

export default function ProviderEarningsScreen() {
  const { t } = useTranslation();

  const earnings = {
    grossBookings: 3450.0,
    commissionRate: 0.12, // 12% default
    commissionDeducted: 414.0,
    netPayout: 3036.0,
  };

  const payouts = [
    {
      id: 'po-101',
      date: 'Yesterday',
      bookingId: 'book-802',
      gross: 350.0,
      fee: 42.0,
      net: 308.0,
    },
    {
      id: 'po-102',
      date: 'Nov 11, 2026',
      bookingId: 'book-749',
      gross: 220.0,
      fee: 26.4,
      net: 193.6,
    },
    {
      id: 'po-103',
      date: 'Nov 09, 2026',
      bookingId: 'book-690',
      gross: 540.0,
      fee: 64.8,
      net: 475.2,
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>{t('proEarningsTitle')}</Text>

      {/* Summary Cards */}
      <View style={styles.summaryGrid}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('totalEarned')}</Text>
          <Text style={styles.cardValue}>${earnings.grossBookings.toFixed(2)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('commissionDeducted')}</Text>
          <Text style={[styles.cardValue, { color: '#ef4444' }]}>
            -${earnings.commissionDeducted.toFixed(2)}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <Text style={[styles.cardLabel, { color: '#166534' }]}>{t('netPayout')}</Text>
          <Text style={[styles.cardValue, { color: '#15803d' }]}>
            ${earnings.netPayout.toFixed(2)}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Payout History (Stripe Express)</Text>

      {payouts.map((p) => (
        <View key={p.id} style={styles.payoutCard}>
          <View style={styles.payoutHeader}>
            <Text style={styles.payoutDate}>{p.date} • #{p.bookingId}</Text>
            <Text style={styles.payoutNet}>+${p.net.toFixed(2)}</Text>
          </View>
          <Text style={styles.payoutBreakdown}>
            Gross: ${p.gross.toFixed(2)} | Radius Commission: -${p.fee.toFixed(2)}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  summaryGrid: {
    gap: 12,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  payoutCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  payoutDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  payoutNet: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10b981',
  },
  payoutBreakdown: {
    fontSize: 11,
    color: '#64748b',
  },
});
