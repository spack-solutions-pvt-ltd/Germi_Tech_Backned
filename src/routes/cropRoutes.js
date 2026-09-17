"use strict";
const { Router } = require("express");
const {
  getAllCrops,
  getCropById,
  createCrop,
  updateCrop,
} = require("../controller/cropController");

const router = Router();

router.get("/", getAllCrops);
router.get("/:cropId", getCropById);
router.post("/", createCrop);
router.put("/:cropId", updateCrop);

module.exports = router;
