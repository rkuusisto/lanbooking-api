/**
 * Async Handler Utility
 * Wraps async route handlers to catch errors and pass them to Express error handler
 * @module utils/asyncHandler
 */

/**
 * Wraps an async route handler to automatically catch errors
 * @param {Function} handler - Async route handler function
 * @returns {Function} Express middleware function
 */
export const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        details: error.details,
      });
    }
    return next(error);
  }
};

export default asyncHandler;

