'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const contactController = require('../controllers/contactController');
const { requireAdmin, requireDatabase } = require('../middleware/eventAccess');

const router = express.Router();

router.post('/contact-submissions', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: 'Too many enquiries were sent from this connection. Please try again later.' },
  standardHeaders: 'draft-8',
  legacyHeaders: false
}), requireDatabase, contactController.createSubmission);

router.get('/admin/contact-submissions.csv', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many exports were requested. Please try again later.' },
  standardHeaders: 'draft-8',
  legacyHeaders: false
}), requireDatabase, requireAdmin, contactController.exportSubmissions);

module.exports = router;
