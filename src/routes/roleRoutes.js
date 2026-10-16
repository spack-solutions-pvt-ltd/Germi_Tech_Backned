"use strict";
const { Router } = require("express");
const { roleRoutes } = require("../constants/routes");
const {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  updateRoleStatus,
  getRoleKpis,
} = require("../controller/roleController");
// const { authenticate, requirePermission } = require("../middlewares/auth.middleware");

const router = Router();

router.get(roleRoutes.root, getAllRoles);
router.get(roleRoutes.kpis, getRoleKpis);
router.get(roleRoutes.byId, getRoleById);
router.post(roleRoutes.root, createRole);
router.put(roleRoutes.byId, updateRole);
router.patch(roleRoutes.statusByRoleId, updateRoleStatus);

module.exports = router;
