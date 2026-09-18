"use strict";
const { Router } = require("express");
const { authRoutes } = require("../constants/routes");
const {
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyOtp,
  getUserDetails,
  resendOtp,
} = require("../controller/authController");
const { authenticate } = require("../middleWare/auth.middleware");

const router = Router();

router.post(authRoutes.login, login);
router.post(authRoutes.forgotPassword, forgotPassword);
router.post(authRoutes.verifyOtp, verifyOtp);
router.post(authRoutes.resendOtp, resendOtp);
router.post(authRoutes.resetPassword, resetPassword);
router.patch(authRoutes.changePassword, authenticate, changePassword);
router.get(authRoutes.getDetails, authenticate, getUserDetails);

module.exports = router;
