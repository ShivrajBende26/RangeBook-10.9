'use strict';

require('dotenv').config();

const app = require('./app');
const eventModel = require('./models/eventModel');
const { syncEventFeeds } = require('./services/eventFeedService');

const port = Number(process.env.PORT || 3000);

const start = async () => {
  if (eventModel.pool) {
    await eventModel.initialize();
  } else {
    console.warn('DATABASE_URL is not configured; the site will run with event APIs disabled.');
  }

  const server = app.listen(port, () => {
    console.info(`RangeBook 10.9 is listening on port ${port}.`);
    void syncEventFeeds();
    setInterval(() => void syncEventFeeds(), 6 * 60 * 60 * 1000).unref();
  });
  return server;
};

if (require.main === module) {
  start().catch(error => {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { start };
