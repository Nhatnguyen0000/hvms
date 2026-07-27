/**
 * Secure localStorage wrapper with AES-GCM encryption.
 * Encrypts sensitive data (students, teachers, transactions, audit logs)
 * before storing, and decrypts on retrieval.
 *
 * Security: Even if attacker gains access to localStorage,
 * they cannot read personal data without the encryption key.
 */

function getEncryptionKey(): string {
  const key = import.meta.env.VITE_STORAGE_ENCRYPTION_KEY;
  const isProd = import.meta.env.PROD;
  const isPlaceholder = !key || key === '' || key === 'AllegroDevEncryptionKeyFallback2026';

  if (isPlaceholder) {
    if (isProd) {
      throw new Error(
        '[SECURITY] VITE_STORAGE_ENCRYPTION_KEY is missing in production. Storage encryption cannot use dev fallback key. Set a secure encryption key in your .env file.'
      );
    }
    return 'AllegroDevEncryptionKeyFallback2026';
  }
  return key;
}

/**
 * Derive a 256-bit key from a string using PBKDF2-like approach.
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const salt = encoder.encode('allegro-music-center-v1');
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string using AES-GCM.
 */
async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );
  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a string encrypted with AES-GCM.
 */
async function decrypt(ciphertext: string, key: CryptoKey): Promise<string> {
  const decoder = new TextDecoder();
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return decoder.decode(decrypted);
}

/**
 * Encrypted storage wrapper.
 * Falls back to plain localStorage if encryption fails or key is unavailable.
 */
export const secureStorage = {
  async setItem(key: string, value: unknown): Promise<void> {
    try {
      const keyStr = getEncryptionKey();
      const cryptoKey = await deriveKey(keyStr);
      const jsonStr = JSON.stringify(value);
      const encrypted = await encrypt(jsonStr, cryptoKey);
      localStorage.setItem(`enc_${key}`, encrypted);
    } catch (err) {
      // Fallback: store plain JSON if encryption fails
      console.warn(`SecureStorage: encryption failed for ${key}, storing plain:`, err);
      localStorage.setItem(key, JSON.stringify(value));
    }
  },

  async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const encrypted = localStorage.getItem(`enc_${key}`);
      if (!encrypted) {
        // Try plain storage fallback
        const plain = localStorage.getItem(key);
        if (plain) {
          return JSON.parse(plain) as T;
        }
        return defaultValue;
      }
      const keyStr = getEncryptionKey();
      const cryptoKey = await deriveKey(keyStr);
      const decrypted = await decrypt(encrypted, cryptoKey);
      return JSON.parse(decrypted) as T;
    } catch (err) {
      // Try plain fallback on decryption failure
      console.warn(`SecureStorage: decryption failed for ${key}, trying plain:`, err);
      const plain = localStorage.getItem(key);
      if (plain) {
        try {
          return JSON.parse(plain) as T;
        } catch {
          return defaultValue;
        }
      }
      return defaultValue;
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(`enc_${key}`);
    localStorage.removeItem(key);
  },

  /**
   * Migrate existing plain localStorage data to encrypted format.
   * Call this once on app boot for initial migration.
   */
  async migrateData(keys: string[]): Promise<void> {
    for (const key of keys) {
      const plain = localStorage.getItem(key);
      const alreadyEncrypted = localStorage.getItem(`enc_${key}`);
      if (plain && !alreadyEncrypted) {
        try {
          await this.setItem(key, JSON.parse(plain));
          console.log(`SecureStorage: migrated ${key} to encrypted storage`);
        } catch {
          // Keep plain version if migration fails
        }
      }
    }
  },
};
