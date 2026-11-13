'use strict';

const { Pool } = require('pg');

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined
}) : null;

const schema = `
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('competition', 'training', 'news')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    venue TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    organizer TEXT NOT NULL,
    discipline TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS events_starts_at_idx ON events (starts_at);
  CREATE INDEX IF NOT EXISTS events_state_idx ON events (state);
  CREATE INDEX IF NOT EXISTS events_district_idx ON events (district);
  CREATE INDEX IF NOT EXISTS events_city_idx ON events (city);
  CREATE TABLE IF NOT EXISTS event_submissions (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('competition', 'training', 'news')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    venue TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    state TEXT NOT NULL,
    organizer TEXT NOT NULL,
    discipline TEXT NOT NULL,
    source_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS contact_submissions (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const initialize = () => pool.query(schema);

const listEvents = async filters => {
  const parameters = [];
  let where = 'WHERE ends_at >= NOW()';
  if (filters.eventType) {
    parameters.push(filters.eventType);
    where += ` AND event_type = $${parameters.length}`;
  }
  if (filters.excludeEventType) {
    parameters.push(filters.excludeEventType);
    where += ` AND event_type <> $${parameters.length}`;
  }
  for (const field of ['state', 'city', 'district']) {
    if (!filters[field]) continue;
    parameters.push(filters[field]);
    where += ` AND LOWER(${field}) = LOWER($${parameters.length})`;
  }

  const [events, updated] = await Promise.all([
    pool.query(
      `SELECT id, title, event_type AS "eventType",
        starts_at AS "startsAt", ends_at AS "endsAt",
        venue, city, district, state, organizer, discipline,
        source_url AS "sourceUrl", source_name AS "sourceName",
        source_type AS "sourceType", updated_at AS "updatedAt"
       FROM events ${where} ORDER BY starts_at ASC LIMIT 100`,
      parameters
    ),
    pool.query('SELECT MAX(updated_at) AS "updatedAt" FROM events')
  ]);
  return { events: events.rows, updatedAt: updated.rows[0].updatedAt };
};

const createSubmission = async event => {
  const result = await pool.query(
    `INSERT INTO event_submissions
      (title, event_type, starts_at, ends_at, venue, city, district, state, organizer, discipline, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      event.title, event.eventType, event.startsAt, event.endsAt, event.venue,
      event.city, event.district, event.state, event.organizer,
      event.discipline, event.sourceUrl
    ]
  );
  return result.rows[0].id;
};

const listPendingSubmissions = async () => {
  const result = await pool.query(
    `SELECT id, title, event_type AS "eventType",
      starts_at AS "startsAt", ends_at AS "endsAt",
      venue, city, district, state, organizer, discipline, source_url AS "sourceUrl",
      submitted_at AS "submittedAt"
     FROM event_submissions
     WHERE status = 'pending'
     ORDER BY submitted_at ASC
     LIMIT 100`
  );
  return result.rows;
};

const reviewSubmission = async (id, action) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, title, event_type, starts_at, ends_at, venue, city, district, state, organizer,
        discipline, source_url
       FROM event_submissions
       WHERE id = $1 AND status = 'pending'
       FOR UPDATE`,
      [id]
    );
    const submission = result.rows[0];
    if (!submission) {
      await client.query('ROLLBACK');
      return false;
    }

    if (action === 'approve') {
      await client.query(
        `INSERT INTO events
          (id, title, event_type, starts_at, ends_at, venue, city, district, state, organizer,
           discipline, source_url, source_name, source_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'submission')
         ON CONFLICT (id) DO NOTHING`,
        [
          `submission-${submission.id}`, submission.title, submission.event_type,
          submission.starts_at, submission.ends_at, submission.venue, submission.city,
          submission.district, submission.state, submission.organizer, submission.discipline,
          submission.source_url, submission.organizer
        ]
      );
    }
    await client.query(
      `UPDATE event_submissions SET status = $2, reviewed_at = NOW() WHERE id = $1`,
      [id, action === 'approve' ? 'approved' : 'rejected']
    );
    await client.query('COMMIT');
    return true;
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Unable to roll back event review:', rollbackError.message);
      }
    }
    throw error;
  } finally {
    if (client) client.release();
  }
};

const saveCalendarEvents = async (feedName, imported) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of imported) {
      await client.query(
        `INSERT INTO events
          (id, title, event_type, starts_at, ends_at, venue, city, district, state,
           organizer, discipline, source_url, source_name, source_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'calendar-feed')
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title, starts_at = EXCLUDED.starts_at,
           event_type = EXCLUDED.event_type, ends_at = EXCLUDED.ends_at,
           venue = EXCLUDED.venue, city = EXCLUDED.city,
           district = EXCLUDED.district, state = EXCLUDED.state,
           organizer = EXCLUDED.organizer, discipline = EXCLUDED.discipline,
           source_url = EXCLUDED.source_url, source_name = EXCLUDED.source_name,
           updated_at = NOW()`,
        [
          item.id, item.event.title, item.event.eventType, item.event.startsAt,
          item.event.endsAt, item.event.venue, item.event.city, item.event.district,
          item.event.state, item.event.organizer, item.event.discipline,
          item.sourceUrl, feedName
        ]
      );
    }
    await client.query(
      `DELETE FROM events
       WHERE source_type = 'calendar-feed'
         AND source_name = $1
         AND NOT (id = ANY($2::text[]))`,
      [feedName, imported.map(item => item.id)]
    );
    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Unable to roll back calendar feed sync:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  initialize,
  listEvents,
  createSubmission,
  listPendingSubmissions,
  reviewSubmission,
  saveCalendarEvents
};
