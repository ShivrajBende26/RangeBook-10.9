'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pug = require('pug');
const pageController = require('./controllers/pageController');

const viewsDirectory = path.join(__dirname, 'views');
const publicDirectory = path.join(__dirname, 'public');

test('all Pug views render complete pages with the public stylesheet', () => {
  const views = fs.readdirSync(viewsDirectory).filter(file => file.endsWith('.pug'));
  assert.ok(views.length > 0, 'Pug view templates should exist');

  for (const view of views) {
    const html = pug.renderFile(path.join(viewsDirectory, view));
    assert.match(html, /<!DOCTYPE html>/i, `${view} should render an HTML document`);
    assert.match(html, /href="\/css\/style\.css"/, `${view} should load the public stylesheet`);
    assert.doesNotMatch(
      html,
      /(?:coach|athlete|venue|NRAI)\?s|Let\?s|We\?re|We\?d|journey\?from|recovery\?alongside/,
      `${view} should not contain text damaged by character encoding`
    );
  }
});

test('homepage HTML and Pug views preserve Unicode punctuation and symbols', () => {
  const render = view => pug.renderFile(path.join(viewsDirectory, view));
  const home = fs.readFileSync(path.join(publicDirectory, 'index.html'), 'utf8');
  const contact = render('contact.pug');
  const marketplace = render('marketplace.pug');

  assert.ok(home.includes('PREPARE \u00B7 PRACTICE \u00B7 PERFORM'));
  assert.ok(home.includes('\u2190'));
  assert.ok(contact.includes('Let\u2019s talk'));
  assert.ok(contact.includes('\u00A9'));
  assert.ok(marketplace.includes('\u20B999'));
});

test('homepage overview is editable HTML in public and links to site pages', () => {
  const html = fs.readFileSync(path.join(publicDirectory, 'index.html'), 'utf8');

  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /href="\/css\/style\.css"/);
  assert.match(html, /src="\/js\/script\.js"/);
  for (const page of ['platform.html', 'training.html', 'courses.html', 'marketplace.html', 'about.html', 'contact.html']) {
    assert.ok(html.includes(`href="${page}"`), `homepage should link to ${page}`);
  }
});

test('homepage route serves the public HTML overview', () => {
  let servedFile;
  pageController.renderHome({}, { sendFile: file => { servedFile = file; } });
  assert.equal(servedFile, path.join(publicDirectory, 'index.html'));
});

test('contact form submits enquiries to the database endpoint', () => {
  const html = pug.renderFile(path.join(viewsDirectory, 'contact.pug'));

  assert.match(html, /data-contact-form/);
  assert.match(html, /name="name"/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="message"/);
  assert.doesNotMatch(html, /data-mailto-form|data-webmail-fallback/);
  assert.doesNotMatch(html, /mailto:/);

  const homepage = fs.readFileSync(path.join(publicDirectory, 'index.html'), 'utf8');
  assert.doesNotMatch(homepage, /mailto:/);
});

test('admin page provides a protected Excel-compatible contact export', () => {
  const html = pug.renderFile(path.join(viewsDirectory, 'event-admin.pug'));

  assert.match(html, /data-contact-export disabled/);
  assert.match(html, /opens in Excel/);
});

test('page routes render their Pug view while preserving the .html URL', () => {
  let renderedView;
  pageController.renderPage(
    { params: { page: 'courses.html' } },
    { render: view => { renderedView = view; } },
    () => assert.fail('A supported page should not fall through')
  );
  assert.equal(renderedView, 'courses');
});
