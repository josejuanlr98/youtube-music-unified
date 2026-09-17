import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { JsonDataStore } from '../src/JsonDataStore.js';

describe('JsonDataStore', () => {
  let tmpDir: string;
  let filePath: string;
  let store: JsonDataStore;

  beforeEach(() => {
    vi.useFakeTimers();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytcast-test-'));
    filePath = path.join(tmpDir, 'datastore.json');
    store = new JsonDataStore(filePath);
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for missing key', async () => {
    const result = await store.get('nonexistent');
    expect(result).toBeNull();
  });

  it('stores and retrieves a string value', async () => {
    await store.set('token', 'abc123');
    const result = await store.get<string>('token');
    expect(result).toBe('abc123');
  });

  it('stores and retrieves an object value', async () => {
    const data = { screenId: 'xyz', pairingCode: '1234' };
    await store.set('pairing', data);
    const result = await store.get<typeof data>('pairing');
    expect(result).toEqual(data);
  });

  it('persists data to disk', async () => {
    await store.set('key1', 'value1');
    await store.flush();
    const store2 = new JsonDataStore(filePath);
    const result = await store2.get<string>('key1');
    expect(result).toBe('value1');
  });

  it('overwrites existing keys', async () => {
    await store.set('key', 'old');
    await store.set('key', 'new');
    const result = await store.get<string>('key');
    expect(result).toBe('new');
  });

  it('creates parent directories if they do not exist', async () => {
    const nestedPath = path.join(tmpDir, 'a', 'b', 'c', 'store.json');
    const nestedStore = new JsonDataStore(nestedPath);
    await nestedStore.set('deep', 'value');
    await nestedStore.flush();
    const nestedStore2 = new JsonDataStore(nestedPath);
    const result = await nestedStore2.get<string>('deep');
    expect(result).toBe('value');
  });
});
