"use strict";
const jwt = require("jsonwebtoken");
const { Employee } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET;

// Verifies the JWT from the Authorization header (Bearer <token>)
async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication token missing" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const employee = await Employee.findByPk(decoded.id);

    if (!employee) {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (employee.status !== "Active") {
      return res
        .status(403)
        .json({ message: "Your account is Inactive. Contact an admin." });
    }
    req.employee = {
      id: employee.id,
      name: employee.name,
      level: employee.level,
      roleId: employee.roleId,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Session expired, please log in again" });
    }
    return res.status(401).json({ message: "Invalid authentication token" });
  }
}

module.exports = {
  authenticate,
};
