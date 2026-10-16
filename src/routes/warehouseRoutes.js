"use strict";
const { Router } = require("express");
const { warehouseRoutes } = require("../constants/routes");
const {
  getWarehousesByCompanyId,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
} = require("../controller/warehouseController");

const router = Router();

router.post(warehouseRoutes.root, createWarehouse);
router.put(warehouseRoutes.byWarehouseId, updateWarehouse);
router.get(warehouseRoutes.allBySeedCompanyId, getWarehousesByCompanyId);
router.get(warehouseRoutes.byWarehouseId, getWarehouseById);

module.exports = router;
