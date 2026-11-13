'use strict';

const { pool } = require('./eventModel');

const createSubmission = async submission => {
  const result = await pool.query(
    `INSERT INTO contact_submissions (name, email, message)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [submission.name, submission.email, submission.message]
  );
  return result.rows[0].id;
};

const listSubmissions = async () => {
  const result = await pool.query(
    `SELECT name, email, message, submitted_at AS "submittedAt"
     FROM contact_submissions
     ORDER BY submitted_at DESC`
  );
  return result.rows;
};

module.exports = { createSubmission, listSubmissions };
