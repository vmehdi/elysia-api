import { IS_ENCRYPTION_ENABLED, SEG_FINGERPRINT_SECRET } from '@/app/config';

/**
 * Check if the given payload has an encrypted structure
 */
export const isEncrypted = (payload: any): boolean => {
  return payload && typeof payload === 'object' && 'iv' in payload && 'data' in payload;
};

/**
 * Reconstruct AES key from shared secret
 */
const getAesKey = async (): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const rawKey = enc.encode(SEG_FINGERPRINT_SECRET.padEnd(32, '#').slice(0, 32));
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
};

/**
 * Decrypts an encrypted payload using AES-GCM
 */
export const decryptPayload = async (encrypted: any): Promise<any> => {
  if (!IS_ENCRYPTION_ENABLED || !isEncrypted(encrypted)) return encrypted;

  try {
    const { iv, data } = encrypted;
    const key = await getAesKey();

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('❌ Failed to decrypt payload:', error);
    return encrypted; // Fallback to raw if decryption fails
  }
};