import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, get, set, update, serverTimestamp, runTransaction } from 'firebase/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { durableTransaction } from '../src/transactions';

let env: RulesTestEnvironment;
let now: number;
const email = 'first.last@addu.edu.ph';
const group = 'group-1';
const base = 'sessions/session-1';
function player(verified = true, address = email, uid = 'rep-1') { return env.authenticatedContext(uid, { email: address, email_verified: verified }).database(); }
function host() { return env.authenticatedContext('host', { email: 'rsegundo@addu.edu.ph', email_verified: true }).database(); }
function payload(overrides: Record<string, unknown> = {}) { return { uid: 'rep-1', deviceId: 'device-1', choice: 0, elapsedMs: 100, receivedAt: serverTimestamp(), ...overrides }; }

beforeAll(async () => {
  const [host, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9015').split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-rizalgame', database: { host, port: Number(port), rules: readFileSync('database.rules.json', 'utf8') } });
}, 30_000);
beforeEach(async () => {
  now = Date.now();
  await env.withSecurityRulesDisabled(async ctx => set(ref(ctx.database()), {
    controllers: {},
    questions: { q1: { correctIndex: 0 } },
    roster: { 'first,last@addu,edu,ph': { email, groupId: group } },
    lobby: { title: 'Test', sessionId: 'session-1' },
    sessions: { 'session-1': {
      public: { mode: 'round', currentRoundId: 'round-1', groups: { [group]: { name: 'Group 1' } }, rounds: { 'round-1': { state: 'open', choices: ['A', 'B'], opensAt: now - 1000, closesAt: now + 19_000, acceptsUntil: now + 21_000 } } },
      leases: { [group]: { uid: 'rep-1', deviceId: 'device-1', expiresAt: now + 60_000 } },
    } },
  }));
});
afterAll(async () => { await env?.cleanup(); });

describe('roles and private data', () => {
  it('lets the display read public data but never answer keys, rosters, or answers', async () => {
    const db = env.unauthenticatedContext().database();
    await assertSucceeds(get(ref(db, `${base}/public`)));
    await assertFails(get(ref(db, 'questions')));
    await assertFails(get(ref(db, 'roster')));
    await assertFails(get(ref(db, `${base}/submissions`)));
    await assertFails(set(ref(db, `${base}/public/mode`), 'ended'));
  });
  it('allows only the exact verified whitelist entry and never host self-promotion', async () => {
    await assertSucceeds(get(ref(player(), 'roster/first,last@addu,edu,ph')));
    await assertFails(get(ref(player(false), 'roster/first,last@addu,edu,ph')));
    await assertFails(get(ref(player(true, 'other@addu.edu.ph'), 'roster/first,last@addu,edu,ph')));
    await assertFails(get(ref(player(), 'questions')));
    await assertFails(set(ref(player(), 'adminUsers/rep-1'), true));
    await assertFails(set(ref(host(), 'adminUsers/another'), true));
  });
  it('allows the host to manage questions and atomically finalize a session', async () => {
    await assertSucceeds(set(ref(host(), 'questions/q2'), { correctIndex: 1 }));
    const db = host();
    const finalized = await durableTransaction<any>(db, base, data => {
      if (!data || data.public.rounds['round-1'].state === 'finalized') return undefined;
      data.public.rounds['round-1'].state = 'finalized';
      data.public.results = { 'round-1': { points: 1000 } };
      return data;
    });
    expect(finalized).toBe(true);
    const duplicate = await durableTransaction<any>(db, base, data => data?.public.rounds['round-1'].state === 'finalized' ? undefined : data);
    expect(duplicate).toBe(false);
  });
});

describe('device seat', () => {
  it('renews the same device but rejects an occupied second device and another group', async () => {
    await assertSucceeds(set(ref(player(), `${base}/leases/${group}`), { uid: 'rep-1', deviceId: 'device-1', expiresAt: now + 60_000 }));
    await assertFails(set(ref(player(), `${base}/leases/${group}`), { uid: 'rep-1', deviceId: 'device-2', expiresAt: now + 60_000 }));
    await assertFails(set(ref(player(), `${base}/leases/group-2`), { uid: 'rep-1', deviceId: 'device-1', expiresAt: now + 60_000 }));
    await assertFails(set(ref(player(true, 'other@addu.edu.ph'), `${base}/leases/${group}`), { uid: 'rep-1', deviceId: 'device-1', expiresAt: now + 60_000 }));
  });
  it('allows a new phone after the host releases the seat', async () => {
    await assertSucceeds(set(ref(host(), `${base}/leases/${group}`), null));
    await assertSucceeds(set(ref(player(), `${base}/leases/${group}`), { uid: 'rep-1', deviceId: 'device-2', expiresAt: now + 60_000 }));
    await assertFails(set(ref(player(), `${base}/submissions/round-1/${group}`), payload()));
  });
});

describe('immutable, in-window submissions', () => {
  it('accepts a valid first answer and rejects edits, deletions, duplicates, and score writes', async () => {
    const node = ref(player(), `${base}/submissions/round-1/${group}`);
    await assertSucceeds(set(node, payload()));
    await assertFails(set(node, payload({ choice: 1 })));
    await assertFails(update(node, { choice: 1 }));
    await assertFails(set(node, null));
    await assertFails(set(ref(player(), `${base}/public/results/round-1`), { points: 1000 }));
  });
  it.each([
    { choice: 2 }, { choice: 0.5 }, { elapsedMs: -1 }, { elapsedMs: 20_000 },
    { elapsedMs: 19_000 }, { uid: 'other-user' }, { deviceId: 'other-device' },
    { receivedAt: 123 }, { extra: true },
  ])('rejects malformed or forged fields: %j', async overrides => {
    await assertFails(set(ref(player(), `${base}/submissions/round-1/${group}`), payload(overrides)));
  });
  it('rejects unauthorized and unverified accounts', async () => {
    await assertFails(set(ref(player(false), `${base}/submissions/round-1/${group}`), payload()));
    await assertFails(set(ref(player(true, 'other@addu.edu.ph'), `${base}/submissions/round-1/${group}`), payload()));
  });
  it('rejects old rounds, finalized rounds, premature submissions, and expired transport grace', async () => {
    await assertFails(set(ref(player(), `${base}/submissions/old-round/${group}`), payload()));
    await set(ref(host(), `${base}/public/rounds/round-1/state`), 'finalized');
    await assertFails(set(ref(player(), `${base}/submissions/round-1/${group}`), payload()));
    await update(ref(host(), `${base}/public/rounds/round-1`), { state: 'open', opensAt: now + 100_000 });
    await assertFails(set(ref(player(), `${base}/submissions/round-1/${group}`), payload()));
    await update(ref(host(), `${base}/public/rounds/round-1`), { opensAt: now - 30_000, acceptsUntil: now - 1000 });
    await assertFails(set(ref(player(), `${base}/submissions/round-1/${group}`), payload()));
  });
  it('accepts an in-time tap arriving during the fixed grace period', async () => {
    await update(ref(host(), `${base}/public/rounds/round-1`), { opensAt: now - 20_500, closesAt: now - 500, acceptsUntil: now + 1500 });
    await assertSucceeds(set(ref(player(), `${base}/submissions/round-1/${group}`), payload({ elapsedMs: 19_900 })));
  });
});
