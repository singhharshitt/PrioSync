/**
 * Global Error Handler Middleware
 * Catches all errors thrown or passed via next(error) in Express
 */
const CONNECTIVITY_RE =
    /connection (terminated|timeout)|connect timeout|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|timeout expired|terminating connection/i;

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Mongoose duplicate key error
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue || {})[0];
        message = `${field ? field.charAt(0).toUpperCase() + field.slice(1) : 'Field'} already exists.`;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors)
            .map((e) => e.message)
            .join(', ');
    }

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    // Database connectivity failures (cold Neon compute, dropped sockets,
    // DNS hiccups) are transient: answer 503 with a retryable message instead
    // of a 500. pg-pool self-heals dead clients on the next checkout, so a
    // client retry moments later usually succeeds.
    if (statusCode === 500 && CONNECTIVITY_RE.test(message)) {
        statusCode = 503;
        message = 'Database is warming up or temporarily unreachable. Please retry in a few seconds.';
    }

    req?.log?.error({ err }, 'request failed');

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

export default errorHandler;
