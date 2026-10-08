"use strict";
const { Router } = require("express");
const {
  getMyDashboard,
  getL1Dashboard,
  getL2Dashboard,
  getL3Dashboard,
  getL3Allotments,
} = require("../controller/dashboardController");

const router = Router();

router.get("/", getMyDashboard); // picks L1 / L2 / L3 from the logged-in user's level
router.get("/l1", getL1Dashboard); // owner
router.get("/l2", getL2Dashboard); // staff
router.get("/l3", getL3Dashboard); // supervisor — cards, banner, pending tasks
router.get("/l3/allotments", getL3Allotments); // supervisor — "My allotments"

module.exports = router;
