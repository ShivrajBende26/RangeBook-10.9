'use strict';

const parseContactInput = input => {
  if (!input || typeof input !== 'object') return null;

  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const message = typeof input.message === 'string'
    ? input.message.replace(/\r\n?/g, '\n').trim()
    : '';

  if (
    !name ||
    name.length > 120 ||
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !message ||
    message.length > 5000
  ) {
    return null;
  }

  return { name, email, message };
};

module.exports = { parseContactInput };
