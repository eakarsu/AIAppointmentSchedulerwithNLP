import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fp from '../featurepack.js';

const rows = [
  { id: '1', title: 'Dentist checkup', description: 'Routine', location: 'Clinic', status: 'scheduled', start_time: '2999-01-01T10:00:00Z', end_time: '2999-01-01T11:00:00Z', created_at: '2026-01-01' },
  { id: '2', title: 'Dentist follow-up', description: 'Review', location: 'Clinic', status: 'cancelled', start_time: '2020-01-01T10:00:00Z', end_time: '2020-01-01T11:00:00Z', created_at: '2026-01-02' },
];

test('tasks validate, create, list-filter and update', () => {
  const store = fp.createTaskStore();
  assert.throws(() => store.create('t:u', { title: '' }), /required/);
  const saved = store.create('t:u', { title: ' Review draft ', status: 'open', linkedId: '1' });
  const updated = store.update('t:u', saved.id, { status: 'done' });
  assert.equal(updated.status, 'done');
  assert.equal(store.list('t:u', { status: 'done' }).length, 1);
  assert.equal(store.list('t:other', {}).length, 0);
  assert.equal(store.update('t:u', 'missing', { title: 'x' }), null);
});

test('search/filter and CSV/JSON export preserve values', () => {
  assert.equal(fp.filterRecords(rows, { search: 'dentist' }).length, 2);
  assert.equal(fp.filterRecords(rows, { status: 'scheduled' }).length, 1);
  assert.match(fp.recordsToCsv(rows), /Dentist checkup/);
  const json = fp.recordsToJson(rows);
  assert.equal(json.count, 2);
});

test('AI insights are domain-grounded and fallback-labelled without a key', async () => {
  const fallback = fp.buildInsights(rows);
  assert.equal(fallback.scheduleLoad.upcomingCount, 1);
  assert.equal(fallback.statusMix.scheduledCount, 1);
  assert.equal(fallback.cancellationShare.cancelledOrNoShowCount, 1);
  const result = await fp.runAiInsights({ fallback, system: 's', user: 'u', env: {}, fetchFn: async () => { throw new Error('must not be called'); } });
  assert.equal(result.aiGenerated, false);
  assert.match(result.note, /Deterministic fallback/);
  assert.deepEqual(fp.aiSections({ zero: 0, flag: false, empty: '' }).map((s) => s.lines[0]), ['0', 'false', '(empty)']);
});

test('authenticated router: tasks, records search/export, AI insights', async () => {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => req.headers.authorization === 'Bearer good' ? (req.user = { id: 'u', tenant_id: 't' }, next()) : res.status(401).json({ error: 'unauthorized' }));
  app.use('/api/featurepack', fp.createFeaturePackRouter({ listRecords: async () => rows, env: {} }));
  const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}/api/featurepack`;
  try {
    assert.equal((await fetch(`${base}/tasks`)).status, 401);
    const h = { authorization: 'Bearer good', 'content-type': 'application/json' };
    const created = await (await fetch(`${base}/tasks`, { method: 'POST', headers: h, body: JSON.stringify({ title: 'Follow up' }) })).json();
    assert.equal(created.status, 'open');
    const updated = await (await fetch(`${base}/tasks/${created.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'done' }) })).json();
    assert.equal(updated.status, 'done');
    assert.equal((await (await fetch(`${base}/records?search=dentist`, { headers: h })).json()).data.length, 2);
    assert.match(await (await fetch(`${base}/records/export?format=csv`, { headers: h })).text(), /Dentist checkup/);
    assert.equal((await (await fetch(`${base}/records/export?format=json`, { headers: h })).json()).count, 2);
    const ai = await (await fetch(`${base}/ai/insights`, { method: 'POST', headers: h, body: JSON.stringify({}) })).json();
    assert.equal(ai.aiGenerated, false); assert.ok(ai.sections.length >= 3);
  } finally { server.close(); }
});
