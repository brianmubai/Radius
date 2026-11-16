import type {
  BusinessAccount,
  BusinessMember,
  BusinessRole,
  ConsolidatedInvoice,
  GeoPoint,
  JobFrequency,
  RecurringJobTemplate,
} from '../../../../types/src/index.ts';
import { db } from '../../db/in-memory-db.ts';

export class BusinessService {
  public static businessAccounts: Map<string, BusinessAccount> = new Map();
  public static recurringTemplates: Map<string, RecurringJobTemplate> = new Map();
  public static consolidatedInvoices: Map<string, ConsolidatedInvoice> = new Map();

  public static reset(): void {
    this.businessAccounts.clear();
    this.recurringTemplates.clear();
    this.consolidatedInvoices.clear();
  }

  /**
   * Registers a new Business Account for property managers or corporate clients.
   */
  public static createBusinessAccount(params: {
    companyName: string;
    ownerUserId: string;
    billingEmail: string;
    taxId?: string;
  }): BusinessAccount {
    const { companyName, ownerUserId, billingEmail, taxId } = params;

    const owner = db.users.get(ownerUserId);
    if (!owner) {
      throw new Error(`Owner user ${ownerUserId} not found`);
    }

    const businessId = `biz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const ownerMember: BusinessMember = {
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      role: 'OWNER',
      joinedAt: new Date().toISOString(),
    };

    const account: BusinessAccount = {
      id: businessId,
      companyName,
      billingEmail,
      taxId,
      ownerId: ownerUserId,
      members: [ownerMember],
      consolidatedBilling: true,
      createdAt: new Date().toISOString(),
    };

    this.businessAccounts.set(account.id, account);

    owner.businessAccountId = account.id;
    db.users.set(owner.id, owner);

    db.logAudit('BUSINESS_ACCOUNT_CREATED', 'BUSINESS', account.id, ownerUserId, {
      companyName,
    });

    return account;
  }

  /**
   * Adds team member (property manager, operations lead) to the business account.
   */
  public static addMember(params: {
    businessAccountId: string;
    name: string;
    email: string;
    role: BusinessRole;
    requesterUserId: string;
  }): BusinessMember {
    const { businessAccountId, name, email, role, requesterUserId } = params;

    const account = this.businessAccounts.get(businessAccountId);
    if (!account) {
      throw new Error(`Business account ${businessAccountId} not found`);
    }

    const requesterMember = account.members.find((m) => m.userId === requesterUserId);
    if (!requesterMember || (requesterMember.role !== 'OWNER' && requesterMember.role !== 'MANAGER')) {
      throw new Error('Only the account owner or manager can invite new team members');
    }

    // Check if user already exists or create new user
    let user = Array.from(db.users.values()).find((u) => u.email === email.toLowerCase());
    if (!user) {
      user = {
        id: `usr-biz-${Date.now()}`,
        role: 'REQUESTER',
        name,
        email: email.toLowerCase(),
        phone: '+15559990000',
        locale: 'en',
        businessAccountId: account.id,
        createdAt: new Date().toISOString(),
      };
      db.users.set(user.id, user);
    } else {
      user.businessAccountId = account.id;
      db.users.set(user.id, user);
    }

    const newMember: BusinessMember = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role,
      joinedAt: new Date().toISOString(),
    };

    account.members.push(newMember);
    this.businessAccounts.set(account.id, account);

    db.logAudit('BUSINESS_MEMBER_ADDED', 'BUSINESS', account.id, requesterUserId, {
      addedUserId: user.id,
      role,
    });

    return newMember;
  }

  /**
   * Creates a recurring maintenance template (e.g. weekly landscaping, monthly HVAC service).
   */
  public static createRecurringTemplate(params: {
    businessAccountId: string;
    categoryId: string;
    title: string;
    description: string;
    frequency: JobFrequency;
    location: GeoPoint;
    exactAddress: string;
    budgetCapCents: number;
    preferredProviderId?: string;
  }): RecurringJobTemplate {
    const template: RecurringJobTemplate = {
      id: `tmpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...params,
      nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.recurringTemplates.set(template.id, template);

    db.logAudit('RECURRING_JOB_CREATED', 'BUSINESS', template.id, params.businessAccountId, {
      title: params.title,
      frequency: params.frequency,
    });

    return template;
  }

  /**
   * Generates consolidated invoice across all completed bookings for the business account.
   */
  public static generateConsolidatedInvoice(
    businessAccountId: string,
    periodStart: string,
    periodEnd: string
  ): ConsolidatedInvoice {
    const account = this.businessAccounts.get(businessAccountId);
    if (!account) {
      throw new Error(`Business account ${businessAccountId} not found`);
    }

    const memberIds = account.members.map((m) => m.userId);
    const completedBookings: string[] = [];
    let totalCents = 0;

    for (const b of db.bookings.values()) {
      if (
        (b.businessAccountId === businessAccountId || memberIds.includes(b.requesterId)) &&
        (b.status === 'COMPLETED' || b.status === 'PAID_OUT') &&
        b.createdAt >= periodStart &&
        b.createdAt <= periodEnd
      ) {
        completedBookings.push(b.id);
        const payment = Array.from(db.payments.values()).find((p) => p.bookingId === b.id);
        totalCents += payment ? payment.grossAmount : b.agreedAmount;
      }
    }

    const invoice: ConsolidatedInvoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      businessAccountId,
      periodStart,
      periodEnd,
      totalAmountCents: totalCents,
      currency: 'USD',
      status: 'ISSUED',
      bookingIds: completedBookings,
      createdAt: new Date().toISOString(),
    };

    this.consolidatedInvoices.set(invoice.id, invoice);

    db.logAudit('CONSOLIDATED_INVOICE_GENERATED', 'BUSINESS', invoice.id, businessAccountId, {
      totalAmountCents: totalCents,
      bookingsCount: completedBookings.length,
    });

    return invoice;
  }
}

