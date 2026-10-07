"use strict";
const { Router } = require("express");
const {
  getMyBagsTransfers,
  getAllBagsTransfers,
  getBagsTransferById,
  getMyBagsTransferSummary,
  getBagsTransferSummary,
  getMyAllotmentsWithBags,
  getBagsBalance,
  getDestinationCompanies,
  getSupervisors,
  getSupervisorAllotments,
  createBagsTransfer,
  updateBagsTransfer,
  updateBagsTransferStatus,
} = require("../controller/bagsTransferController");

const router = Router();

// Send Bags drawer dropdowns
router.get("/my-allotments", getMyAllotmentsWithBags); // allotments + "Bags with him"
router.get("/balance/:allotmentVillageId", getBagsBalance);
router.get("/companies", getDestinationCompanies);
router.get("/supervisors", getSupervisors);
router.get("/supervisors/:supervisorId/allotments", getSupervisorAllotments);

// Lists & summary
router.get("/my-transfers", getMyBagsTransfers); // ?direction=outgoing|incoming
router.get("/my-summary", getMyBagsTransferSummary);
router.get("/summary", getBagsTransferSummary);
router.get("/", getAllBagsTransfers); // Verifications → Bags

router.get("/:id", getBagsTransferById);
router.post("/", createBagsTransfer); // Send bags (senderId? = on a supervisor's behalf)
router.put("/:id", updateBagsTransfer); // sender / creator, Pending only
router.patch("/:id/status", updateBagsTransferStatus); // received | not_received | cancelled

module.exports = router;
