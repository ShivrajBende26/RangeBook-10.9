'use strict';

const formatEventDate = (startValue, endValue) => {
  const options = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' };
  const formatter = new Intl.DateTimeFormat('en-IN', options);
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'Date to be confirmed';
  const first = formatter.format(start);
  return first === formatter.format(end) ? first : `${first} – ${formatter.format(end)}`;
};

const makeElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};

const makeEventCard = event => {
  const card = makeElement('article', 'service-card event-card');
  const type = event.eventType === 'training'
    ? 'TRAINING EVENT'
    : event.eventType === 'news'
      ? 'SPORT UPDATE'
      : 'COMPETITION';
  card.append(makeElement('span', 'service-card__index', `${type} / ${event.state}`));
  card.append(makeElement('h3', '', event.title));
  card.append(makeElement('p', 'event-card__date', formatEventDate(event.startsAt, event.endsAt)));
  card.append(makeElement('p', '', `${event.venue} · ${event.city}, ${event.district} district, ${event.state} · ${event.organizer}`));
  card.append(makeElement('p', 'event-card__discipline', event.discipline));

  if (typeof event.sourceUrl === 'string' && event.sourceUrl.startsWith('https://')) {
    const link = makeElement('a', 'card-link', 'Check source details ↗');
    link.href = event.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    card.append(link);
  }
  return card;
};

let activeEventFilters = {};
const loadEvents = async filters => {
  const lists = document.querySelectorAll('[data-events-list]');
  if (!lists.length) return;
  if (filters) activeEventFilters = filters;

  const updatedLabel = document.querySelector('[data-events-updated]');
  try {
    let updatedAt = null;
    await Promise.all([...lists].map(async list => {
      const query = new URLSearchParams();
      Object.entries(activeEventFilters).forEach(([key, value]) => {
        if (value) query.set(key, value);
      });
      if (list.dataset.eventType) query.set('eventType', list.dataset.eventType);
      if (list.dataset.excludeEventType) query.set('excludeEventType', list.dataset.excludeEventType);
      const queryString = query.toString();
      const response = await fetch(`/api/events${queryString ? `?${queryString}` : ''}`, {
        headers: { Accept: 'application/json' }
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.error || 'Events are unavailable.');
        error.status = response.status;
        throw error;
      }
      if (!Array.isArray(data.events)) throw new Error('The events API returned an invalid response.');
      if (data.updatedAt) updatedAt = data.updatedAt;
      list.replaceChildren();
      if (!data.events.length) {
        const empty = makeElement('article', 'service-card event-empty');
        const newsList = list.dataset.eventType === 'news';
        empty.append(makeElement('span', 'service-card__index', newsList ? 'VERIFIED UPDATES' : 'VERIFIED EVENTS'));
        empty.append(makeElement('h3', '', newsList ? 'No verified updates listed yet' : 'No upcoming events listed yet'));
        empty.append(makeElement('p', '', 'Check official notices or submit an event with its source link for review.'));
        const notices = makeElement('a', 'card-link', 'Open NRAI notices ↗');
        notices.href = 'https://www.thenrai.in/Archieves.aspx';
        notices.target = '_blank';
        notices.rel = 'noopener noreferrer';
        empty.append(notices);
        list.append(empty);
        return;
      }
      data.events.forEach(event => list.append(makeEventCard(event)));
    }));
    if (updatedLabel) {
      updatedLabel.textContent = updatedAt
        ? `Last event update: ${formatEventDate(updatedAt, updatedAt)}`
        : 'No event updates have been recorded yet.';
    }
  } catch (error) {
    const databaseUnavailable = error.status === 503;
    if (updatedLabel) {
      updatedLabel.textContent = databaseUnavailable
        ? 'Event listings require a PostgreSQL database; the rest of the site is available.'
        : 'Live event listings are available when the site is connected to its events service.';
    }
    if (databaseUnavailable) {
      console.warn('Event listings require a configured PostgreSQL database:', error.message);
    } else {
      console.error('Unable to load event listings:', error.message);
    }
  }
};

document.querySelectorAll('[data-event-filter]').forEach(form => {
  form.addEventListener('submit', event => {
    event.preventDefault();
    const filters = Object.fromEntries(new FormData(form).entries());
    void loadEvents(filters);
  });
});

document.querySelectorAll('[data-event-submission]').forEach(form => {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const status = form.querySelector('[data-form-status]');
    const submitButton = form.querySelector('[type="submit"]');
    const payload = Object.fromEntries(new FormData(form).entries());
    if (submitButton) submitButton.disabled = true;
    if (status) status.textContent = 'Submitting for review…';

    try {
      const response = await fetch('/api/event-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) {
        const error = new Error(result.error || 'The event could not be submitted.');
        error.status = response.status;
        throw error;
      }
      form.reset();
      if (status) status.textContent = result.message;
    } catch (error) {
      if (status) {
        status.textContent = error.status === 503
          ? 'Event submissions require a configured PostgreSQL database.'
          : `${error.message} The event API must be running to accept submissions.`;
      }
      if (error.status === 503) {
        console.warn('Event submissions require a configured PostgreSQL database:', error.message);
      } else {
        console.error('Unable to submit event:', error.message);
      }
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
});

const adminForm = document.querySelector('[data-event-admin]');
if (adminForm) {
  let adminKey = '';
  const queue = document.querySelector('[data-review-queue]');
  const status = document.querySelector('[data-admin-status]');
  const contactExportButton = document.querySelector('[data-contact-export]');
  const contactExportStatus = document.querySelector('[data-contact-export-status]');

  const loadQueue = async () => {
    const response = await fetch('/api/admin/submissions', {
      headers: { Authorization: `Bearer ${adminKey}`, Accept: 'application/json' }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The review queue could not be loaded.');
    queue.replaceChildren();
    if (!data.submissions.length) {
      queue.append(makeElement('p', 'event-admin__empty', 'There are no pending submissions.'));
      return;
    }

    data.submissions.forEach(submission => {
      const item = makeElement('article', 'event-admin__item');
      item.append(makeElement('h2', '', submission.title));
      item.append(makeElement(
        'p',
        '',
        `${formatEventDate(submission.startsAt, submission.endsAt)} · ${submission.venue}, ${submission.city}, ${submission.district} district, ${submission.state}`
      ));
      item.append(makeElement('p', '', `${submission.eventType} · ${submission.discipline} · ${submission.organizer}`));
      const source = makeElement('a', 'text-link', 'Open source ↗');
      source.href = submission.sourceUrl;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      item.append(source);

      const actions = makeElement('div', 'event-admin__actions');
      ['approve', 'reject'].forEach(action => {
        const button = makeElement('button', 'button button--dark', action === 'approve' ? 'Approve' : 'Reject');
        button.type = 'button';
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const response = await fetch(`/api/admin/submissions/${submission.id}/review`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${adminKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
              },
              body: JSON.stringify({ action })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'The event could not be reviewed.');
            await loadQueue();
          } catch (error) {
            if (status) status.textContent = error.message;
            button.disabled = false;
          }
        });
        actions.append(button);
      });
      item.append(actions);
      queue.append(item);
    });
  };

  adminForm.addEventListener('submit', async event => {
    event.preventDefault();
    adminKey = String(new FormData(adminForm).get('adminKey') || '');
    if (status) status.textContent = 'Loading pending submissions…';
    try {
      await loadQueue();
      if (contactExportButton) contactExportButton.disabled = false;
      if (status) status.textContent = 'Review event sources before approval, or download contact enquiries for follow-up.';
    } catch (error) {
      if (status) status.textContent = error.message;
      console.error('Unable to access event review queue:', error.message);
    }
  });

  contactExportButton?.addEventListener('click', async () => {
    if (!adminKey) {
      if (contactExportStatus) contactExportStatus.textContent = 'Verify the admin key first.';
      return;
    }

    contactExportButton.disabled = true;
    if (contactExportStatus) contactExportStatus.textContent = 'Preparing contact enquiries…';
    try {
      const response = await fetch('/api/admin/contact-submissions.csv', {
        headers: { Authorization: `Bearer ${adminKey}`, Accept: 'text/csv, application/json' }
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Contact enquiries could not be exported.');
      }
      const url = URL.createObjectURL(await response.blob());
      const download = document.createElement('a');
      download.href = url;
      download.download = 'contact-enquiries.csv';
      download.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (contactExportStatus) contactExportStatus.textContent = 'Downloaded contact-enquiries.csv. Open it in Excel.';
    } catch (error) {
      if (contactExportStatus) contactExportStatus.textContent = error.message;
      console.error('Unable to export contact enquiries:', error.message);
    } finally {
      contactExportButton.disabled = false;
    }
  });
}

void loadEvents();
if (document.querySelector('[data-events-list]')) {
  window.setInterval(() => void loadEvents(), 15 * 60 * 1000);
}
