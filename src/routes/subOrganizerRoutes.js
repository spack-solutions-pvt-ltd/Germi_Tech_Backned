"use strict";
const { Router } = require("express");
const { subOrganizerRoutes } = require("../constants/routes");
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

router.get(subOrganizerRoutes.summary, getSubOrganizerSummary); // KPI cards — before /:id
router.get(subOrganizerRoutes.root, getAllSubOrganizers);
router.get(subOrganizerRoutes.byId, getSubOrganizerById);
router.post(subOrganizerRoutes.root, createSubOrganizer);
router.put(subOrganizerRoutes.bySubOrganizerId, updateSubOrganizer);
router.patch(subOrganizerRoutes.statusBySubOrganizerId, updateSubOrganizerStatusById);

module.exports = router;