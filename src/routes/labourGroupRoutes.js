"use strict";
const { Router } = require("express");
const {
  getAllLaborGroups,
  getLaborGroupById,
  createLaborGroup,
  updateLaborGroup,
} = require("../controller/labourGroupController");

const router = Router();

router.get("/", getAllLaborGroups);
router.get("/:id", getLaborGroupById);
router.post("/", createLaborGroup);
router.put("/:id", updateLaborGroup);

module.exports = router;
