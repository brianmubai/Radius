import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n';
import { useLocation } from '../src/context/LocationContext';
import { useAuth } from '../src/context/AuthContext';

interface ProviderCardData {
  id: string;
  name: string;
  category: string;
  distanceKm: number;
  ratingAvg: number;
  ratingCount: number;
  bio: string;
  approxZoneLabel: string;
  isSponsored?: boolean;
}

const CATEGORIES = [
  { id: 'all', key: 'allCategories', name: 'All' },
  { id: 'carpentry', key: 'carpentry', name: 'Carpentry' },
  { id: 'mechanics', key: 'mechanics', name: 'Mechanics' },
  { id: 'tree-removal', key: 'treeRemoval', name: 'Tree Removal' },
  { id: 'landscaping', key: 'landscaping', name: 'Landscaping' },
  { id: 'locksmith', key: 'locksmith', name: 'Locksmith' },
  { id: 'plumbing', key: 'plumbing', name: 'Plumbing' },
  { id: 'electrical', key: 'electrical', name: 'Electrical' },
  { id: 'appliance-repair', key: 'applianceRepair', name: 'Appliance' },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const { searchRadiusKm, setSearchRadiusKm, manualLocationName } = useLocation();
  const { activeRole } = useAuth();
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Seeded mock providers for the active city cluster
  const sampleProviders: ProviderCardData[] = [
    {
      id: 'prov-1',
      name: 'Dave Vance',
      category: 'electrical',
      distanceKm: 1.8,
      ratingAvg: 4.9,
      ratingCount: 38,
      bio: 'Master Electrician. EV chargers, panel upgrades, and emergency troubleshooting.',
      approxZoneLabel: 'Downtown (~750m zone)',
      isSponsored: true,
    },
    {
      id: 'prov-2',
      name: 'Sam Miller',
      category: 'locksmith',
      distanceKm: 3.2,
      ratingAvg: 4.8,
      ratingCount: 52,
      bio: '24/7 Rapid Emergency Lockout, high-security deadbolts, automotive key service.',
      approxZoneLabel: 'Mission District (~750m zone)',
    },
    {
      id: 'prov-3',
      name: 'Oak & Pine Arborists',
      category: 'tree-removal',
      distanceKm: 5.5,
      ratingAvg: 5.0,
      ratingCount: 29,
      bio: 'Hazardous tree felling, crane removal, storm damage clearing.',
      approxZoneLabel: 'Sunset (~750m zone)',
    },
    {
      id: 'prov-4',
      name: 'Carlos Mendez',
      category: 'plumbing',
      distanceKm: 6.8,
      ratingAvg: 4.7,
      ratingCount: 44,
      bio: 'Water heater replacement, sewer camera inspection, pipe leaks, drain unclogging.',
      approxZoneLabel: 'Richmond (~750m zone)',
    },
    {
      id: 'prov-5',
      name: 'Precision Mobile Mechanics',
      category: 'mechanics',
      distanceKm: 8.4,
      ratingAvg: 4.9,
      ratingCount: 61,
      bio: 'On-site mobile brake service, starters, alternators, diagnostics at your driveway.',
      approxZoneLabel: 'Marina (~750m zone)',
    },
  ];

  const filteredProviders = sampleProviders.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (p.distanceKm > searchRadiusKm) return false;
    return true;
  });

  if (activeRole === 'PROVIDER') {
    return (
      <View style={styles.proModeContainer}>
        <Text style={styles.proTitle}>Provider Workspace</Text>
        <Text style={styles.proSubtitle}>
          Manage your service offerings, licenses, and incoming jobs.
        </Text>

        <TouchableOpacity
          style={styles.proCard}
          onPress={() => router.push('/provider/onboarding')}
        >
          <Text style={styles.proCardTitle}>Profile & License Verification</Text>
          <Text style={styles.proCardDesc}>
            Upload license documentation, set working hours and your service radius.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.proCard}
          onPress={() => router.push('/provider/inbox')}
        >
          <Text style={styles.proCardTitle}>Job Inbox & Live Requests</Text>
          <Text style={styles.proCardDesc}>
            Accept instant bookings and mark milestones for payment release.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.proCard}
          onPress={() => router.push('/provider/earnings')}
        >
          <Text style={styles.proCardTitle}>Earnings & Escrow Payouts</Text>
          <Text style={styles.proCardDesc}>
            Track payouts, net revenue, and 12% commission breakdowns.
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Location Bar & Radius Selector */}
      <View style={styles.locationBar}>
        <View style={styles.locationHeader}>
          <Text style={styles.locationLabel}>Location: {manualLocationName}</Text>
          <View style={styles.viewToggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
                {t('listView')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
              onPress={() => setViewMode('map')}
            >
              <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>
                {t('mapView')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Radius Slider / Quick Buttons */}
        <View style={styles.radiusControl}>
          <Text style={styles.radiusLabel}>
            {t('searchRadius')}: <Text style={styles.radiusValue}>{searchRadiusKm} km</Text>
          </Text>
          <View style={styles.radiusButtonsRow}>
            {[5, 10, 20, 35, 50].map((radius) => (
              <TouchableOpacity
                key={radius}
                style={[
                  styles.radiusPill,
                  searchRadiusKm === radius && styles.radiusPillActive,
                ]}
                onPress={() => setSearchRadiusKm(radius)}
              >
                <Text
                  style={[
                    styles.radiusPillText,
                    searchRadiusKm === radius && styles.radiusPillTextActive,
                  ]}
                >
                  {radius} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Category Pills Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryPill,
              selectedCategory === cat.id && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === cat.id && styles.categoryTextActive,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Map View Simulation */}
      {viewMode === 'map' && (
        <View style={styles.mapContainer}>
          <Text style={styles.mapPlaceholderTitle}>Interactive PostGIS Radius Map</Text>
          <Text style={styles.mapPlaceholderDesc}>
            Centering {manualLocationName} with active {searchRadiusKm} km circle buffer.
          </Text>
          <Text style={styles.mapBadge}>
            {filteredProviders.length} Verified Providers in Area
          </Text>
        </View>
      )}

      {/* Provider Results List */}
      <View style={styles.resultsContainer}>
        {filteredProviders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {t('noProvidersFound', { radius: searchRadiusKm })}
            </Text>
          </View>
        ) : (
          filteredProviders.map((provider) => (
            <TouchableOpacity
              key={provider.id}
              style={styles.providerCard}
              onPress={() => router.push(`/provider/${provider.id}`)}
            >
              <View style={styles.cardHeader}>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    {provider.isSponsored && (
                      <View style={styles.sponsoredBadge}>
                        <Text style={styles.sponsoredText}>{t('sponsored')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.categorySubtext}>
                    {provider.category.toUpperCase()} • {t('kmDistance', { distance: provider.distanceKm })}
                  </Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingText}>★ {provider.ratingAvg.toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>({provider.ratingCount})</Text>
                </View>
              </View>

              <Text style={styles.bioText} numberOfLines={2}>
                {provider.bio}
              </Text>

              <View style={styles.cardFooter}>
                <View style={styles.approxZoneBadge}>
                  <Text style={styles.approxZoneText}>{provider.approxZoneLabel}</Text>
                </View>
                <TouchableOpacity
                  style={styles.bookBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/booking/new',
                      params: {
                        providerId: provider.id,
                        providerName: provider.name,
                        category: provider.category,
                      },
                    })
                  }
                >
                  <Text style={styles.bookBtnText}>{t('bookNow')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  locationBar: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#0284c7',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  radiusControl: {
    marginTop: 4,
  },
  radiusLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  radiusValue: {
    color: '#0284c7',
    fontWeight: '700',
  },
  radiusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  radiusPillActive: {
    backgroundColor: '#0284c7',
  },
  radiusPillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  radiusPillTextActive: {
    color: '#ffffff',
  },
  categoryScroll: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  categoryPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  mapContainer: {
    margin: 16,
    backgroundColor: '#e0f2fe',
    height: 160,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  mapPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0369a1',
  },
  mapPlaceholderDesc: {
    fontSize: 12,
    color: '#0284c7',
    marginTop: 4,
  },
  mapBadge: {
    marginTop: 10,
    backgroundColor: '#0284c7',
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resultsContainer: {
    padding: 16,
    gap: 12,
  },
  providerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  sponsoredBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sponsoredText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.5,
  },
  categorySubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b45309',
  },
  ratingCount: {
    fontSize: 11,
    color: '#b45309',
  },
  bioText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  approxZoneBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  approxZoneText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  bookBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
  proModeContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  proTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  proSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  proCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  proCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  proCardDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});
