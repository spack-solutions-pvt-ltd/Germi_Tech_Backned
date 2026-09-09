"use strict";
const { Router } = require("express");
const { authRoutes } = require("../constants/routes");
const { login, changePassword } = require("../controller/authController");
const { authenticate } = require("../middleWare/authMiddleware");

const router = Router();

router.post(authRoutes.login, login);
// router.post(authRoutes.forgotPassword, forgotPassword);
// router.post(authRoutes.resetPassword, resetPassword);
router.patch(authRoutes.changePassword, authenticate, changePassword);

module.exports = router;
