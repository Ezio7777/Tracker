const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const notFound = (req, _res, next) => next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));

// Postgres reports constraint problems with a short error code. These are the ones we can meet.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_ERRORS = {
  '23505': [409, 'That value already exists'], // unique violation
  '23503': [409, 'This record is linked to something that does not exist (or still depends on it)'], // foreign key
  '23001': [409, 'This record is still in use by something else'], // restrict violation
  '23514': [400, 'A value is not allowed'], // check constraint
  '23502': [400, 'A required value is missing'], // not null
  '22P02': [400, 'Invalid id or value format'], // bad uuid / number text
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message;
  let details = err.details;

  if (PG_ERRORS[err.code]) {
    [status, message] = PG_ERRORS[err.code];
    details = err.constraint ? { constraint: err.constraint } : undefined;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  if (status >= 500) {
    if (!env.isTest) console.error(err);
    if (env.isProd) message = 'Internal server error';
  }
  res.status(status).json({ error: { message, details } });
};

module.exports = { notFound, errorHandler };
