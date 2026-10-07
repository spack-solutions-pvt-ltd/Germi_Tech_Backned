"use strict";
const { Router } = require("express");
const {
  getSubOrganizerSummary,
  getAllSubOrganizers,
  getSubOrganizerById,
  createSubOrganizer,
  updateSubOrganizer,
  updateSubOrganizerStatusById,
} = require("../controller/subOrganizerController");
// const { authenticate, requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get("/summary", getSubOrganizerSummary); // KPI cards — before /:id
router.get("/", getAllSubOrganizers);
router.get("/:id", getSubOrganizerById);
router.post("/", createSubOrganizer);
router.put("/:subOrganizerId", updateSubOrganizer);
router.patch("/status/:subOrganizerId", updateSubOrganizerStatusById);

module.exports = router;