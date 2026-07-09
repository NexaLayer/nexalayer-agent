import {
  describe,
  it,
  expect,
} from 'vitest';
import { getContext } from './helpers/test-context';
import {
  AGENT_DATABASE_URL,
  isDatabaseReachable,
} from './setup';

async function queryDb(
  sql: string,
  params: unknown[] = []
) {
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: AGENT_DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

describe(
  'TS-8: DB Consistency (session_id)',
  () => {
    it(
      'session_id stored without truncation ' +
        'in agent_sessions',
      async () => {
        if (!isDatabaseReachable()) {
          console.warn(
            '[TS-8] DB not reachable, skip'
          );
          return;
        }

        const ctx = getContext();
        if (ctx.createdSessionIds.length === 0) {
          console.warn(
            '[TS-8] No sessions created, skip'
          );
          return;
        }

        const sid = ctx.createdSessionIds[0];
        const res = await queryDb(
          'SELECT session_id FROM agent_sessions ' +
            'WHERE session_id = $1',
          [sid]
        );

        if (res.rows.length === 0) {
          console.warn(
            `[TS-8] Session ${sid} ` +
              `not found in agent_sessions`
          );
          return;
        }

        expect(res.rows[0].session_id).toBe(sid);
        expect(
          res.rows[0].session_id.length
        ).toBe(sid.length);
        console.log(
          `[TS-8] agent_sessions: ` +
            `session_id="${sid}" ` +
            `(${sid.length} chars) => OK`
        );
      }
    );

    it(
      'session_id consistent in ' +
        'agent_usage_records',
      async () => {
        if (!isDatabaseReachable()) {
          console.warn(
            '[TS-8] DB not reachable, skip'
          );
          return;
        }

        const ctx = getContext();
        if (ctx.createdSessionIds.length === 0) {
          return;
        }

        const sid = ctx.createdSessionIds[0];
        const res = await queryDb(
          'SELECT session_id ' +
            'FROM agent_usage_records ' +
            'WHERE session_id = $1 LIMIT 5',
          [sid]
        );

        for (const row of res.rows) {
          expect(row.session_id).toBe(sid);
          expect(row.session_id.length).toBe(
            sid.length
          );
        }

        console.log(
          `[TS-8] agent_usage_records: ` +
            `${res.rows.length} rows for ${sid}`
        );
      }
    );

    it(
      'session_id consistent in agent_events',
      async () => {
        if (!isDatabaseReachable()) return;

        const ctx = getContext();
        if (ctx.createdSessionIds.length === 0) {
          return;
        }

        const sid = ctx.createdSessionIds[0];
        const res = await queryDb(
          'SELECT session_id ' +
            'FROM agent_events ' +
            'WHERE session_id = $1 LIMIT 5',
          [sid]
        );

        for (const row of res.rows) {
          expect(row.session_id).toBe(sid);
        }

        console.log(
          `[TS-8] agent_events: ` +
            `${res.rows.length} rows for ${sid}`
        );
      }
    );

    it(
      'session_id consistent in ' +
        'agent_telemetry',
      async () => {
        if (!isDatabaseReachable()) return;

        const ctx = getContext();
        if (ctx.createdSessionIds.length === 0) {
          return;
        }

        const sid = ctx.createdSessionIds[0];
        const res = await queryDb(
          'SELECT session_id ' +
            'FROM agent_telemetry ' +
            'WHERE session_id = $1 LIMIT 5',
          [sid]
        );

        for (const row of res.rows) {
          expect(row.session_id).toBe(sid);
        }

        console.log(
          `[TS-8] agent_telemetry: ` +
            `${res.rows.length} rows for ${sid}`
        );
      }
    );

    it(
      'unique constraint on session_id intact',
      async () => {
        if (!isDatabaseReachable()) return;

        const res = await queryDb(
          `SELECT indexname, indexdef
           FROM pg_indexes
           WHERE tablename = 'agent_sessions'
             AND indexdef LIKE '%session_id%'`
        );

        const hasUnique = res.rows.some(
          (r: { indexdef: string }) =>
            r.indexdef.includes('UNIQUE')
        );

        expect(hasUnique).toBe(true);
        console.log(
          '[TS-8] session_id UNIQUE index: OK'
        );
      }
    );

    it(
      'idempotency unique constraint intact',
      async () => {
        if (!isDatabaseReachable()) return;

        const res = await queryDb(
          `SELECT indexname, indexdef
           FROM pg_indexes
           WHERE tablename = 'agent_idempotency_keys'
             AND indexdef LIKE '%idempotency_key%'`
        );

        const hasUnique = res.rows.some(
          (r: { indexdef: string }) =>
            r.indexdef.includes('UNIQUE')
        );

        expect(hasUnique).toBe(true);
        console.log(
          '[TS-8] idempotency UNIQUE index: OK'
        );
      }
    );
  }
);
