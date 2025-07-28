import { IS_ENCRYPTION_ENABLED, SEG_FINGERPRINT_SECRET } from '@/app/config';
import { gunzipSync } from 'fflate';

/**
 * Check if payload has encrypted structure (versioned)
 */
export const isEncrypted = (payload: any): boolean => {
  return (
    payload &&
    typeof payload === 'object' &&
    'iv' in payload &&
    'data' in payload &&
    typeof payload.iv === 'string' &&
    typeof payload.data === 'string'
  );
};

/**
 * Convert Base64 string → Uint8Array
 */
const fromBase64 = (str: string) =>
  new Uint8Array(atob(str).split('').map((c) => c.charCodeAt(0)));

/**
 * Reconstruct AES key from shared secret
 */
const getAesKey = async (): Promise<CryptoKey> => {
  const padded = SEG_FINGERPRINT_SECRET.padEnd(32, '#').slice(0, 32);
  const rawKey = new TextEncoder().encode(padded);
  return crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
};

/**
 * Decrypt + decompress AES-GCM + gzip payload
 */
export const decryptPayload = async (payload: any): Promise<any> => {
  if (!IS_ENCRYPTION_ENABLED || !isEncrypted(payload)) return payload;

  const version = payload.v ?? 1;

  try {
    if (version === 2) {
      const iv = fromBase64(payload.iv);
      const encrypted = fromBase64(payload.data);
      const key = await getAesKey();

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      const decompressed = gunzipSync(new Uint8Array(decrypted));
      return JSON.parse(new TextDecoder().decode(decompressed));
    }

    throw new Error(`Unsupported encryption version: ${version}`);
  } catch (err) {
    console.error('❌ Failed to decrypt payload:', err);
    return payload; // fallback to raw
  }
};