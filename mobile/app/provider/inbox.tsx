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
import { useTranslation } from '../../src/i18n';

interface JobItem {
  id: string;
  customerName: string;
  category: string;
  description: string;
  agreedAmount: number;
  status: 'BOOKED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAID_OUT';
  address: string;
  phone: string;
}

export default function ProviderInboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [jobs, setJobs] = useState<JobItem[]>([
    {
      id: 'book-901',
      customerName: 'Sarah Connor',
      category: 'Electrical',
      description: 'Breaker box keeps tripping on heat pump circuit.',
      agreedAmount: 180,
      status: 'BOOKED',
      address: '742 Evergreen Terrace, San Francisco, CA',
      phone: '+1 (415) 555-0199',
    },
    {
      id: 'book-802',
      customerName: 'Michael Chang',
      category: 'Electrical',
      description: 'Level 2 EV charger installation in garage.',
      agreedAmount: 350,
      status: 'IN_PROGRESS',
      address: '1020 Pacific Heights Blvd, San Francisco, CA',
      phone: '+1 (415) 555-0144',
    },
  ]);

  const handleUpdateStatus = (jobId: string, nextStatus: 'IN_PROGRESS' | 'COMPLETED') => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: nextStatus } : j))
    );
    Alert.alert(
      'Job Updated',
      nextStatus === 'COMPLETED'
        ? 'Job marked complete! Customer notified to confirm release of escrow payout.'
        : 'Job marked in progress.'
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.headerTitle}>Active Bookings & Inquiries</Text>

      {jobs.map((job) => (
        <View key={job.id} style={styles.jobCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.customerName}>{job.customerName}</Text>
              <Text style={styles.categorySub}>{job.category}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{job.status}</Text>
            </View>
          </View>

          <Text style={styles.description}>{job.description}</Text>

          {/* Confirmed Customer Information */}
          <View style={styles.contactCard}>
            <Text style={styles.contactLabel}>Job Location: {job.address}</Text>
            <Text style={styles.contactLabel}>Phone: {job.phone}</Text>
            <Text style={styles.contactAmount}>
              Agreed: ${job.agreedAmount.toFixed(2)} (Net Payout: ${(job.agreedAmount * 0.88).toFixed(2)})
            </Text>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.chatBtn}
              onPress={() => router.push(`/chat/${job.id}`)}
            >
              <Text style={styles.chatBtnText}>Chat</Text>
            </TouchableOpacity>

            {job.status === 'BOOKED' && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleUpdateStatus(job.id, 'IN_PROGRESS')}
              >
                <Text style={styles.actionBtnText}>Start Job</Text>
              </TouchableOpacity>
            )}

            {job.status === 'IN_PROGRESS' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
                onPress={() => handleUpdateStatus(job.id, 'COMPLETED')}
              >
                <Text style={styles.actionBtnText}>Mark Complete</Text>
              </TouchableOpacity>
            )}
          </View>
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
  jobCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  categorySub: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  description: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  contactCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  contactLabel: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 2,
  },
  contactAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chatBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chatBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtn: {
    flex: 2,
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
