import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, setPassword, getPassword, clearPassword, clearKeyCache, PASSWORD_STORAGE_KEY, SALT_STORAGE_KEY_PREFIX } from './crypto.ts';

const password = 'テスト用パスワード 🔑';

beforeEach((t) => {
  const entries = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: (key) => entries.delete(key),
    },
  });
  clearKeyCache();
  t.after(() => {
    clearKeyCache();
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
});

test('UTF-8 and empty text round-trip with fresh IVs and a shared encryption salt', async () => {
  for (const text of ['# 秘密のメモ\n\n絵文字 🔐\u0000', '']) {
    const first = await encrypt(text, password);
    const second = await encrypt(text, password);
    assert.ok(first instanceof Uint8Array);
    assert.equal(first.length, 45 + new TextEncoder().encode(text).length);
    assert.equal(first[0], 1);
    assert.deepEqual(first.slice(1, 17), second.slice(1, 17));
    assert.notDeepEqual(first.slice(17, 29), second.slice(17, 29));
    assert.equal(await decrypt(first, password), text);
    assert.equal(await decrypt(second, password), text);
  }
});

test('encryption and decryption reuse keys; cold concurrent decryptions share derivation', async (t) => {
  clearKeyCache();
  const imports = t.mock.method(crypto.subtle, 'importKey');
  const [first, second] = await Promise.all([encrypt('first', password), encrypt('second', password)]);
  assert.equal(imports.mock.callCount(), 1);
  assert.deepEqual(await Promise.all([decrypt(first, password), decrypt(second, password)]), ['first', 'second']);
  assert.equal(imports.mock.callCount(), 1);
  clearKeyCache();
  assert.deepEqual(await Promise.all([decrypt(first, password), decrypt(second, password)]), ['first', 'second']);
  assert.equal(imports.mock.callCount(), 2);
  const fresh = await encrypt('fresh', password);
  assert.deepEqual(fresh.slice(1, 17), first.slice(1, 17));
  assert.notDeepEqual(fresh.slice(17, 29), first.slice(17, 29));
  assert.equal(imports.mock.callCount(), 2);
});

test('salts survive module reloads while keys are rederived and users have separate salts', async (t) => {
  const imports = t.mock.method(crypto.subtle, 'importKey');
  const first = await encrypt('first', password, 'did:plc:alice');
  const stored = localStorage.getItem(SALT_STORAGE_KEY_PREFIX + 'did:plc:alice');
  assert.match(stored, /^[0-9a-f]{32}$/);
  assert.equal(getPassword(), null); // Explicit passwords are never persisted.
  const reloaded = await import('./crypto.ts?reload');
  const second = await reloaded.encrypt('second', password, 'did:plc:alice');
  assert.deepEqual(first.slice(1, 17), second.slice(1, 17));
  assert.notDeepEqual(first.slice(17, 29), second.slice(17, 29));
  assert.equal(imports.mock.callCount(), 2);
  assert.equal(await reloaded.decrypt(first, password), 'first');
  assert.equal(imports.mock.callCount(), 2);
  const other = await reloaded.encrypt('other', password, 'did:plc:bob');
  assert.notDeepEqual(first.slice(1, 17), other.slice(1, 17));
  assert.equal(await decrypt(other, password), 'other');
  reloaded.clearKeyCache();
});

test('password changes rotate the user salt; clearing passwords or keys preserves salts', async () => {
  const user = 'did:plc:alice';
  setPassword(password, user);
  const first = await encrypt('old', undefined, user);
  const oldSalt = localStorage.getItem(SALT_STORAGE_KEY_PREFIX + user);
  setPassword(password, user);
  assert.equal(localStorage.getItem(SALT_STORAGE_KEY_PREFIX + user), oldSalt);
  setPassword('new password', user);
  const second = await encrypt('new', undefined, user);
  assert.notDeepEqual(first.slice(1, 17), second.slice(1, 17));
  const newSalt = localStorage.getItem(SALT_STORAGE_KEY_PREFIX + user);
  clearPassword();
  clearKeyCache();
  assert.equal(localStorage.getItem(SALT_STORAGE_KEY_PREFIX + user), newSalt);
  assert.equal(await decrypt(first, password), 'old');
  assert.equal(await decrypt(second, 'new password'), 'new');
});

test('missing or corrupt persisted salts are regenerated without preventing old data decryption', async () => {
  const first = await encrypt('old', password);
  localStorage.setItem(SALT_STORAGE_KEY_PREFIX + 'default', 'broken');
  const second = await encrypt('new', password);
  assert.notDeepEqual(first.slice(1, 17), second.slice(1, 17));
  assert.match(localStorage.getItem(SALT_STORAGE_KEY_PREFIX + 'default'), /^[0-9a-f]{32}$/);
  clearKeyCache();
  assert.equal(await decrypt(first, password), 'old');
  assert.equal(await decrypt(second, password), 'new');
});

test('password switches discard cached keys and failed derivations can retry', async (t) => {
  clearKeyCache();
  const encrypted = await encrypt('secret', password);
  const imports = t.mock.method(crypto.subtle, 'importKey');
  await assert.rejects(decrypt(encrypted, 'wrong password'));
  assert.equal(await decrypt(encrypted, password), 'secret');
  assert.equal(imports.mock.callCount(), 2);
  clearKeyCache();
  imports.mock.mockImplementationOnce(() => Promise.reject(new Error('import failed')));
  await assert.rejects(decrypt(encrypted, password), /import failed/);
  assert.equal(await decrypt(encrypted, password), 'secret');
  assert.equal(imports.mock.callCount(), 4);
});

test('wrong passwords and modifications to salt, IV, ciphertext, or tag are rejected', async () => {
  const encrypted = await encrypt('secret', password);
  await assert.rejects(decrypt(encrypted, 'wrong password'));
  for (const index of [1, 17, 29, encrypted.length - 1]) {
    const modified = encrypted.slice();
    modified[index] ^= 1;
    await assert.rejects(decrypt(modified, password));
  }
  await assert.rejects(decrypt(encrypted.slice(0, -1), password));
});

test('invalid formats and empty passwords are rejected', async () => {
  await assert.rejects(decrypt(new Uint8Array(44), password), /暗号化形式/);
  await assert.rejects(decrypt(new Uint8Array(45).fill(2), password), /暗号化形式/);
  await assert.rejects(encrypt('secret', ''), /パスワード/);
});

test('stored passwords are used by default and can be replaced or cleared', async (t) => {
  const entries = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: (key) => entries.delete(key),
    },
  });
  try {
    assert.equal(getPassword(), null);
    await assert.rejects(encrypt('secret'), /パスワード/);
    assert.throws(() => setPassword(''), /パスワード/);
    setPassword(password);
    const imports = t.mock.method(crypto.subtle, 'importKey');
    assert.equal(entries.get(PASSWORD_STORAGE_KEY), password);
    const encrypted = await encrypt('stored password');
    assert.equal(await decrypt(encrypted), 'stored password');
    assert.equal(imports.mock.callCount(), 1);
    setPassword(password);
    assert.equal(await decrypt(encrypted), 'stored password');
    assert.equal(imports.mock.callCount(), 2);
    setPassword('replacement');
    await assert.rejects(decrypt(encrypted));
    clearPassword();
    assert.equal(getPassword(), null);
    await assert.rejects(decrypt(encrypted), /パスワード/);
    assert.equal(await decrypt(encrypted, password), 'stored password');
    assert.equal(imports.mock.callCount(), 4);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
