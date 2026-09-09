"use strict";
const { Router } = require("express");
const { authenticate } = require("../middleWare/authMiddleware");
const {
  getAllCrops,
  getCropById,
  createCrop,
  updateCrop,
} = require("../controller/cropController");

const router = Router();

router.get("/", authenticate, getAllCrops);
router.get("/:cropId", authenticate, getCropById);
router.post("/", authenticate, createCrop);
router.put("/:cropId", authenticate, updateCrop);

module.exports = router;
