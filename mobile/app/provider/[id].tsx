import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n';

export default function ProviderProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  // Mock provider profile data
  const provider = {
    id: params.id || 'prov-1',
    name: 'Dave Vance',
    category: 'Electrical',
    bio: 'Licensed master electrician with over 10 years experience serving residential and commercial clients across San Francisco. Specializing in emergency diagnostics, panel upgrades, breaker fixes, and certified EV charging stations.',
    serviceRadiusKm: 20,
    ratingAvg: 4.9,
    ratingCount: 38,
    approxZone: 'Downtown San Francisco (~750m zone)',
    workingHours: 'Mon - Sat: 8:00 AM - 6:00 PM',
    verified: true,
  };

  const reviews = [
    {
      id: 'rev-1',
      reviewerName: 'Marcus T.',
      rating: 5,
      comment: 'Dave arrived within 25 minutes of booking and diagnosed a burned-out breaker in no time. Clear communication and fair price.',
      date: '3 days ago',
    },
    {
      id: 'rev-2',
      reviewerName: 'Emily K.',
      rating: 5,
      comment: 'Top-tier work on our Tesla home charger install. Clean conduit run and passed city inspection without a hitch.',
      date: '1 week ago',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.providerName}>{provider.name}</Text>
            <Text style={styles.categoryBadge}>{provider.category.toUpperCase()}</Text>
          </View>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>★ {provider.ratingAvg.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({provider.ratingCount})</Text>
          </View>
        </View>

        <View style={styles.verifiedRow}>
          <Text style={styles.verifiedBadge}>✓ Verified License & Background Check</Text>
        </View>

        {/* Approximate Zone Notice (Security & Privacy Rule) */}
        <View style={styles.zoneCard}>
          <Text style={styles.zoneTitle}>{t('approximateZone')}</Text>
          <Text style={styles.zoneLabel}>{provider.approxZone}</Text>
          <Text style={styles.zoneNotice}>{t('exactAddressRevealedOnBooking')}</Text>
        </View>

        <Text style={styles.sectionTitle}>About the Professional</Text>
        <Text style={styles.bioText}>{provider.bio}</Text>

        <Text style={styles.sectionTitle}>Hours & Availability</Text>
        <Text style={styles.hoursText}>{provider.workingHours}</Text>

        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() =>
            router.push({
              pathname: '/booking/new',
              params: {
                providerId: provider.id,
                providerName: provider.name,
                category: provider.category.toLowerCase(),
              },
            })
          }
        >
          <Text style={styles.bookBtnText}>{t('bookNow')}</Text>
        </TouchableOpacity>
      </View>

      {/* Customer Reviews Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Customer Reviews ({reviews.length})</Text>
        {reviews.map((rev) => (
          <View key={rev.id} style={styles.reviewItem}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewerName}>{rev.reviewerName}</Text>
              <Text style={styles.reviewRating}>{'★'.repeat(rev.rating)}</Text>
            </View>
            <Text style={styles.reviewComment}>{rev.comment}</Text>
            <Text style={styles.reviewDate}>{rev.date}</Text>
          </View>
        ))}
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
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  providerName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  categoryBadge: {
    color: '#0284c7',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b45309',
  },
  ratingCount: {
    fontSize: 12,
    color: '#b45309',
  },
  verifiedRow: {
    marginVertical: 10,
  },
  verifiedBadge: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 12,
  },
  zoneCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginVertical: 12,
  },
  zoneTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  zoneLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284c7',
    marginTop: 2,
  },
  zoneNotice: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 14,
    marginBottom: 6,
  },
  bioText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  hoursText: {
    fontSize: 13,
    color: '#64748b',
  },
  bookBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  bookBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  reviewRating: {
    color: '#f59e0b',
    fontSize: 12,
  },
  reviewComment: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  reviewDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
});
