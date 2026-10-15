import { describe, expect, it } from 'vitest';
import { activeSessionOf, createAppStore } from '../../src/app/store';
import { DEFAULT_CONFIG } from '../../src/data/defaultConfig';
import { MemoryStore, STORAGE_KEYS } from '../../src/services/persistence/storage';
import { cloneConfig, decision, EQUAL_ALLOCATION, LEGACY_ALLOCATION } from '../helpers';

let counter = 0;
const makeStore = (storage = new MemoryStore()) =>
  createAppStore({ storage, persistent: true, clock: () => '2026-01-01T00:00:00.000Z', makeId: (prefix) => `${prefix}_${(counter += 1)}` });

describe('app store', () => {
  it('starts a session, records rounds, and persists everything', () => {
    const storage = new MemoryStore();
    const store = makeStore(storage);
    const started = store.startSession('  Kai ');
    expect(started.ok).toBe(true);
    const result = store.submitDecision(decision(1, EQUAL_ALLOCATION));
    expect(result).toMatchObject({ ok: true, value: { round: 1 } });
    expect(activeSessionOf(store.getState())?.participantLabel).toBe('Kai');
    // A second store reading the same storage sees the same session: recovery after a reload.
    const reloaded = makeStore(storage);
    expect(activeSessionOf(reloaded.getState())?.results).toHaveLength(1);
    expect(reloaded.getState().resumed).toBe(true);
  });

  it('rejects a repeated submission for the same round without changing anything', () => {
    const store = makeStore();
    store.startSession('');
    store.submitDecision(decision(1, EQUAL_ALLOCATION));
    const again = store.submitDecision(decision(1, EQUAL_ALLOCATION));
    expect(again).toMatchObject({ ok: false, error: expect.stringMatching(/round 2 is next/) });
    expect(activeSessionOf(store.getState())?.results).toHaveLength(1);
  });

  it('rejects submissions when no session is active', () => {
    expect(makeStore().submitDecision(decision(1, EQUAL_ALLOCATION))).toMatchObject({ ok: false });
  });

  it('starting a new session abandons the unfinished one instead of deleting it', () => {
    const store = makeStore();
    const first = store.startSession('A');
    store.startSession('B');
    const sessions = store.getState().sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions.find((s) => first.ok && s.id === first.value.id)?.status).toBe('abandoned');
  });

  it('saves only valid configurations, and new sessions use the saved one', () => {
    const store = makeStore();
    const bad = store.saveConfiguration(cloneConfig({ annualFeePct: 50 }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues?.[0]?.location?.path).toBe('annualFeePct');
    expect(store.getState().config.annualFeePct).toBe(0.5);

    expect(store.saveConfiguration(cloneConfig({ annualFeePct: 1 })).ok).toBe(true);
    const started = store.startSession('');
    expect(started.ok && started.value.config.annualFeePct).toBe(1);
  });

  it('a running session keeps its own configuration snapshot after the instructor saves changes', () => {
    const store = makeStore();
    store.startSession('');
    store.saveConfiguration(cloneConfig({ annualFeePct: 2 }));
    expect(activeSessionOf(store.getState())?.config.annualFeePct).toBe(0.5);
  });

  it('resets everything back to defaults', () => {
    const storage = new MemoryStore();
    const store = makeStore(storage);
    store.saveConfiguration(cloneConfig({ annualFeePct: 1 }));
    store.startSession('x');
    store.submitDecision(decision(1, LEGACY_ALLOCATION));
    store.resetEverything();
    expect(store.getState()).toMatchObject({ sessions: [], activeSessionId: null, config: DEFAULT_CONFIG });
    expect(storage.getItem(STORAGE_KEYS.sessions)).toBeNull();
  });

  it('surfaces storage recovery notices and save failures', () => {
    const storage = new MemoryStore();
    storage.setItem(STORAGE_KEYS.sessions, 'garbage');
    expect(makeStore(storage).getState().notices[0]?.text).toMatch(/could not be read/);

    const failing = { getItem: () => null, removeItem: () => undefined, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } };
    const store = createAppStore({ storage: failing, persistent: true });
    store.startSession('');
    expect(store.getState().saveError).toMatch(/QuotaExceededError/);
    expect(activeSessionOf(store.getState())).not.toBeNull(); // still usable in memory
  });

  it('warns when browser storage is unavailable', () => {
    const store = createAppStore({ storage: new MemoryStore(), persistent: false });
    expect(store.getState().notices.map((n) => n.id)).toContain('no-storage');
  });
});
