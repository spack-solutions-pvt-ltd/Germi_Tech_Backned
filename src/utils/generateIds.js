const generateId = (prefix, number, digits = 4) => {
  return `${prefix}-${String(number).padStart(digits, "0")}`;
};

module.exports = generateId;