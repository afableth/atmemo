import { argon2id } from 'hash-wasm';

export const PASSWORD_STORAGE_KEY = 'atmemo.encryptionPassword';
export const SALT_STORAGE_KEY_PREFIX = 'atmemo.encryptionSalt.';

// v1: Argon2id (64 MiB, t=3, p=1, 32-byte key) + AES-256-GCM.
// Format: version (1 byte) | salt (16 bytes) | IV (12 bytes) | ciphertext + tag (16 bytes).
// Changing these parameters requires a new format version so old memos remain readable.
const VERSION = 1;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const HEADER_LENGTH = 1 + SALT_LENGTH + IV_LENGTH;
const TAG_LENGTH = 16;
const MAX_CACHED_KEYS = 64;

let cachedPassword: string | undefined;
const keyCache = new Map<string, Promise<CryptoKey>>();

/** Discard in-memory keys. Persisted salts remain available after reload. */
export function clearKeyCache(): void {
  cachedPassword = undefined;
  keyCache.clear();
}

function preparePassword(password: string): void {
  requirePassword(password);
  if (cachedPassword !== password) {
    clearKeyCache();
    cachedPassword = password;
  }
}

export function setPassword(password: string, userId: string = 'default'): void {
  requirePassword(password);
  if (getPassword() !== password) {
    localStorage.removeItem(SALT_STORAGE_KEY_PREFIX + userId);
  }
  localStorage.setItem(PASSWORD_STORAGE_KEY, password);
  clearKeyCache();
}

function getEncryptionSalt(userId: string): Uint8Array {
  const storageKey = SALT_STORAGE_KEY_PREFIX + userId;
  const stored = localStorage.getItem(storageKey);
  if (stored !== null && /^[0-9a-f]{32}$/.test(stored)) {
    return Uint8Array.from(stored.match(/../g)!, (byte) => Number.parseInt(byte, 16));
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  localStorage.setItem(storageKey, Array.from(salt, (byte) => byte.toString(16).padStart(2, '0')).join(''));
  return salt;
}

export function getPassword(): string | null {
  return localStorage.getItem(PASSWORD_STORAGE_KEY);
}

export function clearPassword(): void {
  localStorage.removeItem(PASSWORD_STORAGE_KEY);
  clearKeyCache();
}

function requirePassword(password: string | null = getPassword()): string {
  if (!password) throw new Error('暗号化パスワードを設定してください。');
  return password;
}

function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  preparePassword(password);
  const cacheId = Array.from(salt, (byte) => byte.toString(16).padStart(2, '0')).join('');
  let pending = keyCache.get(cacheId);
  if (pending) {
    // Refresh insertion order for LRU eviction.
    keyCache.delete(cacheId);
    keyCache.set(cacheId, pending);
    return pending;
  }
  // Cache the promise as well, so concurrent requests share the derivation.
  pending = deriveUncachedKey(password, salt).catch((error: unknown) => {
    if (keyCache.get(cacheId) === pending) keyCache.delete(cacheId);
    throw error;
  });
  keyCache.set(cacheId, pending);
  if (keyCache.size > MAX_CACHED_KEYS) keyCache.delete(keyCache.keys().next().value!);
  return pending;
}

async function deriveUncachedKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const bytes = await argon2id({
    password: requirePassword(password),
    salt,
    memorySize: 64 * 1024,
    iterations: 3,
    parallelism: 1,
    hashLength: 32,
    outputType: 'binary',
  });
  try {
    return await crypto.subtle.importKey('raw', new Uint8Array(bytes), 'AES-GCM', false, ['encrypt', 'decrypt']);
  } finally {
    bytes.fill(0);
  }
}

/** Encrypt UTF-8 text. Omitted passwords are read from localStorage. */
export async function encrypt(plaintext: string, password: string = requirePassword(), userId: string = 'default'): Promise<Uint8Array> {
  preparePassword(password);
  const salt = getEncryptionSalt(userId);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const header = new Uint8Array(HEADER_LENGTH);
  header[0] = VERSION;
  header.set(salt, 1);
  header.set(iv, 1 + SALT_LENGTH);
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: header, tagLength: TAG_LENGTH * 8 },
    key,
    new TextEncoder().encode(plaintext),
  );
  const result = new Uint8Array(HEADER_LENGTH + ciphertext.byteLength);
  result.set(header);
  result.set(new Uint8Array(ciphertext), HEADER_LENGTH);
  return result;
}

/** Decrypt v1 bytes; a wrong password or modified data rejects the promise. */
export async function decrypt(encrypted: Uint8Array, password: string = requirePassword()): Promise<string> {
  // Own the bytes before awaiting key derivation, so callers cannot mutate them mid-decryption.
  const data = new Uint8Array(encrypted);
  if (data.length < HEADER_LENGTH + TAG_LENGTH || data[0] !== VERSION) {
    throw new Error('対応していない暗号化形式、または壊れたデータです。');
  }
  const salt = data.slice(1, 1 + SALT_LENGTH);
  const iv = data.slice(1 + SALT_LENGTH, HEADER_LENGTH);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: data.slice(0, HEADER_LENGTH), tagLength: TAG_LENGTH * 8 },
    key,
    data.slice(HEADER_LENGTH),
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
}
