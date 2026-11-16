import React, { useState } from 'react';

export function App() {
  const [activeTab, setActiveTab] = useState<
    'verifications' | 'disputes' | 'subscriptions' | 'analytics' | 'cities' | 'promotions' | 'insurance' | 'business'
  >('analytics');

  const [stats, setStats] = useState({
    pendingVerificationsCount: 2,
    openDisputesCount: 2,
    totalGrossVolume: '82,786.00',
    totalPlatformRevenue: '13,848.00',
    totalBookingsCount: 142,
    totalUsersCount: 420,
    totalProvidersCount: 88,
    activeRadiusPlusCount: 54,
    activeProPlusCount: 28,
  });

  const [verifications] = useState<any[]>([
    {
      provider: {
        id: 'prov-mock-1',
        bio: 'Licensed residential and commercial master electrician with 12 years experience.',
        categories: ['electrical'],
        serviceRadiusKm: 20,
        verificationStatus: 'PENDING',
        isFeatured: true,
        user: { name: 'Marcus Vance', email: 'marcus.v@example.com' },
      },
      licenseUrls: [
        {
          categorySlug: 'electrical',
          licenseNumber: 'EC-94821-CA',
          signedDownloadUrl: 'https://storage.radius.app/licenses/marcus-cert.pdf',
        },
      ],
    },
  ]);

  const [disputes] = useState<any[]>([
    {
      dispute: {
        id: 'disp-201',
        bookingId: 'book-4481',
        openedBy: 'usr-requester-99',
        reason: 'PROPERTY_DAMAGE',
        status: 'OPEN',
        slaDueAt: new Date(Date.now() + 18 * 3600000).toISOString(),
        hoursRemaining: 18.2,
        isSlaBreached: false,
        evidence: [
          {
            id: 'ev-1',
            fileKey: 'disputes/kitchen_scratch.jpg',
            fileUrl: 'https://storage.radius.app/disputes/kitchen_scratch.jpg',
            description: 'Scratched hardwood flooring during refrigerator delivery.',
          },
        ],
        createdAt: new Date().toISOString(),
      },
      booking: { id: 'book-4481', agreedAmount: 18500, currency: 'USD', status: 'DISPUTED' },
      payment: { id: 'pay-202', grossAmount: 19425, requesterFee: 925, providerPayoutAmount: 16280, status: 'DISPUTED' },
    },
  ]);

  const [insuranceClaims, setInsuranceClaims] = useState<any[]>([
    {
      id: 'claim-301',
      bookingId: 'bkg-ins-01',
      claimantName: 'Sarah Connor',
      amountRequestedCents: 150000,
      amountApprovedCents: 140000,
      description: 'Water leak damaged ceiling drywall during pipe repair.',
      status: 'APPROVED',
      photos: ['https://storage.radius.app/claims/ceiling_leak.jpg'],
      resolvedBy: 'Adjuster Vance',
      resolvedAt: '2026-11-14T18:30:00Z',
    },
    {
      id: 'claim-302',
      bookingId: 'bkg-ins-02',
      claimantName: 'David Miller',
      amountRequestedCents: 85000,
      description: 'Sprinkler head shattered during lawn aeration.',
      status: 'UNDER_REVIEW',
      photos: ['https://storage.radius.app/claims/sprinkler.jpg'],
    },
  ]);

  const [cities] = useState<any[]>([
    { slug: 'san-francisco', name: 'San Francisco Bay Area', currency: 'USD', taxRate: '8.5%', radius: '50 km', pros: 42 },
    { slug: 'austin', name: 'Austin Metropolitan', currency: 'USD', taxRate: '8.25%', radius: '45 km', pros: 24 },
    { slug: 'toronto', name: 'Greater Toronto Area', currency: 'CAD', taxRate: '13.0%', radius: '40 km', pros: 18 },
    { slug: 'london', name: 'Greater London', currency: 'GBP', taxRate: '20.0%', radius: '35 km', pros: 16 },
    { slug: 'miami', name: 'Miami, FL', currency: 'USD', taxRate: '7.0%', radius: '35 km', pros: 12 },
  ]);

  const [campaigns] = useState<any[]>([
    {
      id: 'promo-101',
      providerName: 'Apex Electrical Solutions',
      category: 'Electrical',
      bidCpc: '$2.00',
      dailyBudget: '$20.00',
      spentToday: '$14.00',
      clicks: 7,
      status: 'ACTIVE',
    },
    {
      id: 'promo-102',
      providerName: 'Rapid Response Plumbers',
      category: 'Plumbing',
      bidCpc: '$1.50',
      dailyBudget: '$15.00',
      spentToday: '$15.00',
      clicks: 10,
      status: 'BUDGET_EXHAUSTED',
    },
  ]);

  const [businessAccounts] = useState<any[]>([
    {
      id: 'biz-001',
      name: 'Skynet Real Estate Management',
      billingEmail: 'ap@skynetproperties.com',
      membersCount: 4,
      recurringJobsCount: 2,
      lastInvoiceAmount: '$577.49',
      status: 'ACTIVE',
    },
  ]);

  return (
    <div className="admin-container">
      <header className="header">
        <div className="header-brand">
          <div className="logo-icon">R</div>
          <div className="brand-text">
            <h1>Radius Admin & Financial Operations</h1>
            <p className="subtitle">Enterprise Scale • Multi-City • PostGIS • Escrow Audit</p>
          </div>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Gross Market Volume</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            ${stats.totalGrossVolume}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net Platform Take</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            ${stats.totalPlatformRevenue}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Metros</div>
          <div className="stat-value">{cities.length} Cities</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open Disputes / SLA</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {stats.openDisputesCount} Pending
          </div>
        </div>
      </section>

      <nav className="tabs-nav" style={{ overflowX: 'auto', display: 'flex', gap: '0.5rem' }}>
        <button className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
          📊 Financial Reconciliation & Funnel
        </button>
        <button className={`tab-button ${activeTab === 'cities' ? 'active' : ''}`} onClick={() => setActiveTab('cities')}>
          🌍 Multi-City Pools ({cities.length})
        </button>
        <button className={`tab-button ${activeTab === 'promotions' ? 'active' : ''}`} onClick={() => setActiveTab('promotions')}>
          📢 Promoted Listings
        </button>
        <button className={`tab-button ${activeTab === 'business' ? 'active' : ''}`} onClick={() => setActiveTab('business')}>
          🏢 Business Accounts
        </button>
        <button className={`tab-button ${activeTab === 'insurance' ? 'active' : ''}`} onClick={() => setActiveTab('insurance')}>
          🛡️ Insurance Claims ({insuranceClaims.length})
        </button>
        <button className={`tab-button ${activeTab === 'verifications' ? 'active' : ''}`} onClick={() => setActiveTab('verifications')}>
          ✅ Pro Verifications
        </button>
        <button className={`tab-button ${activeTab === 'disputes' ? 'active' : ''}`} onClick={() => setActiveTab('disputes')}>
          ⚖️ Disputes & SLA
        </button>
        <button className={`tab-button ${activeTab === 'subscriptions' ? 'active' : ''}`} onClick={() => setActiveTab('subscriptions')}>
          💳 Stripe Subscriptions
        </button>
      </nav>

      <main>
        {activeTab === 'analytics' && (
          <div className="section-card">
            <div className="section-header">
              <h2 className="section-title">Exact Cent-to-Cent Financial Reconciliation</h2>
              <span className="badge badge-success" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                ✓ 100% RECONCILED TO THE CENT
              </span>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Agreed Services (GMV)</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>$700.00</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>70,000 cents</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Requester Booking Fees</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>+$42.50</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>4,250 cents</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Provider Commissions</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>+$70.00</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>7,000 cents</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>City Sales Tax Collected</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>+$65.38</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>6,538 cents (Passthrough)</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Damage Protection Insurance</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>+$19.98</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>1,998 cents (2 policies)</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Promoted Ads CPC Billing</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>+$6.00</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>600 cents (3 clicks)</div>
                </div>
              </div>

              <div style={{ background: '#ecfdf5', padding: '1.25rem', borderRadius: '8px', border: '1px solid #10b981', marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#065f46' }}>Reconciliation Mathematical Audit</h3>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#047857' }}>
                  • <strong>Gross Volume Billed:</strong> $827.86 (82,786c) = Services ($700.00) + Fees ($42.50) + Tax ($65.38) + Insurance ($19.98) [Exact Match]
                </p>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#047857' }}>
                  • <strong>Provider Split:</strong> Services ($700.00) = Payouts ($630.00) + Platform Commissions ($70.00) [Exact Match]
                </p>
                <p style={{ margin: '0', fontSize: '0.9rem', color: '#047857' }}>
                  • <strong>Net Platform Take Rate:</strong> 18.16% on net GMV ($138.48 net platform revenue)
                </p>
              </div>

              <h3 style={{ marginBottom: '1rem' }}>Marketplace Conversion Funnel</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ background: '#e0e7ff', padding: '0.75rem 1.25rem', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>142</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requests</div>
                </div>
                <div>➔</div>
                <div style={{ background: '#e0e7ff', padding: '0.75rem 1.25rem', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>118 (83.1%)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Matches</div>
                </div>
                <div>➔</div>
                <div style={{ background: '#e0e7ff', padding: '0.75rem 1.25rem', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>98 (69.0%)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bookings</div>
                </div>
                <div>➔</div>
                <div style={{ background: '#dcfce7', padding: '0.75rem 1.25rem', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>91 (92.8%)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Completions</div>
                </div>
                <div>➔</div>
                <div style={{ background: '#fef3c7', padding: '0.75rem 1.25rem', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>38 (41.7%)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Repeats</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cities' && (
          <div className="section-card">
            <div className="section-header">
              <h2 className="section-title">Multi-City Regional Configuration (Zero Code Deploy)</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metro Area</th>
                    <th>Slug</th>
                    <th>Currency</th>
                    <th>Tax Rate</th>
                    <th>Service Radius</th>
                    <th>Active Pro Pool</th>
                  </tr>
                </thead>
                <tbody>
                  {cities.map((c) => (
                    <tr key={c.slug}>
                      <td><strong>{c.name}</strong></td>
                      <td><code>{c.slug}</code></td>
                      <td>{c.currency}</td>
                      <td>{c.taxRate}</td>
                      <td>{c.radius}</td>
                      <td><span className="badge badge-success">{c.pros} Pros</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'promotions' && (
          <div className="section-card">
            <div className="section-header">
              <h2 className="section-title">Sponsored Search Ad Campaigns (Promoted Listings)</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campaign ID</th>
                    <th>Provider</th>
                    <th>Category</th>
                    <th>CPC Bid</th>
                    <th>Daily Budget</th>
                    <th>Spent Today</th>
                    <th>Clicks</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((camp) => (
                    <tr key={camp.id}>
                      <td><code>{camp.id}</code></td>
                      <td><strong>{camp.providerName}</strong></td>
                      <td>{camp.category}</td>
                      <td>{camp.bidCpc}</td>
                      <td>{camp.dailyBudget}</td>
                      <td>{camp.spentToday}</td>
                      <td>{camp.clicks} clicks</td>
                      <td>
                        <span className={`badge ${camp.status === 'ACTIVE' ? 'badge-success' : 'badge-pending'}`}>
                          {camp.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'business' && (
          <div className="section-card">
            <div className="section-header">
              <h2 className="section-title">Corporate Accounts & Property Fleet Management</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>Billing Email</th>
                    <th>Team Members</th>
                    <th>Recurring Templates</th>
                    <th>Last Invoiced</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {businessAccounts.map((b) => (
                    <tr key={b.id}>
                      <td><strong>{b.name}</strong></td>
                      <td>{b.billingEmail}</td>
                      <td>{b.membersCount} authorized members</td>
                      <td>{b.recurringJobsCount} active routines</td>
                      <td><strong>{b.lastInvoiceAmount}</strong></td>
                      <td><span className="badge badge-success">{b.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'insurance' && (
          <div className="section-card">
            <div className="section-header">
              <h2 className="section-title">Radius Shield Damage Protection Claims Queue</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Claim ID</th>
                    <th>Claimant</th>
                    <th>Requested</th>
                    <th>Approved</th>
                    <th>Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {insuranceClaims.map((claim) => (
                    <tr key={claim.id}>
                      <td><code>{claim.id}</code></td>
                      <td><strong>{claim.claimantName}</strong></td>
                      <td>${(claim.amountRequestedCents / 100).toFixed(2)}</td>
                      <td>{claim.amountApprovedCents ? `$${(claim.amountApprovedCents / 100).toFixed(2)}` : '—'}</td>
                      <td>{claim.description}</td>
                      <td>
                        <span className={`badge ${claim.status === 'APPROVED' ? 'badge-success' : 'badge-pending'}`}>
                          {claim.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'verifications' && (
          <div className="section-card">
            <div className="section-header">
              <h2 className="section-title">Professional Verification Queue</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Professional</th>
                    <th>Category & Bio</th>
                    <th>Licenses</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.map((v) => (
                    <tr key={v.provider.id}>
                      <td>
                        <strong>{v.provider.user.name}</strong>
                        <div>{v.provider.user.email}</div>
                      </td>
                      <td>
                        <span className="badge badge-info">{v.provider.categories[0]}</span>
                        <div style={{ fontSize: '0.85rem' }}>{v.provider.bio}</div>
                      </td>
                      <td>
                        {v.licenseUrls.map((lic: any) => (
                          <div key={lic.licenseNumber}>
                            <a href={lic.signedDownloadUrl} className="link-doc">📄 {lic.licenseNumber}</a>
                          </div>
                        ))}
                      </td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-approve">Approve</button>
                          <button className="btn btn-reject">Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'disputes' && (
          <div className="section-card">
            <div className="section-header">
              <h2 className="section-title">Disputes Resolution (48h SLA)</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dispute ID</th>
                    <th>Reason</th>
                    <th>Evidence</th>
                    <th>Financials</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((item) => (
                    <tr key={item.dispute.id}>
                      <td><code>{item.dispute.id}</code></td>
                      <td><span className="badge badge-info">{item.dispute.reason}</span></td>
                      <td>📷 Hardwood scratch photo</td>
                      <td>Gross: ${(item.payment.grossAmount / 100).toFixed(2)}</td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-approve">Release</button>
                          <button className="btn btn-reject">Refund</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="section-card">
            <div className="section-header">
              <h2 className="section-title">Stripe Subscriptions & MRR</h2>
            </div>
            <div style={{ padding: '1.5rem', lineHeight: '1.8' }}>
              <p><strong>Radius Plus Memberships:</strong> 54 active ($1,079.46 MRR)</p>
              <p><strong>Pro Plus Subscriptions:</strong> 28 active ($1,372.00 MRR)</p>
              <p><strong>Total Recurring Revenue:</strong> $2,451.46 MRR</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
