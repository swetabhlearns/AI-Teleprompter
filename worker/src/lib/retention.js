const RETENTION_DAYS = Object.freeze({
  operationalEvents: 30,
  feedback: 180,
  interviewArchives: 365
});

export function retentionStatements(now = new Date()) {
  const cutoff = (days) => new Date(now.getTime() - (days * 24 * 60 * 60 * 1000)).toISOString();
  return [
    {
      name: 'operational_events',
      sql: 'DELETE FROM beta_events WHERE received_at < ?',
      cutoff: cutoff(RETENTION_DAYS.operationalEvents)
    },
    {
      name: 'feedback',
      sql: 'DELETE FROM beta_feedback WHERE received_at < ?',
      cutoff: cutoff(RETENTION_DAYS.feedback)
    },
    {
      name: 'expired_interview_turns',
      sql: `
        DELETE FROM interview_live_turns
        WHERE session_id IN (
          SELECT id FROM interview_live_sessions
          WHERE archive_session_id IN (
            SELECT id FROM interview_sessions WHERE updated_at < ?
          )
        )
      `,
      cutoff: cutoff(RETENTION_DAYS.interviewArchives)
    },
    {
      name: 'expired_live_sessions',
      sql: `
        DELETE FROM interview_live_sessions
        WHERE archive_session_id IN (
          SELECT id FROM interview_sessions WHERE updated_at < ?
        )
      `,
      cutoff: cutoff(RETENTION_DAYS.interviewArchives)
    },
    {
      name: 'interview_archives',
      sql: 'DELETE FROM interview_sessions WHERE updated_at < ?',
      cutoff: cutoff(RETENTION_DAYS.interviewArchives)
    }
  ];
}

export async function enforceRetention(env, now = new Date()) {
  if (!env?.DB?.prepare || !env?.DB?.batch) throw new Error('D1 binding DB is not configured.');
  const statements = retentionStatements(now);
  const results = await env.DB.batch(statements.map((statement) => (
    env.DB.prepare(statement.sql).bind(statement.cutoff)
  )));

  console.log(JSON.stringify({
    message: 'retention_completed',
    policies: statements.map((statement, index) => ({
      name: statement.name,
      cutoff: statement.cutoff,
      changes: results[index]?.meta?.changes || 0
    }))
  }));
}

export { RETENTION_DAYS };
