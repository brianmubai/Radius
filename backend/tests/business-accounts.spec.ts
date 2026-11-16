import { describe, it, expect } from './test-utils.ts';
import { BusinessService } from '../src/modules/business/business.service.ts';
import { db } from '../src/db/in-memory-db.ts';
import type { Booking, Payment, User } from '../../../types/src/index.ts';

describe('BusinessAccounts & RecurringMaintenance — Corporate Fleet & Consolidated Invoicing', () => {
  BusinessService.reset();
  db.reset();

  const ownerUser: User = {
    id: 'usr-biz-owner',
    role: 'REQUESTER',
    name: 'Sarah Connor (Property Lead)',
    phone: '+14155550190',
    email: 'sarah@skynetproperties.com',
    locale: 'en',
    createdAt: new Date().toISOString(),
  };
  db.users.set(ownerUser.id, ownerUser);

  it('creates business account with owner member and consolidated billing flag', () => {
    const account = BusinessService.createBusinessAccount({
      companyName: 'Skynet Real Estate Management',
      ownerUserId: ownerUser.id,
      billingEmail: 'ap@skynetproperties.com',
      taxId: 'US-94-1234567',
    });

    expect(account.id).toBeDefined();
    expect(account.companyName).toBe('Skynet Real Estate Management');
    expect(account.members.length).toBe(1);
    expect(account.members[0].role).toBe('OWNER');
    expect(account.consolidatedBilling).toBe(true);
  });

  it('allows owner or manager to add team members with specific roles', () => {
    const account = Array.from(BusinessService.businessAccounts.values())[0];

    const managerMember = BusinessService.addMember({
      businessAccountId: account.id,
      name: 'John Connor',
      email: 'john@skynetproperties.com',
      role: 'MANAGER',
      requesterUserId: ownerUser.id,
    });

    expect(managerMember.userId).toBeDefined();
    expect(managerMember.role).toBe('MANAGER');
    expect(account.members.length).toBe(2);

    // Manager invites a field technician/member
    const technicianMember = BusinessService.addMember({
      businessAccountId: account.id,
      name: 'Kyle Reese',
      email: 'kyle@skynetproperties.com',
      role: 'MEMBER',
      requesterUserId: managerMember.userId,
    });

    expect(technicianMember.role).toBe('MEMBER');
    expect(account.members.length).toBe(3);
  });

  it('prohibits ordinary members from inviting new users', () => {
    const account = Array.from(BusinessService.businessAccounts.values())[0];
    const member = account.members.find((m) => m.role === 'MEMBER')!;

    expect(() => {
      BusinessService.addMember({
        businessAccountId: account.id,
        name: 'Infiltrator',
        email: 'infiltrator@example.com',
        role: 'MEMBER',
        requesterUserId: member.userId,
      });
    }).toThrow('Only the account owner or manager can invite new team members');
  });

  it('creates recurring maintenance templates for portfolio properties', () => {
    const account = Array.from(BusinessService.businessAccounts.values())[0];

    const template = BusinessService.createRecurringTemplate({
      businessAccountId: account.id,
      categoryId: 'landscaping',
      title: 'Bi-Weekly Commercial Turf & Shrub Maintenance',
      description: 'Mowing, edging, and irrigation check for 200 Mission St facility',
      frequency: 'BIWEEKLY',
      location: { latitude: 37.7915, longitude: -122.3995 },
      exactAddress: '200 Mission St, San Francisco, CA 94105',
      budgetCapCents: 45000, // $450 cap
      requesterUserId: ownerUser.id,
    });

    expect(template.id).toBeDefined();
    expect(template.frequency).toBe('BIWEEKLY');
    expect(template.budgetCapCents).toBe(45000);
    expect(template.isActive).toBe(true);
  });

  it('generates consolidated monthly invoice across all completed bookings for the business fleet', () => {
    const account = Array.from(BusinessService.businessAccounts.values())[0];
    const managerId = account.members.find((m) => m.role === 'MANAGER')!.userId;
    const memberId = account.members.find((m) => m.role === 'MEMBER')!.userId;

    const pastDate = new Date(Date.now() - 5 * 86400000).toISOString();

    // Create 2 completed bookings under the business account
    const booking1: Booking = {
      id: 'bkg-biz-01',
      jobRequestId: 'job-biz-01',
      providerId: 'pro-biz-01',
      requesterId: managerId,
      citySlug: 'san-francisco',
      businessAccountId: account.id,
      agreedAmount: 30000, // $300.00
      currency: 'USD',
      status: 'PAID_OUT',
      createdAt: pastDate,
      updatedAt: pastDate,
    };

    const payment1: Payment = {
      id: 'pay-biz-01',
      bookingId: booking1.id,
      requesterFee: 1500,
      providerCommission: 3600,
      taxAmount: 2550, // 8.5%
      insuranceFee: 999,
      grossAmount: 35049, // 30000 + 1500 + 2550 + 999
      providerPayoutAmount: 26400,
      currency: 'USD',
      status: 'RELEASED',
      createdAt: pastDate,
    };

    const booking2: Booking = {
      id: 'bkg-biz-02',
      jobRequestId: 'job-biz-02',
      providerId: 'pro-biz-02',
      requesterId: memberId,
      citySlug: 'san-francisco',
      businessAccountId: account.id,
      agreedAmount: 20000, // $200.00
      currency: 'USD',
      status: 'COMPLETED',
      createdAt: pastDate,
      updatedAt: pastDate,
    };

    const payment2: Payment = {
      id: 'pay-biz-02',
      bookingId: booking2.id,
      requesterFee: 1000,
      providerCommission: 2400,
      taxAmount: 1700,
      insuranceFee: 0,
      grossAmount: 22700,
      providerPayoutAmount: 17600,
      currency: 'USD',
      status: 'HELD',
      createdAt: pastDate,
    };

    db.bookings.set(booking1.id, booking1);
    db.payments.set(payment1.id, payment1);
    db.bookings.set(booking2.id, booking2);
    db.payments.set(payment2.id, payment2);

    const invoice = BusinessService.generateMonthlyInvoice({
      businessAccountId: account.id,
      periodStart: new Date(Date.now() - 30 * 86400000).toISOString(),
      periodEnd: new Date().toISOString(),
      currency: 'USD',
    });

    expect(invoice.id).toBeDefined();
    expect(invoice.businessAccountId).toBe(account.id);
    expect(invoice.bookingIds.length).toBe(2);
    // Total gross = 35049 + 22700 = 57749 cents ($577.49)
    expect(invoice.totalAmountCents).toBe(57749);
    expect(invoice.status).toBe('ISSUED');
  });
});
