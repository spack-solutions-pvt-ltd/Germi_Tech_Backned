"use strict";
const { Router } = require("express");
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

router.get("/", getAllRoles);
router.get("/kpis", getRoleKpis);
router.get("/:id", getRoleById);
router.post("/", createRole);
router.put("/:id", updateRole);
router.patch("/status/:roleId", updateRoleStatus);
// router.get("/me/permissions", );


module.exports = router;
