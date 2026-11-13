'use strict';

const contactModel = require('../models/contactModel');
const { contactSubmissionsCsv } = require('../utils/contactCsv');
const { parseContactInput } = require('../utils/contactValidation');

const createSubmission = async (req, res) => {
  const submission = parseContactInput(req.body || {});
  if (!submission) {
    return res.status(400).json({
      error: 'Enter a name, a valid email address, and a message of up to 5,000 characters.'
    });
  }

  try {
    const submissionId = await contactModel.createSubmission(submission);
    res.status(201).json({
      submissionId,
      message: 'Thank you. Your enquiry has been saved, and our team will follow up by email.'
    });
  } catch (error) {
    console.error('Unable to save contact enquiry:', error.message);
    res.status(500).json({ error: 'Your enquiry could not be saved right now. Please try again.' });
  }
};

const exportSubmissions = async (req, res) => {
  try {
    const submissions = await contactModel.listSubmissions();
    const csv = contactSubmissionsCsv(submissions);
    res.set({
      'Cache-Control': 'no-store',
      'Content-Disposition': 'attachment; filename="contact-enquiries.csv"',
      'Content-Type': 'text/csv; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(csv);
  } catch (error) {
    console.error('Unable to export contact enquiries:', error.message);
    res.status(500).json({ error: 'Contact enquiries could not be exported right now.' });
  }
};

module.exports = { createSubmission, exportSubmissions };
