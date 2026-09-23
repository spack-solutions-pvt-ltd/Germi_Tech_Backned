"use strict";
const { Router } = require("express");
const {
  getAllCrops,
  getCropById,
  createCrop,
  updateCrop,
  updateCropStatusById,
} = require("../controller/cropController");

const router = Router();

router.get("/", getAllCrops);
router.get("/:cropId", getCropById);
router.post("/", createCrop);
router.put("/:cropId", updateCrop);
router.patch("/status/:cropId", updateCropStatusById);

module.exports = router;
