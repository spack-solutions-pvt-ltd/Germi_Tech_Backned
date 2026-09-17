"use strict";
const { Router } = require("express");
const {
  getWarehousesByCompanyId,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
} = require("../controller/warehouseController");

const router = Router();

router.post("/", createWarehouse);
router.put("/:warehouseId", updateWarehouse);
router.get("/all/:seedCompanyId", getWarehousesByCompanyId);
router.get("/:warehouseId", getWarehouseById);

module.exports = router;
