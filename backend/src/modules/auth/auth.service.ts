import * as crypto from 'node:crypto';
import type { AuthTokens, JwtPayload, User, UserRole } from '../../../../types/src/index.ts';
import { db, type OtpRecord } from '../../db/in-memory-db.ts';

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'radius-super-jwt-secret-key-2026';
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'radius-super-refresh-secret-key-2026';
  private static readonly ACCESS_TOKEN_EXPIRY_SEC = 15 * 60;
  private static readonly REFRESH_TOKEN_EXPIRY_SEC = 7 * 24 * 60 * 60;

  public static hash(value: string): string {
    return crypto.createHash('sha256').update(`radius_salt_${value}`).digest('hex');
  }

  public static sendOtp(destination: string): { destination: string; expiresAt: Date; mockCode?: string } {
    const cleanDestination = destination.trim().toLowerCase();
    const isTest = process.env.NODE_ENV === 'test' || !process.env.TWILIO_ACCOUNT_SID;
    
    const code = isTest ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = this.hash(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const record: OtpRecord = {
      id: `otp-${Date.now()}`,
      destination: cleanDestination,
      hashedCode,
      expiresAt,
      attempts: 0,
      createdAt: new Date(),
    };

    db.otpRecords.set(cleanDestination, record);

    return {
      destination: cleanDestination,
      expiresAt,
      mockCode: isTest ? code : undefined,
    };
  }

  public static verifyOtp(
    destination: string,
    code: string,
    name?: string,
    role: UserRole = 'REQUESTER'
  ): AuthTokens {
    const cleanDestination = destination.trim().toLowerCase();
    const record = db.otpRecords.get(cleanDestination);

    if (!record) {
      throw new Error('No OTP request found for this destination');
    }

    if (new Date() > record.expiresAt) {
      db.otpRecords.delete(cleanDestination);
      throw new Error('OTP code has expired');
    }

    if (record.attempts >= 5) {
      db.otpRecords.delete(cleanDestination);
      throw new Error('Too many failed attempts. Please request a new OTP.');
    }

    const hashedInput = this.hash(code.trim());
    if (hashedInput !== record.hashedCode) {
      record.attempts += 1;
      throw new Error('Invalid OTP code');
    }

    db.otpRecords.delete(cleanDestination);

    let user: User | undefined;
    for (const u of db.users.values()) {
      if (u.email === cleanDestination || u.phone === cleanDestination) {
        user = u;
        break;
      }
    }

    if (!user) {
      const isEmail = cleanDestination.includes('@');
      user = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role,
        name: name || (isEmail ? cleanDestination.split('@')[0] : 'Radius User'),
        phone: isEmail ? '+15550000000' : cleanDestination,
        email: isEmail ? cleanDestination : `${cleanDestination.replace(/[^0-9]/g, '')}@radius.local`,
        locale: 'en',
        createdAt: new Date().toISOString(),
      };
      db.users.set(user.id, user);
    }

    const accessToken = this.signToken(
      { sub: user.id, role: user.role, email: user.email, phone: user.phone },
      this.ACCESS_TOKEN_EXPIRY_SEC,
      this.JWT_SECRET
    );

    const refreshToken = this.signToken(
      { sub: user.id, role: user.role },
      this.REFRESH_TOKEN_EXPIRY_SEC,
      this.JWT_REFRESH_SECRET
    );

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  public static refreshAccessToken(refreshToken: string): { accessToken: string } {
    const payload = this.verifyToken(refreshToken, this.JWT_REFRESH_SECRET);
    const user = db.users.get(payload.sub);
    if (!user) {
      throw new Error('User not found');
    }

    const accessToken = this.signToken(
      { sub: user.id, role: user.role, email: user.email, phone: user.phone },
      this.ACCESS_TOKEN_EXPIRY_SEC,
      this.JWT_SECRET
    );

    return { accessToken };
  }

  public static sanitizeContactDetails(
    user: Partial<User>,
    isAuthorizedToViewContact: boolean
  ): Partial<User> {
    if (isAuthorizedToViewContact) {
      return { ...user };
    }

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      locale: user.locale,
      createdAt: user.createdAt,
      phone: undefined,
      email: undefined,
    };
  }

  private static signToken(payload: JwtPayload, expiresInSec: number, secret: string): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

    const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
    const b64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${b64Header}.${b64Payload}`)
      .digest('base64url');

    return `${b64Header}.${b64Payload}.${signature}`;
  }

  public static verifyToken(token: string, secret: string = this.JWT_SECRET): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed token');
    }

    const [b64Header, b64Payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${b64Header}.${b64Payload}`)
      .digest('base64url');

    if (signature !== expectedSig) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      throw new Error('Token has expired');
    }

    return payload as JwtPayload;
  }
}
