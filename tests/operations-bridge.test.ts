import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBridge } from '../src/server/operations-admin/bridge';
import { seedState } from '../src/operations/lib/operations/model';
const scope = 'test-scope';
const req = (body: unknown) =>
  new Request('https://internal/bridge', { method: 'POST', body: JSON.stringify(body) });
test('Vercel cannot initialize a missing workspace from browser-supplied seed data', async () => {
  const calls: string[] = [];
  const db = {
    rpc: async (name: string) => {
      calls.push(name);
      return { data: { workspace: null } };
    },
  };
  const r = await handleBridge(req({ action: 'load', initial: seedState() }), db, scope);
  assert.equal(r.status, 400);
  assert.deepEqual(calls, ['gmz_ops_snapshot']);
});
test('Vercel retains fingerprint conflict checks before writes', async () => {
  const state = seedState('2026-09-17');
  const calls: string[] = [];
  const db = {
    rpc: async (name: string) => {
      calls.push(name);
      return {
        data: {
          workspace: { state, version: 3 },
          fingerprint: 'current',
          clients: [],
          properties: [],
        },
      };
    },
  };
  const r = await handleBridge(
    req({
      action: 'save',
      version: 2,
      fingerprint: 'stale',
      command: { type: 'client', value: {} },
    }),
    db,
    scope,
  );
  assert.equal(r.status, 409);
  assert.deepEqual(calls, ['gmz_ops_snapshot']);
});
