import * as crypto from 'node:crypto';

export interface PresignedUrlResult {
  uploadUrl: string;
  fileKey: string;
  expiresAt: string;
}

export class StorageService {
  private static readonly SIGNING_SECRET = process.env.STORAGE_SIGNING_SECRET || 'radius-storage-secret-2026';
  private static readonly DEFAULT_EXPIRY_SEC = 15 * 60; // 15 mins

  /**
   * Generates a signed upload URL (PUT) for securely storing license documents or job photos.
   */
  public static getPresignedUploadUrl(
    userId: string,
    fileType: 'LICENSE' | 'JOB_PHOTO' | 'ID_DOCUMENT',
    fileExtension: string = 'jpg'
  ): PresignedUrlResult {
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2, 8);
    const fileKey = `${fileType.toLowerCase()}s/${userId}/${timestamp}-${nonce}.${fileExtension}`;
    const expires = Math.floor(timestamp / 1000) + this.DEFAULT_EXPIRY_SEC;

    const signature = this.generateSignature('PUT', fileKey, expires);
    const baseUrl = process.env.S3_PUBLIC_URL || 'http://localhost:4000/api/v1/storage';
    const uploadUrl = `${baseUrl}/upload?key=${encodeURIComponent(fileKey)}&expires=${expires}&sig=${signature}`;

    return {
      uploadUrl,
      fileKey,
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  }

  /**
   * Generates a signed download URL (GET) for private documents (licenses, IDs).
   */
  public static getPresignedDownloadUrl(fileKey: string, expirySeconds: number = this.DEFAULT_EXPIRY_SEC): string {
    const expires = Math.floor(Date.now() / 1000) + expirySeconds;
    const signature = this.generateSignature('GET', fileKey, expires);
    const baseUrl = process.env.S3_PUBLIC_URL || 'http://localhost:4000/api/v1/storage';

    return `${baseUrl}/download?key=${encodeURIComponent(fileKey)}&expires=${expires}&sig=${signature}`;
  }

  /**
   * Verifies an incoming signed URL request.
   */
  public static verifySignedUrl(method: string, fileKey: string, expires: number, signature: string): boolean {
    if (Math.floor(Date.now() / 1000) > expires) {
      return false; // expired
    }

    const expectedSig = this.generateSignature(method, fileKey, expires);
    return signature === expectedSig;
  }

  private static generateSignature(method: string, fileKey: string, expires: number): string {
    const stringToSign = `${method}\n${fileKey}\n${expires}`;
    return crypto
      .createHmac('sha256', this.SIGNING_SECRET)
      .update(stringToSign)
      .digest('hex');
  }
}
