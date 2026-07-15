import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDataRights } from '../worker/src/routes/dataRights.js';
import { enforceRetention, retentionStatements, RETENTION_DAYS } from '../worker/src/lib/retention.js';

function request(method = 'DELETE', headers = {}) {
  return new Request('https://worker.example/api/data', { method, headers });
}

function createDb() {
  const prepared = [];
  return {
    prepared,
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        }
      };
      prepared.push(statement);
      return statement;
    },
    async batch(statements) {
      return statements.map((_, index) => ({ meta: { changes: index + 1 } }));
    }
  };
}

test('data deletion requires the anonymous browser capability', async () => {
  const response = await handleDataRights(request(), { DB: createDb() }, new URL('https://worker.example/api/data'));
  assert.equal(response.status, 401);
});

test('data deletion scopes every delete to the capability owner hash', async () => {
  const DB = createDb();
  const response = await handleDataRights(request('DELETE', {
    'X-AITracker-Client-ID': 'client-identifier-1234',
    'X-AITracker-Client-Secret': 'a'.repeat(48)
  }), { DB }, new URL('https://worker.example/api/data'));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(DB.prepared.length, 5);
  assert.ok(DB.prepared.every((statement) => statement.values.length === 1));
  assert.ok(DB.prepared.every((statement) => statement.values[0] === DB.prepared[0].values[0]));
  assert.ok(DB.prepared.every((statement) => !statement.sql.includes('DROP')));
});

test('retention uses documented cutoffs and removes dependent interview rows first', async () => {
  const now = new Date('2026-07-16T00:00:00.000Z');
  const statements = retentionStatements(now);

  assert.equal(RETENTION_DAYS.operationalEvents, 30);
  assert.equal(RETENTION_DAYS.feedback, 180);
  assert.equal(RETENTION_DAYS.interviewArchives, 365);
  assert.deepEqual(statements.map(({ name }) => name), [
    'operational_events',
    'feedback',
    'expired_interview_turns',
    'expired_live_sessions',
    'interview_archives'
  ]);
  assert.equal(statements[0].cutoff, '2026-06-16T00:00:00.000Z');

  const DB = createDb();
  await enforceRetention({ DB }, now);
  assert.equal(DB.prepared.length, 5);
});
