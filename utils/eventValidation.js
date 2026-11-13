'use strict';

const cleanText = (value, maxLength) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';

const isHttpsUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
};

const parseEventInput = input => {
  const event = {
    title: cleanText(input.title, 180),
    eventType: input.eventType,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    venue: cleanText(input.venue, 180),
    city: cleanText(input.city, 100),
    district: cleanText(input.district, 100),
    state: cleanText(input.state, 100),
    organizer: cleanText(input.organizer, 180),
    discipline: cleanText(input.discipline, 100),
    sourceUrl: cleanText(input.sourceUrl, 2048)
  };

  if (
    !event.title ||
    !['competition', 'training', 'news'].includes(event.eventType) ||
    !event.venue ||
    !event.city ||
    !event.district ||
    !event.state ||
    !event.organizer ||
    !event.discipline ||
    !Number.isFinite(event.startsAt.getTime()) ||
    !Number.isFinite(event.endsAt.getTime()) ||
    event.endsAt < event.startsAt ||
    !isHttpsUrl(event.sourceUrl)
  ) {
    return null;
  }
  return event;
};

module.exports = { cleanText, isHttpsUrl, parseEventInput };
