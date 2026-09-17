const crypto = require("crypto");
const generateId = (prefix, number, digits = 4) => {
  return `${prefix}-${String(number).padStart(digits, "0")}`;
};

/** Generates a zero-padded 6-digit numeric OTP, e.g. "042917". */
function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

module.exports = { generateId, generateOtp };
