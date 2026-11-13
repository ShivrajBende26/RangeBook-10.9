'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ical = require('node-ical');
const { parseEventInput } = require('./utils/eventValidation');
const { parseContactInput } = require('./utils/contactValidation');
const { contactSubmissionsCsv } = require('./utils/contactCsv');

const validEvent = {
  title: '  State Championship  ',
  eventType: 'competition',
  startsAt: '2027-01-10',
  endsAt: '2027-01-11',
  venue: 'City Sports Club',
  city: 'Pune',
  district: 'Pune',
  state: 'Maharashtra',
  organizer: 'State Association',
  discipline: 'Sport',
  sourceUrl: 'https://association.example/events/2027'
};

test('accepts a complete event with an HTTPS source and normalizes text', () => {
  const event = parseEventInput(validEvent);

  assert.ok(event);
  assert.equal(event.title, 'State Championship');
  assert.equal(event.eventType, 'competition');
  assert.equal(event.sourceUrl, validEvent.sourceUrl);
});

test('rejects events without an HTTPS public source', () => {
  assert.equal(parseEventInput({ ...validEvent, sourceUrl: 'http://example.com/event' }), null);
});

test('rejects an end date earlier than the start date', () => {
  assert.equal(
    parseEventInput({ ...validEvent, startsAt: '2027-01-12', endsAt: '2027-01-11' }),
    null
  );
});

test('rejects unknown event types and missing organizer details', () => {
  assert.equal(parseEventInput({ ...validEvent, eventType: 'other' }), null);
  assert.equal(parseEventInput({ ...validEvent, organizer: '' }), null);
  assert.equal(parseEventInput({ ...validEvent, district: '' }), null);
});

test('accepts a source-backed official news item', () => {
  assert.equal(parseEventInput({ ...validEvent, eventType: 'news' }).eventType, 'news');
});

test('parses a public iCalendar event with its date and source URL', async () => {
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:shooting-event-1',
    'DTSTART:20270110T000000Z',
    'DTEND:20270111T000000Z',
    'SUMMARY:Verified Sport Event',
    'LOCATION:Sports Venue',
    'URL:https://events.example.test/1',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const entries = await ical.async.parseICS(calendar);
  const event = Object.values(entries).find(entry => entry.type === 'VEVENT');

  assert.equal(event.summary, 'Verified Sport Event');
  assert.ok(event.start instanceof Date);
  assert.equal(event.url, 'https://events.example.test/1');
});

test('accepts and normalizes a contact enquiry', () => {
  const submission = parseContactInput({
    name: '  Test   Athlete ',
    email: ' athlete@example.com ',
    message: '  First line\r\nSecond line  '
  });

  assert.deepEqual(submission, {
    name: 'Test Athlete',
    email: 'athlete@example.com',
    message: 'First line\nSecond line'
  });
});

test('rejects invalid or oversized contact enquiries', () => {
  const submission = { name: 'Athlete', email: 'athlete@example.com', message: 'Hello' };

  assert.equal(parseContactInput({ ...submission, email: 'invalid' }), null);
  assert.equal(parseContactInput({ ...submission, name: '' }), null);
  assert.equal(parseContactInput({ ...submission, message: 'x'.repeat(5001) }), null);
});

test('contact CSV quotes fields and prevents spreadsheet formula execution', () => {
  const csv = contactSubmissionsCsv([{
    submittedAt: new Date('2026-11-13T00:00:00.000Z'),
    name: '=HYPERLINK("https://example.com")',
    email: 'athlete@example.com',
    message: 'Line one,\nLine two'
  }]);

  assert.ok(csv.startsWith('\uFEFF"Submitted at","Name","Email","Message"'));
  assert.ok(csv.includes(`"'=HYPERLINK(""https://example.com"")"`));
  assert.ok(csv.includes('"Line one,\nLine two"'));
});
