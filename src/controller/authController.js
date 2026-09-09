const { Employee } = require("../models");
const bcrypt = require("bcrypt");
const { createRefreshToken } = require("../utils/refreshToken");
const jwt = require("jsonwebtoken");

const login = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(422).json({ message: "Email and password are required" });
  }
  try {
    const employee = await Employee.findOne({ where: { email } });

    if (!employee) {
      return res.status(401).json({ success: false, message: "Invalid email" });
    }

    if (employee.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: "Your account is Inactive. Contact an admin.",
      });
    }
    // validating password
    const isValid = await bcrypt.compare(password, employee.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const accessToken = jwt.sign(
      { id: employee.id, roleId: employee.roleId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );
    const refreshToken = await createRefreshToken(employee);
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: { accessToken, refreshToken: refreshToken.token },
    });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res,next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(422).json({
      success:false,
      message: "currentPassword, newPasswords are required",
    });
  }

  if (newPassword.length < 8) {
    return res
      .status(422)
      .json({ message: "Password must be at least 8 characters" });
  }

  try {
    const employee = await Employee.findByPk(req.employee.id);
    if (!employee)
      return res.status(404).json({ message: "Employee not found" });

    const isValid = await bcrypt.compare(currentPassword, employee.password);
    if (!isValid)
      return res.status(401).json({ message: "Current password is incorrect" });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await employee.update({ password: passwordHash });

    res.json({ success: false, message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, changePassword };
