"use strict";
const { Router } = require("express");
const { employeeRoutes } = require("../constants/routes");
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
router.get(employeeRoutes.root, getAllEmployees);
router.get(employeeRoutes.kpis, getEmployeeKpis);
router.get(employeeRoutes.byId, getEmployeeById);
router.post(employeeRoutes.root, createEmployee);
router.put(employeeRoutes.byId, updateEmployee);
router.patch(employeeRoutes.statusByEmpId, updateEmployeeStatus);

// Bank account
router.post(employeeRoutes.bankAccountById, updateBankAccount);
router.put(employeeRoutes.bankAccountById, updateBankAccount);

//  Documents
router.post(employeeRoutes.documentsById, employeeDocumentFileUpload, addEmployeeDocument);
router.get(employeeRoutes.documentsByIdAndDocumentId, getEmployeeDocument);
router.put(
  employeeRoutes.documentsByIdAndDocumentId,
  employeeDocumentFileUpload,
  updateEmployeeDocument,
);
router.get(employeeRoutes.documentsDownloadByIdAndDocumentId, downloadEmployeeDocument);
router.delete(employeeRoutes.documentsByIdAndDocumentId, deleteEmployeeDocument);

//Insurance
router.post(employeeRoutes.insuranceById, addEmployeeInsurance);
router.get(employeeRoutes.insuranceByIdAndInsuranceId, getEmployeeInsurance);
router.put(employeeRoutes.insuranceByIdAndInsuranceId, updateEmployeeInsurance);

module.exports = router;
