'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const eventController = require('../controllers/eventController');
const { requireAdmin, requireDatabase } = require('../middleware/eventAccess');

const router = express.Router();

router.get('/health', eventController.health);
router.get('/events', requireDatabase, eventController.listEvents);
router.post('/event-submissions', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}), requireDatabase, eventController.createSubmission);

router.use('/admin', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}));
router.get('/admin/submissions', requireDatabase, requireAdmin, eventController.listPendingSubmissions);
router.post('/admin/submissions/:id/review', requireDatabase, requireAdmin, eventController.reviewSubmission);

module.exports = router;
