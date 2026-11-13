'use strict';

const crypto = require('node:crypto');
const ical = require('node-ical');
const eventModel = require('../models/eventModel');
const { cleanText, isHttpsUrl, parseEventInput } = require('../utils/eventValidation');

const parseFeeds = () => {
  const configured = process.env.EVENT_FEEDS || '[]';
  let feeds;
  try {
    feeds = JSON.parse(configured);
  } catch {
    throw new Error('EVENT_FEEDS must be a JSON array.');
  }
  if (!Array.isArray(feeds)) throw new Error('EVENT_FEEDS must be a JSON array.');
  const parsed = feeds.map(feed => {
    if (
      !feed ||
      !cleanText(feed.name, 120) ||
      !isHttpsUrl(feed.url) ||
      !isHttpsUrl(feed.sourceUrl) ||
      !['competition', 'training', 'news'].includes(feed.eventType || 'competition')
    ) {
      throw new Error('Each event feed needs a name, HTTPS calendar URL, HTTPS source page, and valid event type.');
    }
    return {
      name: cleanText(feed.name, 120),
      url: new URL(feed.url).toString(),
      sourceUrl: new URL(feed.sourceUrl).toString(),
      city: cleanText(feed.city, 100),
      district: cleanText(feed.district, 100),
      state: cleanText(feed.state, 100),
      eventType: feed.eventType || 'competition'
    };
  });
  if (new Set(parsed.map(feed => feed.name.toLowerCase())).size !== parsed.length) {
    throw new Error('Each event feed must have a unique name.');
  }
  return parsed;
};

const fetchCalendar = async feed => {
  const response = await fetch(feed.url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${feed.name} returned HTTP ${response.status}.`);
  const calendar = await response.text();
  if (Buffer.byteLength(calendar, 'utf8') > 2 * 1024 * 1024) {
    throw new Error(`${feed.name} calendar is larger than 2 MB.`);
  }
  if (!calendar.includes('BEGIN:VCALENDAR')) {
    throw new Error(`${feed.name} did not return an iCalendar feed.`);
  }

  const entries = await ical.async.parseICS(calendar);
  const imported = [];
  for (const [uid, entry] of Object.entries(entries)) {
    if (entry.type !== 'VEVENT' || !entry.start || !entry.end) continue;
    const event = parseEventInput({
      title: entry.summary,
      eventType: feed.eventType,
      startsAt: entry.start,
      endsAt: entry.end,
      venue: entry.location || 'Venue to be confirmed',
      city: entry.city || feed.city || 'To be confirmed',
      district: entry.district || feed.district || 'To be confirmed',
      state: entry.state || feed.state || 'To be confirmed',
      organizer: feed.name,
      discipline: entry.categories ? [].concat(entry.categories).join(', ') : 'Shooting sport',
      sourceUrl: isHttpsUrl(entry.url) ? entry.url : feed.sourceUrl
    });
    if (!event) continue;
    const id = crypto.createHash('sha256').update(`${feed.url}:${entry.uid || uid}`).digest('hex');
    imported.push({ id, event, sourceUrl: event.sourceUrl });
  }

  if (!imported.length) throw new Error(`${feed.name} contained no valid event entries.`);
  await eventModel.saveCalendarEvents(feed.name, imported);
};

let syncing = false;
const syncEventFeeds = async () => {
  if (!eventModel.pool) {
    console.info('DATABASE_URL is not configured; event feeds are not being imported.');
    return;
  }
  if (syncing) return;
  syncing = true;
  try {
    const feeds = parseFeeds();
    for (const feed of feeds) {
      try {
        await fetchCalendar(feed);
      } catch (error) {
        console.error(`Event feed sync failed for ${feed.name}:`, error.message);
      }
    }
    if (!feeds.length) console.info('No EVENT_FEEDS configured; organizer submissions remain available.');
  } catch (error) {
    console.error('Event feed configuration error:', error.message);
  } finally {
    syncing = false;
  }
};

module.exports = { parseFeeds, fetchCalendar, syncEventFeeds };
