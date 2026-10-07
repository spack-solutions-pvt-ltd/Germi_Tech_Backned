"use strict";
const { Router } = require("express");
const {
  getEmployeeById,
  getAllEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  getEmployeeKpis,
  updateBankAccount,
  addEmployeeDocument,
  updateEmployeeDocument,
  getEmployeeDocument,
  downloadEmployeeDocument,
  deleteEmployeeDocument,
  addEmployeeInsurance,
  updateEmployeeInsurance,
  getEmployeeInsurance,
} = require("../controller/employeeController");
// Private S3 upload (employee-documents/) — see upload.middleware.js
const { employeeDocumentFileUpload } = require("../middleWare/upload.middleware");

const router = Router();

// Core
router.get("/", getAllEmployees);
router.get("/kpis", getEmployeeKpis);
router.get("/:id", getEmployeeById);
router.post("/", createEmployee);
router.put("/:id", updateEmployee);
router.patch("/status/:empId", updateEmployeeStatus);

// Bank account
router.post("/:id/bank-account", updateBankAccount);
router.put("/:id/bank-account", updateBankAccount);

//  Documents
router.post("/:id/documents", employeeDocumentFileUpload, addEmployeeDocument);
router.get("/:id/documents/:documentId", getEmployeeDocument);
router.put(
  "/:id/documents/:documentId",
  employeeDocumentFileUpload,
  updateEmployeeDocument,
);
router.get("/:id/documents/:documentId/download", downloadEmployeeDocument);
router.delete("/:id/documents/:documentId", deleteEmployeeDocument);

//Insurance
router.post("/:id/insurance", addEmployeeInsurance);
router.get("/:id/insurance/:insuranceId", getEmployeeInsurance);
router.put("/:id/insurance/:insuranceId", updateEmployeeInsurance);

module.exports = router;
