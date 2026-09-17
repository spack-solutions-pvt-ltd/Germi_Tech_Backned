"use strict";

// Consistent { success, message, ...payload } shape across every controller.
function success(res, statusCode, message, payload = {}) {
  return res.status(statusCode).json({ success: true, message, ...payload });
}

function error(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, message });
}

module.exports = { success, error };