import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/data/defaultConfig';
import { startSession, submitRound } from '../../src/domain/progression';
import { parseSession } from '../../src/services/persistence/sessionParser';
import {
  clearAllStoredData, loadActiveSessionId, loadConfig, loadSessions, MemoryStore, saveActiveSessionId, saveConfig, saveSessions, STORAGE_KEYS,
} from '../../src/services/persistence/storage';
import { cloneConfig, decision, LEGACY_ALLOCATION, NOW } from '../helpers';

const inProgressSession = () => {
  let session = startSession({ config: cloneConfig(), participantLabel: 'Sam', id: 'sess_a', now: NOW });
  session = submitRound(session, decision(1, LEGACY_ALLOCATION), NOW);
  return submitRound(session, decision(2, LEGACY_ALLOCATION), NOW);
};

const tamper = (store: MemoryStore, key: string, edit: (envelope: { data: unknown[] }) => void) => {
  const envelope = JSON.parse(store.getItem(key)!);
  edit(envelope);
  store.setItem(key, JSON.stringify(envelope));
};

describe('configuration persistence', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(loadConfig(new MemoryStore())).toEqual({ value: DEFAULT_CONFIG });
  });

  it('round-trips a saved configuration inside a versioned envelope', () => {
    const store = new MemoryStore();
    expect(saveConfig(store, cloneConfig({ annualFeePct: 1.25 }))).toEqual({ ok: true });
    expect(JSON.parse(store.getItem(STORAGE_KEYS.config)!).schemaVersion).toBe(1);
    expect(loadConfig(store).value.annualFeePct).toBe(1.25);
  });

  it('recovers from corrupted JSON with a notice', () => {
    const store = new MemoryStore();
    store.setItem(STORAGE_KEYS.config, '{not json');
    const loaded = loadConfig(store);
    expect(loaded.value).toEqual(DEFAULT_CONFIG);
    expect(loaded.notice).toMatch(/could not be read/);
  });

  it('discards data written by another schema version', () => {
    const store = new MemoryStore();
    store.setItem(STORAGE_KEYS.config, JSON.stringify({ schemaVersion: 0, data: {} }));
    expect(loadConfig(store).notice).toMatch(/different version/);
  });

  it('rejects a stored configuration that fails validation', () => {
    const store = new MemoryStore();
    store.setItem(STORAGE_KEYS.config, JSON.stringify({ schemaVersion: 1, savedAt: NOW, data: cloneConfig({ annualFeePct: 99 }) }));
    const loaded = loadConfig(store);
    expect(loaded.notice).toMatch(/failed validation/);
    expect(loaded.value.annualFeePct).toBe(DEFAULT_CONFIG.annualFeePct);
  });
});

describe('session persistence and recovery of an incomplete session', () => {
  it('restores an in-progress session exactly, and it can continue from where it stopped', () => {
    const store = new MemoryStore();
    const session = inProgressSession();
    saveSessions(store, [session]);
    saveActiveSessionId(store, session.id);

    const restored = loadSessions(store);
    expect(restored.notice).toBeUndefined();
    const [back] = restored.value;
    expect(back?.status).toBe('in_progress');
    expect(back?.results).toHaveLength(2);
    expect(back?.results[1]?.endingBalance).toBe(session.results[1]?.endingBalance);
    expect(loadActiveSessionId(store)).toBe('sess_a');

    const continued = submitRound(back!, decision(3, LEGACY_ALLOCATION), NOW);
    expect(continued.results).toHaveLength(3);
  });

  it('drops a session whose stored balance was edited', () => {
    const store = new MemoryStore();
    saveSessions(store, [inProgressSession()]);
    tamper(store, STORAGE_KEYS.sessions, (envelope) => {
      (envelope.data[0] as { results: Array<{ endingBalance: number }> }).results[0]!.endingBalance = 999999;
    });
    const loaded = loadSessions(store);
    expect(loaded.value).toHaveLength(0);
    expect(loaded.notice).toMatch(/1 saved session failed validation/);
  });

  it('keeps good sessions when another one is damaged', () => {
    const store = new MemoryStore();
    saveSessions(store, [inProgressSession()]);
    tamper(store, STORAGE_KEYS.sessions, (envelope) => envelope.data.push({ id: 'broken' }));
    const loaded = loadSessions(store);
    expect(loaded.value).toHaveLength(1);
    expect(loaded.notice).toMatch(/1 saved session failed validation/);
  });

  it('rejects inconsistent statuses', () => {
    const session = inProgressSession();
    expect(parseSession({ ...session, status: 'complete' })).toMatchObject({ ok: false, reason: 'marked complete with missing rounds' });
    expect(parseSession({ ...session, status: 'paused' })).toMatchObject({ ok: false });
  });

  it('clears everything on request', () => {
    const store = new MemoryStore();
    saveConfig(store, cloneConfig());
    saveSessions(store, [inProgressSession()]);
    saveActiveSessionId(store, 'sess_a');
    clearAllStoredData(store);
    expect(loadSessions(store).value).toEqual([]);
    expect(store.getItem(STORAGE_KEYS.config)).toBeNull();
    expect(loadActiveSessionId(store)).toBeNull();
  });

  it('reports a failed write (for example a full storage quota) instead of throwing', () => {
    const failing = { getItem: () => null, removeItem: () => undefined, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    const result = saveConfig(failing, cloneConfig());
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/QuotaExceededError/);
  });
});
