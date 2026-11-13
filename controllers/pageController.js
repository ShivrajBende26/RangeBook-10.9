'use strict';

const path = require('node:path');

const pages = new Set([
  'platform.html',
  'training.html',
  'courses.html',
  'marketplace.html',
  'about.html',
  'contact.html',
  'event-admin.html'
]);

const renderHome = (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));

const renderPage = (req, res, next) => {
  const page = req.params.page;
  if (!pages.has(page)) return next();
  res.render(page.slice(0, -5));
};

module.exports = { renderHome, renderPage };
