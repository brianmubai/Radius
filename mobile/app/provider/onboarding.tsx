import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n';

export default function ProviderOnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [bio, setBio] = useState('Certified master electrician with 10 years experience in residential wiring, panel upgrades, and EV chargers.');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['electrical']);
  const [serviceRadius, setServiceRadius] = useState<number>(20);
  const [licenseNumber, setLicenseNumber] = useState('CA-ELEC-98765');
  const [uploadedDocName, setUploadedDocName] = useState<string | null>('license_cert_scan.pdf');

  const CATEGORIES = [
    { id: 'carpentry', name: 'Carpentry' },
    { id: 'mechanics', name: 'Mechanics' },
    { id: 'tree-removal', name: 'Tree Removal' },
    { id: 'landscaping', name: 'Landscaping' },
    { id: 'locksmith', name: 'Locksmith' },
    { id: 'plumbing', name: 'Plumbing' },
    { id: 'electrical', name: 'Electrical' },
    { id: 'appliance-repair', name: 'Appliance Repair' },
  ];

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleUploadLicense = async () => {
    // In live environment, calls POST /api/v1/providers/license/upload-url to receive signed S3 PUT URL
    Alert.alert(
      'Document Upload',
      'Presigned upload URL generated. License encrypted and uploaded directly to secure storage.',
      [
        {
          text: 'OK',
          onPress: () => setUploadedDocName('electrician_license_2026.pdf'),
        },
      ]
    );
  };

  const handleSubmit = () => {
    Alert.alert(
      'Application Submitted',
      t('pendingVerificationNotice'),
      [
        {
          text: 'View Job Inbox',
          onPress: () => router.replace('/provider/inbox'),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{t('proOnboardingTitle')}</Text>

        <Text style={styles.label}>{t('bioLabel')}</Text>
        <TextInput
          style={styles.textInputArea}
          value={bio}
          onChangeText={setBio}
          multiline
        />

        <Text style={styles.label}>{t('selectCategoriesLabel')}</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategories.includes(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catPill, isSelected && styles.catPillActive]}
                onPress={() => toggleCategory(cat.id)}
              >
                <Text style={[styles.catText, isSelected && styles.catTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>
          {t('serviceRadiusLabel')}: <Text style={styles.radiusVal}>{serviceRadius} km</Text>
        </Text>
        <View style={styles.radiusRow}>
          {[10, 15, 20, 30, 45].map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radBtn, serviceRadius === r && styles.radBtnActive]}
              onPress={() => setServiceRadius(r)}
            >
              <Text style={[styles.radText, serviceRadius === r && styles.radTextActive]}>
                {r} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Trade License / Certification Number</Text>
        <TextInput
          style={styles.textInput}
          value={licenseNumber}
          onChangeText={setLicenseNumber}
        />

        <View style={styles.licenseUploadCard}>
          <Text style={styles.uploadTitle}>{t('uploadLicenseTitle')}</Text>
          <Text style={styles.uploadDesc}>{t('uploadLicenseDesc')}</Text>

          {uploadedDocName ? (
            <View style={styles.docAttachedRow}>
              <Text style={styles.docAttachedText}>✓ {uploadedDocName}</Text>
              <TouchableOpacity onPress={handleUploadLicense}>
                <Text style={styles.replaceText}>Replace</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadLicense}>
              <Text style={styles.uploadBtnText}>{t('chooseFile')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>{t('submitForVerification')}</Text>
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
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  textInputArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  catText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  catTextActive: {
    color: '#ffffff',
  },
  radiusVal: {
    color: '#0284c7',
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  radBtnActive: {
    backgroundColor: '#0284c7',
  },
  radText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  radTextActive: {
    color: '#ffffff',
  },
  licenseUploadCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  uploadDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
  },
  uploadBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  uploadBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  docAttachedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 8,
  },
  docAttachedText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  replaceText: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
