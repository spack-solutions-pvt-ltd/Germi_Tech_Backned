"use strict";
const { Router } = require("express");
const { dashboardRoutes } = require("../constants/routes");
const {
  getMyDashboard,
  getL1Dashboard,
  getL2Dashboard,
  getL3Dashboard,
  getL3Allotments,
} = require("../controller/dashboardController");

const router = Router();

router.get(dashboardRoutes.root, getMyDashboard); // picks L1 / L2 / L3 from the logged-in user's level
router.get(dashboardRoutes.l1, getL1Dashboard); // owner
router.get(dashboardRoutes.l2, getL2Dashboard); // staff
router.get(dashboardRoutes.l3, getL3Dashboard); // supervisor — cards, banner, pending tasks
router.get(dashboardRoutes.l3Allotments, getL3Allotments); // supervisor — "My allotments"

module.exports = router;
