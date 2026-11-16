export type UserRole = 'REQUESTER' | 'PROVIDER' | 'ADMIN';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type BookingStatus =
  | 'REQUESTED'
  | 'QUOTED'
  | 'BOOKED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PAID_OUT'
  | 'DISPUTED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'HELD'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED';

export type DisputeStatus =
  | 'OPEN'
  | 'RESOLVED_REFUNDED'
  | 'RESOLVED_RELEASED'
  | 'DISMISSED';

export type DisputeReason =
  | 'POOR_QUALITY'
  | 'NO_SHOW'
  | 'UNFINISHED_WORK'
  | 'PROPERTY_DAMAGE'
  | 'PRICING_DISAGREEMENT'
  | 'OFF_PLATFORM_SOLICITATION';

export type SubscriptionPlan = 'RADIUS_PLUS' | 'PRO_BASIC' | 'PRO_PLUS';

export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAST_DUE';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface ApproxZone {
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  label: string;
}

export interface WorkingHours {
  monday?: { start: string; end: string };
  tuesday?: { start: string; end: string };
  wednesday?: { start: string; end: string };
  thursday?: { start: string; end: string };
  friday?: { start: string; end: string };
  saturday?: { start: string; end: string };
  sunday?: { start: string; end: string };
}

export interface LicenseDocument {
  id: string;
  categorySlug: string;
  licenseNumber: string;
  documentUrl: string;
  expiresAt?: string;
  verified: boolean;
}

export interface User {
  id: string;
  role: UserRole;
  name: string;
  phone: string;
  email: string;
  locale: string;
  citySlug?: string;
  expoPushToken?: string;
  subscriptionPlan?: SubscriptionPlan;
  monthlyBookingsUsed?: number;
  businessAccountId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProviderProfile {
  id: string;
  userId: string;
  bio: string;
  categories: string[];
  serviceRadiusKm: number;
  citySlug: string; // Associated city pool
  workingHours: WorkingHours;
  licenses: LicenseDocument[];
  verificationStatus: VerificationStatus;
  ratingAvg: number;
  ratingCount: number;
  location: GeoPoint;
  approxZone: ApproxZone;
  isFeatured?: boolean;
  isSponsored?: boolean; // Promoted listing active
  promotedCampaignId?: string;
  subscriptionPlan?: SubscriptionPlan;
  leadCreditsBalance?: number;
  user?: Partial<User>;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  requiresLicense: boolean;
  isUrgentEligible: boolean;
  iconName?: string;
}

export interface JobRequest {
  id: string;
  requesterId: string;
  categoryId: string;
  citySlug: string;
  category?: Category;
  description: string;
  photos: string[];
  location: GeoPoint;
  exactAddress: string;
  preferredTime?: string;
  isUrgent: boolean;
  status: BookingStatus;
  quotesCount?: number;
  unlockedByProviders?: string[]; // Lead credits unlock tracking
  createdAt: string;
  updatedAt?: string;
}

export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface Quote {
  id: string;
  jobRequestId: string;
  providerId: string;
  amount: number; // minor units (cents)
  currency: string;
  note?: string;
  status: QuoteStatus;
  provider?: Partial<ProviderProfile>;
  createdAt: string;
  updatedAt?: string;
}

export interface Booking {
  id: string;
  jobRequestId: string;
  providerId: string;
  requesterId: string;
  quoteId?: string;
  citySlug: string;
  businessAccountId?: string;
  agreedAmount: number; // cents
  currency: string;
  status: BookingStatus;
  scheduledAt?: string;
  completedAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  hasDamageProtection?: boolean;
  damageProtectionFee?: number;
  createdAt: string;
  updatedAt: string;
  jobRequest?: JobRequest;
  provider?: ProviderProfile & { user?: Partial<User> };
  requester?: Partial<User>;
  payment?: Payment;
}

export interface Payment {
  id: string;
  bookingId: string;
  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  requesterFee: number;
  providerCommission: number;
  taxAmount: number; // City tax
  insuranceFee: number; // Damage protection fee
  grossAmount: number; // agreedAmount + requesterFee + taxAmount + insuranceFee
  providerPayoutAmount: number;
  currency: string;
  status: PaymentStatus;
  heldAt?: string;
  releasedAt?: string;
  refundedAt?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  targetUserId: string;
  rating: number;
  comment: string;
  isFlaggedSpam?: boolean;
  spamReason?: string;
  createdAt: string;
}

export interface DisputeEvidence {
  id: string;
  uploaderId: string;
  fileKey: string;
  fileUrl: string;
  description?: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  bookingId: string;
  openedBy: string;
  reason: DisputeReason | string;
  evidence: DisputeEvidence[];
  status: DisputeStatus;
  slaDueAt: string;
  isSlaBreached?: boolean;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  bookingId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  renewsAt: string;
  monthlyBookingsUsed: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  eventType: string;
  entityType:
    | 'PAYMENT'
    | 'DISPUTE'
    | 'BOOKING'
    | 'PROVIDER'
    | 'USER'
    | 'SUBSCRIPTION'
    | 'QUOTE'
    | 'PROMOTION'
    | 'BUSINESS'
    | 'INSURANCE'
    | 'LEAD_CREDIT';
  entityId: string;
  actorId: string;
  payload: Record<string, any>;
  createdAt: string;
}

// Multi-City Configuration
export interface CityConfig {
  id: string;
  slug: string;
  name: string;
  country: string;
  currency: string;
  timezone: string;
  defaultLocale: string;
  center: GeoPoint;
  serviceRadiusKm: number;
  taxRatePercent: number; // e.g. 0.085 for 8.5%
  feeOverrides?: {
    requesterFeePercent?: number;
    requesterFeeMinAmount?: number;
    providerCommissionPercent?: number;
    urgentSurchargeFlat?: number;
  };
  enabledCategories: string[];
}

// Promoted Listings (Sponsored Ads)
export interface PromotedListing {
  id: string;
  providerId: string;
  citySlug: string;
  categorySlug: string;
  bidCpcCents: number; // Cost-per-click bid (e.g. 150c = $1.50)
  dailyBudgetCents: number; // Daily budget (e.g. 2000c = $20.00)
  spentTodayCents: number;
  status: 'ACTIVE' | 'PAUSED' | 'BUDGET_EXHAUSTED';
  impressionsCount: number;
  clicksCount: number;
  createdAt: string;
}

export interface PromotedBillingRecord {
  id: string;
  campaignId: string;
  providerId: string;
  type: 'IMPRESSION' | 'CLICK';
  amountCents: number;
  timestamp: string;
}

// Business Accounts & Recurring Jobs
export type BusinessRole = 'OWNER' | 'MANAGER' | 'MEMBER';

export interface BusinessMember {
  userId: string;
  email: string;
  name: string;
  role: BusinessRole;
  joinedAt: string;
}

export interface BusinessAccount {
  id: string;
  companyName: string;
  billingEmail: string;
  taxId?: string;
  ownerId: string;
  members: BusinessMember[];
  paymentMethodId?: string;
  consolidatedBilling: boolean;
  createdAt: string;
}

export type JobFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY';

export interface RecurringJobTemplate {
  id: string;
  businessAccountId: string;
  categoryId: string;
  title: string;
  description: string;
  frequency: JobFrequency;
  location: GeoPoint;
  exactAddress: string;
  budgetCapCents: number;
  preferredProviderId?: string;
  nextRunAt: string;
  isActive: boolean;
  createdAt: string;
}

export interface ConsolidatedInvoice {
  id: string;
  businessAccountId: string;
  periodStart: string;
  periodEnd: string;
  totalAmountCents: number;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';
  bookingIds: string[];
  createdAt: string;
}

// Lead Credits Marketplace
export interface LeadCreditPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
}

export interface LeadCreditTransaction {
  id: string;
  providerId: string;
  type: 'PURCHASE' | 'SPEND' | 'REFUND';
  credits: number;
  jobRequestId?: string;
  balanceAfter: number;
  amountCents?: number;
  createdAt: string;
}

// Insurance & Damage Protection
export interface DamageProtectionPlan {
  id: string;
  name: string;
  coverageAmountCents: number; // e.g. 1000000 ($10,000)
  feeCents: number; // e.g. 999 ($9.99)
  description: string;
}

export interface InsuranceClaim {
  id: string;
  bookingId: string;
  claimantId: string;
  amountRequestedCents: number;
  amountApprovedCents?: number;
  description: string;
  photos: string[];
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

// Analytics & Reconciliation
export interface FunnelMetrics {
  requests: number;
  matches: number;
  quotes: number;
  bookings: number;
  completions: number;
  repeatBookings: number;
  matchRatePercent: number;
  bookingConversionPercent: number;
  completionRatePercent: number;
}

export interface ZoneLiquidity {
  citySlug: string;
  zoneLabel: string;
  requestCount: number;
  matchRatePercent: number;
  avgResponseTimeMinutes: number;
  activeProsCount: number;
}

export interface FinancialReconciliation {
  grossVolumeCents: number;
  agreedServicesCents: number;
  requesterFeesCents: number;
  providerCommissionsCents: number;
  taxCollectedCents: number;
  insuranceFeesCents: number;
  promotedAdSpendCents: number;
  providerPayoutsCents: number;
  netPlatformRevenueCents: number;
  takeRatePercent: number;
  isReconciled: boolean;
}

// Pricing & Monetization Config
export interface PricingConfig {
  requesterFeePercent: number;
  requesterFeeMinAmount: number;
  urgentSurchargeFlat: number;
  urgentSurchargePercent: number;
  providerCommissionPercent: number;
  radiusPlusFreeBookingsPerMonth: number;
  proPlusCommissionDiscountPercent: number;
  radiusPlusMonthlyFeeCents: number;
  proPlusMonthlyFeeCents: number;
}

export interface CalculateFeeParams {
  agreedAmount: number;
  currency: string;
  isUrgent: boolean;
  isUrgentEligible: boolean;
  requesterSubscription?: SubscriptionPlan;
  monthlyBookingsUsed?: number;
  providerSubscription?: SubscriptionPlan;
  cityTaxRatePercent?: number;
  hasDamageProtection?: boolean;
  damageProtectionFeeCents?: number;
  config?: Partial<PricingConfig>;
}

export interface FeeCalculationResult {
  agreedAmount: number;
  requesterBookingFee: number;
  urgentSurcharge: number;
  totalRequesterFee: number;
  taxAmount: number;
  insuranceFee: number;
  grossChargedToRequester: number;
  providerCommissionRate: number;
  providerCommissionAmount: number;
  providerPayoutAmount: number;
  currency: string;
  isFeeWaivedByRadiusPlus: boolean;
}

export interface ProviderSearchParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  citySlug?: string;
  categorySlug?: string;
  verifiedOnly?: boolean;
  minRating?: number;
  availableNow?: boolean;
}

export interface ProviderSearchResult {
  provider: ProviderProfile;
  distanceKm: number;
  searchRankScore: number;
  isSponsored?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email?: string;
  phone?: string;
}

export interface PushNotificationPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'default' | 'normal' | 'high';
  sound?: 'default' | null;
}
