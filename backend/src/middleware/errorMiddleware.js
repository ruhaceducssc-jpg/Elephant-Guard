const errorHandler = (err, req, res, next) => {
  const statusCode =
    err.statusCode ||
    err.status ||
    (res.statusCode === 200 ? 500 : res.statusCode);
  
  console.error(`${req.method} ${req.originalUrl}: ${err.message}`);
  
  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? 'Internal server error.' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
