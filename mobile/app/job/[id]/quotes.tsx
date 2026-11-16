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
import { useTranslation } from '../../../src/i18n';

interface QuoteItem {
  id: string;
  providerId: string;
  providerName: string;
  ratingAvg: number;
  ratingCount: number;
  amountCents: number;
  note: string;
  isFeatured?: boolean;
}

export default function JobQuotesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  // Mock competitive quotes received on the job request
  const [quotes, setQuotes] = useState<QuoteItem[]>([
    {
      id: 'quote-101',
      providerId: 'prov-1',
      providerName: 'Dan Locksmith & Security',
      ratingAvg: 4.9,
      ratingCount: 38,
      amountCents: 15000,
      note: 'Available in 30 minutes. High-security cylinder replacement included.',
      isFeatured: true,
    },
    {
      id: 'quote-102',
      providerId: 'prov-2',
      providerName: 'Mission Rapid Locksmith',
      ratingAvg: 4.7,
      ratingCount: 22,
      amountCents: 13500,
      note: 'Can be there within an hour. Standard lock rekey.',
      isFeatured: false,
    },
    {
      id: 'quote-103',
      providerId: 'prov-3',
      providerName: 'Bay Area Master Lock',
      ratingAvg: 5.0,
      ratingCount: 45,
      amountCents: 17500,
      note: 'Licensed master locksmith. 100% satisfaction guarantee.',
      isFeatured: false,
    },
  ]);

  const handleAcceptQuote = (quote: QuoteItem) => {
    Alert.alert(
      'Accept Quote & Hold Funds',
      `Accept quote from ${quote.providerName} for $${(quote.amountCents / 100).toFixed(2)}? Competing quotes will expire automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept & Hold Escrow',
          onPress: () => {
            const mockBookingId = `book-${quote.id.replace('quote-', '')}`;
            router.replace({
              pathname: `/booking/${mockBookingId}`,
              params: {
                providerName: quote.providerName,
                agreedAmount: (quote.amountCents / 100).toFixed(2),
                grossAmount: ((quote.amountCents * 1.05) / 100).toFixed(2),
              },
            });
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Quotes Received ({quotes.length})</Text>
      <Text style={styles.subtitle}>
        Compare competitive bids from local verified pros. Accepting one automatically expires all others.
      </Text>

      {quotes.map((q) => (
        <View key={q.id} style={styles.quoteCard}>
          <View style={styles.cardHeader}>
            <View>
              <View style={styles.nameRow}>
                <Text style={styles.providerName}>{q.providerName}</Text>
                {q.isFeatured && (
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredText}>PRO PLUS</Text>
                  </View>
                )}
              </View>
              <Text style={styles.ratingText}>★ {q.ratingAvg.toFixed(1)} ({q.ratingCount} reviews)</Text>
            </View>
            <Text style={styles.quotePrice}>${(q.amountCents / 100).toFixed(2)}</Text>
          </View>

          <Text style={styles.quoteNote}>"{q.note}"</Text>

          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => handleAcceptQuote(q)}
          >
            <Text style={styles.acceptBtnText}>Accept Quote & Hold Escrow</Text>
          </TouchableOpacity>
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 18,
  },
  quoteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  featuredBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  featuredText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
  },
  ratingText: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 2,
  },
  quotePrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0284c7',
  },
  quoteNote: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    fontStyle: 'italic',
    marginVertical: 10,
  },
  acceptBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  acceptBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
