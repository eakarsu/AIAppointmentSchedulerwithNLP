import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import express from 'express';

const require = createRequire(import.meta.url);
const { createAIWorkspaceRouter, validateFields } = require('../../aiWorkspace.cjs');

const feature = { id: 'schedule-review', title: 'Schedule review', description: 'Review a proposed schedule.' };
const completeFields = {
  input: 'Review this fictional planning draft.',
  context: 'Training-only example with no provider confirmation.',
  goal: 'Identify conflicts and evidence gaps.',
  audience: 'Operations reviewer',
  source_data: 'Illustrative observations only.',
  constraints: 'Do not book, confirm, notify, or claim consent.',
  budget: 'Existing resources only',
  deadline: '2026-12-01',
  tone: 'Professional',
  output_format: 'Summary and action plan',
};

function fixturePool() {
  const rows = [];
  return {
    rows,
    async query(text, values = []) {
      if (/^CREATE TABLE/i.test(text.trim())) return { rows: [] };
      if (/^SELECT \*/i.test(text.trim())) return { rows: rows.filter((row) => row.user_id === values[0] && row.feature === values[1]) };
      if (/^SELECT id/i.test(text.trim())) return { rows: rows.filter((row) => String(row.id) === String(values[0]) && row.user_id === values[1] && row.feature === values[2]).map(({ id }) => ({ id })) };
      if (/^INSERT/i.test(text.trim())) {
        const row = { id: rows.length + 1, user_id: values[0], feature: values[1], input: values[2], result: values[3], result_json: values[4], model: values[5], usage: values[6], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        rows.push(row); return { rows: [row] };
      }
      if (/^UPDATE/i.test(text.trim())) {
        const row = rows.find((item) => item.user_id === values[0] && item.feature === values[1] && String(item.id) === String(values[7]));
        if (!row) return { rows: [] };
        Object.assign(row, { input: values[2], result: values[3], result_json: values[4], model: values[5], usage: values[6], updated_at: new Date().toISOString() });
        return { rows: [row] };
      }
      if (/^DELETE/i.test(text.trim())) {
        const index = rows.findIndex((row) => String(row.id) === String(values[0]) && row.user_id === values[1]);
        if (index < 0) return { rows: [] };
        const [deleted] = rows.splice(index, 1); return { rows: [{ id: deleted.id }] };
      }
      throw new Error(`Unexpected SQL: ${text}`);
    },
  };
}

async function withServer({ fetchImpl, env }, run) {
  const pool = fixturePool();
  const app = express();
  app.use(express.json());
  app.use('/api/report-workspace', createAIWorkspaceRouter({
    pool,
    features: [feature],
    env,
    fetchImpl,
    authenticateToken(req, _res, next) {
      req.user = { id: 7, tenant_id: 'tenant-a' };
      next();
    },
    aiRateLimiter: (_req, _res, next) => next(),
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/report-workspace`;
  try { await run({ base, pool }); } finally { await new Promise((resolve) => server.close(resolve)); }
}

test('validateFields preserves all ten reviewed fields', () => {
  assert.deepEqual(validateFields(completeFields), completeFields);
  assert.throws(() => validateFields({ input: 'brief' }), /desired outcome/);
});

test('controlled provider fixture persists and reads a tenant-scoped report', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({
      id: 'fixture-receipt-1',
      model: 'fixture/model',
      usage: { total_tokens: 42 },
      choices: [{ message: { content: '# Readiness review\n\nThis is an advisory planning draft. No appointment was booked or confirmed.' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  await withServer({ fetchImpl, env: { OPENROUTER_API_KEY: 'fixture-not-paid', OPENROUTER_MODEL: 'fixture/model', OPENROUTER_BASE_URL: 'http://fixture.invalid/v1' } }, async ({ base, pool }) => {
    const generated = await fetch(`${base}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ feature: feature.id, fields: completeFields }) });
    assert.equal(generated.status, 200);
    const body = await generated.json();
    assert.equal(body.item.user_id, 'tenant:tenant-a:user:7');
    assert.match(body.item.result, /No appointment was booked or confirmed/);
    assert.equal(pool.rows.length, 1);
    const history = await fetch(`${base}/runs?feature=${feature.id}`);
    assert.equal(history.status, 200);
    assert.equal((await history.json()).items.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://fixture.invalid/v1/chat/completions');
    assert.match(calls[0].body.messages[0].content, /does not execute actions/);
  });
});

test('missing provider configuration fails without persisting', async () => {
  await withServer({ fetchImpl: async () => { throw new Error('provider must not be called'); }, env: {} }, async ({ base, pool }) => {
    const response = await fetch(`${base}/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ feature: feature.id, fields: completeFields }) });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /OPENROUTER_API_KEY/);
    assert.equal(pool.rows.length, 0);
  });
});
