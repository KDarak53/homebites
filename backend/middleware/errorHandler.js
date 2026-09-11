const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found - ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  // Belt-and-braces for controllers that let a raw Mongoose error reach here
  // without first calling res.status() themselves (e.g. a required-field
  // ValidationError on create, or a malformed :id CastError) — these are
  // client mistakes, not server faults, and shouldn't report as a 500 just
  // because nobody set a status code before the throw.
  if (statusCode === 500) {
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      statusCode = 400;
    } else if (err.code === 11000) {
      statusCode = 409;
    }
  }

  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
