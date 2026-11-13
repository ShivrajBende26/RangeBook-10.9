'use strict';

const eventModel = require('../models/eventModel');
const { cleanText, parseEventInput } = require('../utils/eventValidation');

const supportedEventTypes = ['competition', 'training', 'news'];

const health = (req, res) => {
  res.json({ status: 'ok' });
};

const listEvents = async (req, res) => {
  const eventType = cleanText(req.query.eventType, 20);
  if (eventType && !supportedEventTypes.includes(eventType)) {
    return res.status(400).json({ error: 'Choose a supported event type.' });
  }
  const excludeEventType = cleanText(req.query.excludeEventType, 20);
  if (excludeEventType && !supportedEventTypes.includes(excludeEventType)) {
    return res.status(400).json({ error: 'Choose a supported event type.' });
  }

  const filters = {
    eventType,
    excludeEventType,
    state: cleanText(req.query.state, 100),
    city: cleanText(req.query.city, 100),
    district: cleanText(req.query.district, 100)
  };
  try {
    res.json(await eventModel.listEvents(filters));
  } catch (error) {
    console.error('Unable to load public events:', error.message);
    res.status(500).json({ error: 'Events could not be loaded right now.' });
  }
};

const createSubmission = async (req, res) => {
  const event = parseEventInput(req.body || {});
  if (!event) {
    return res.status(400).json({
      error: 'Enter complete event details and a valid HTTPS source URL.'
    });
  }

  try {
    const submissionId = await eventModel.createSubmission(event);
    res.status(201).json({
      submissionId,
      status: 'pending',
      message: 'Your event was submitted for source verification.'
    });
  } catch (error) {
    console.error('Unable to save event submission:', error.message);
    res.status(500).json({ error: 'The event could not be submitted right now.' });
  }
};

const listPendingSubmissions = async (req, res) => {
  try {
    res.json({ submissions: await eventModel.listPendingSubmissions() });
  } catch (error) {
    console.error('Unable to load event review queue:', error.message);
    res.status(500).json({ error: 'The review queue could not be loaded.' });
  }
};

const reviewSubmission = async (req, res) => {
  const id = Number(req.params.id);
  const action = req.body && req.body.action;
  if (!Number.isSafeInteger(id) || id < 1 || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Choose a valid submission and review action.' });
  }

  try {
    const found = await eventModel.reviewSubmission(id, action);
    if (!found) return res.status(404).json({ error: 'Pending submission was not found.' });
    res.json({ status: action === 'approve' ? 'approved' : 'rejected' });
  } catch (error) {
    console.error('Unable to review event submission:', error.message);
    res.status(500).json({ error: 'The submission could not be reviewed.' });
  }
};

module.exports = {
  health,
  listEvents,
  createSubmission,
  listPendingSubmissions,
  reviewSubmission
};
