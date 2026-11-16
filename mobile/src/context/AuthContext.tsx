import React, { createContext, useContext, useState } from 'react';
import { setApiAuthToken } from '../api/client';

export type UserRole = 'REQUESTER' | 'PROVIDER';

interface AuthContextType {
  user: {
    id: string;
    name: string;
    phone: string;
    email: string;
    role: UserRole;
  } | null;
  activeRole: UserRole;
  switchRole: () => void;
  loginWithOtp: (destination: string, code: string, role?: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  activeRole: 'REQUESTER',
  switchRole: () => {},
  loginWithOtp: async () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('REQUESTER');
  const [user, setUser] = useState<{
    id: string;
    name: string;
    phone: string;
    email: string;
    role: UserRole;
  } | null>({
    id: 'user-demo-01',
    name: 'Sarah Connor',
    phone: '+14155550199',
    email: 'sarah@example.com',
    role: 'REQUESTER',
  });

  const switchRole = () => {
    setActiveRole((prev) => (prev === 'REQUESTER' ? 'PROVIDER' : 'REQUESTER'));
  };

  const loginWithOtp = async (destination: string, code: string, role: UserRole = activeRole) => {
    // Simulated or live API token exchange
    const mockUser = {
      id: `usr-${Date.now()}`,
      name: destination.includes('@') ? destination.split('@')[0] : 'Radius User',
      phone: destination.includes('@') ? '+14155550100' : destination,
      email: destination.includes('@') ? destination : `${destination.replace(/[^0-9]/g, '')}@radius.local`,
      role,
    };
    setUser(mockUser);
    setActiveRole(role);
    setApiAuthToken('mock-jwt-token');
  };

  const logout = () => {
    setUser(null);
    setApiAuthToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, activeRole, switchRole, loginWithOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
