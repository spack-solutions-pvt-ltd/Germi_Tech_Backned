"use strict";
const { Router } = require("express");
const { bagTransferRoutes } = require("../constants/routes");
const {
  getMyBagsTransfers,
  getAllBagsTransfers,
  getCompanyBagsTransfers,
  getCompanyBagsTransferSummary,
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
router.get(bagTransferRoutes.myAllotments, getMyAllotmentsWithBags); // allotments + "Bags with him"
router.get(bagTransferRoutes.balanceByAllotmentVillageId, getBagsBalance);
router.get(bagTransferRoutes.companies, getDestinationCompanies);
router.get(bagTransferRoutes.supervisors, getSupervisors);
router.get(bagTransferRoutes.supervisorsAllotmentsBySupervisorId, getSupervisorAllotments);

// Lists & summary
router.get(bagTransferRoutes.myTransfers, getMyBagsTransfers); // ?direction=outgoing|incoming
router.get(bagTransferRoutes.mySummary, getMyBagsTransferSummary);
router.get(bagTransferRoutes.root, getAllBagsTransfers); // Verifications → Bags
router.get(bagTransferRoutes.company, getCompanyBagsTransfers); // transfers sent to a company (type "return")
router.get(bagTransferRoutes.companySummary, getCompanyBagsTransferSummary); // KPI cards for the company transfers page

router.get(bagTransferRoutes.byId, getBagsTransferById);
router.post(bagTransferRoutes.root, createBagsTransfer); // Send bags (senderId? = on a supervisor's behalf)
router.put(bagTransferRoutes.byId, updateBagsTransfer); // sender / creator, Pending only
router.patch(bagTransferRoutes.statusById, updateBagsTransferStatus); // received | not_received | cancelled

module.exports = router;
