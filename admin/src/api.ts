const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('radius_admin_token') || 'mock-admin-token';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

export const AdminApi = {
  getStats: () => fetchWithAuth('/api/v1/admin/stats'),
  getVerificationQueue: () => fetchWithAuth('/api/v1/admin/verifications'),
  approveProvider: (providerId: string) =>
    fetchWithAuth(`/api/v1/admin/verifications/${providerId}/approve`, { method: 'POST' }),
  rejectProvider: (providerId: string, reason: string) =>
    fetchWithAuth(`/api/v1/admin/verifications/${providerId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  getDisputes: () => fetchWithAuth('/api/v1/admin/disputes'),
  resolveDispute: (disputeId: string, resolution: 'RESOLVED_RELEASED' | 'RESOLVED_REFUNDED', notes: string) =>
    fetchWithAuth(`/api/v1/admin/disputes/${disputeId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution, notes }),
    }),
};
