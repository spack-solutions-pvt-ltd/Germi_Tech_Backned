"use strict";
const { Router } = require("express");
const {
  getEmployeeById,
  getAllEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  getEmployeeKpis,
} = require("../controller/employeeController");

const router = Router();

router.get("/", getAllEmployees);
router.get("/kpis", getEmployeeKpis);
router.get("/:id", getEmployeeById);
router.post("/", createEmployee);
router.put("/:id", updateEmployee);
router.patch("/status/:empId", updateEmployeeStatus);

module.exports = router;
