export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.expose ? err.message : "Internal server error";

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(status).json({
    error: message
  });
};
