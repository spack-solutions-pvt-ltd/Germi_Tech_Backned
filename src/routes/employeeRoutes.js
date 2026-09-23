"use strict";
const { Router } = require("express");
const multer = require("multer");
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

const router = Router();

// Single-file storage for the document upload/edit drawer. Point
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/employee-documents",
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB, matches "One image or PDF file"
});

// ----------------------------------------------------------------- Core --
router.get("/", getAllEmployees);
router.get("/kpis", getEmployeeKpis);
router.get("/:id", getEmployeeById);
router.post("/", createEmployee);
router.put("/:id", updateEmployee);
router.patch("/status/:empId", updateEmployeeStatus);

// ---------------------------------------------------------- Bank account --
router.put("/:id/bank-account", updateBankAccount);

// -------------------------------------------------------------- Documents --
router.post("/:id/documents", upload.single("document"), addEmployeeDocument);
router.get("/:id/documents/:documentId", getEmployeeDocument);
router.put("/:id/documents/:documentId", upload.single("document"), updateEmployeeDocument);
router.get("/:id/documents/:documentId/download", downloadEmployeeDocument);
router.delete("/:id/documents/:documentId", deleteEmployeeDocument);

// -------------------------------------------------------------- Insurance --
router.post("/:id/insurance", addEmployeeInsurance);
router.get("/:id/insurance/:insuranceId", getEmployeeInsurance);
router.put("/:id/insurance/:insuranceId", updateEmployeeInsurance);

module.exports = router;