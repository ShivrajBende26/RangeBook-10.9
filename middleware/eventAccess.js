'use strict';

const crypto = require('node:crypto');
const { pool } = require('../models/eventModel');

const requireDatabase = (req, res, next) => {
  if (!pool) {
    return res.status(503).json({ error: 'The database is not configured on this server.' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  const expected = process.env.ADMIN_API_KEY || '';
  const supplied = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected) {
    return res.status(503).json({ error: 'Admin access is not configured on this server.' });
  }
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return res.status(401).json({ error: 'A valid admin key is required.' });
  }
  next();
};

module.exports = { requireDatabase, requireAdmin };
