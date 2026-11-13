'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const contactController = require('./contactController');
const contactModel = require('../models/contactModel');

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

test('valid contact enquiry is saved and returns a confirmation', async t => {
  const originalCreateSubmission = contactModel.createSubmission;
  let savedSubmission;
  contactModel.createSubmission = async submission => {
    savedSubmission = submission;
    return 17;
  };
  t.after(() => {
    contactModel.createSubmission = originalCreateSubmission;
  });

  const response = createResponse();
  await contactController.createSubmission({
    body: { name: ' Athlete ', email: 'athlete@example.com', message: ' Please contact me. ' }
  }, response);

  assert.deepEqual(savedSubmission, {
    name: 'Athlete',
    email: 'athlete@example.com',
    message: 'Please contact me.'
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.submissionId, 17);
});

test('invalid contact enquiry is rejected without saving', async t => {
  const originalCreateSubmission = contactModel.createSubmission;
  let saved = false;
  contactModel.createSubmission = async () => {
    saved = true;
  };
  t.after(() => {
    contactModel.createSubmission = originalCreateSubmission;
  });

  const response = createResponse();
  await contactController.createSubmission({
    body: { name: 'Athlete', email: 'not-an-email', message: 'Hello' }
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(saved, false);
});
