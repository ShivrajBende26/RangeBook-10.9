'use strict';

const csvCell = value => {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const contactSubmissionsCsv = submissions => {
  const rows = [
    ['Submitted at', 'Name', 'Email', 'Message'],
    ...submissions.map(submission => [
      new Date(submission.submittedAt).toISOString(),
      submission.name,
      submission.email,
      submission.message
    ])
  ];
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
};

module.exports = { contactSubmissionsCsv };
