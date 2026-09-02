function toSafeMessage(err, status) {
    if (status >= 500) {
        return process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error';
    }
    return err.message || 'Request failed';
}

const errorHandler = (err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const message = toSafeMessage(err, status);

    if (status >= 500) {
        console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    }

    res.status(status).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV !== 'production' && status >= 500
            ? { details: err.message, stack: err.stack }
            : {}),
    });
};

module.exports = errorHandler;
