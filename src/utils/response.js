"use strict";

// Consistent { success, message, ...payload } shape across every controller.
function success(res, statusCode, message, payload = {}) {
  return res.status(statusCode).json({ success: true, message, ...payload });
}

function error(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, message });
}

/** An Error the error middleware turns into `statusCode` + message — handy inside transactions. */
function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { success, error, httpError };
