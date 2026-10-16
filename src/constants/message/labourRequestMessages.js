"use strict";

// Response messages for controller/labourRequestController.js.
// Functions build messages that include values (counts, codes, statuses).
const labourRequestMessages = {
  labourRequestsFetchedSuccessfully: "Labour requests fetched successfully",
  idIsRequired: "id is required",
  labourRequestNotFound: "Labour request not found",
  labourRequestFetchedSuccessfully: "Labour request fetched successfully",
  cropEntriesMustBeValidJson: "cropEntries must be valid JSON",
  eitherLaborgroupidOrOtherlaborgroupnameIsRequired: "Either laborGroupId or otherLaborGroupName is required",
  fromLocationIsRequired: "fromLocation is required",
  toLocationIsRequired: "toLocation is required",
  atLeastOneCropEntryIs: "At least one crop entry is required",
  laborGroupNotFound: "Labor group not found",
  onlyL1OrL2EmployeesCan: "Only L1 or L2 employees can create a request on behalf of someone else",
  requestedByEmployeeNotFound: "requestedBy employee not found",
  allotmentVillageIdIsRequiredInEveryCrop: "allotmentVillageId is required in every crop entry",
  labourCountIsRequiredInEveryCrop: "labourCount is required in every crop entry",
  allotmentVillageNotFound: (allotmentVillageId) => `AllotmentVillage ${allotmentVillageId} not found`,
  employeeIsNotTheAssignedSupervisor: (requestedBy, allotmentVillageId) => `Employee ${requestedBy} is not the assigned supervisor for allotmentVillageId ${allotmentVillageId}`,
  allotmentVillageIdThisAllotmentIsClosedChoose: (allotmentVillageId) => `allotmentVillageId ${allotmentVillageId}: this allotment is closed — choose an open allotment`,
  labourRequestCreatedSuccessfully: "Labour request created successfully",
  labourRequestsCanOnlyBeEdited: "Labour requests can only be edited while Pending (not yet verified)",
  notTheAssignedSupervisorForAllotmentvillageid: (allotmentVillageId) => `Not the assigned supervisor for allotmentVillageId ${allotmentVillageId}`,
  labourRequestUpdatedSuccessfully: "Labour request updated successfully",
  cannotVerifyARequestWithStatus: (status) => `Cannot verify a request with status "${status}"`,
  transportCostMustBeANumber0: "transportCost must be a number ≥ 0",
  thisRequestAlreadyHasAReal: "This request already has a real labor group assigned — nothing to resolve",
  labourRequestVerifiedSuccessfully: "Labour request verified successfully",
  cannotApproveARequestWithStatus: (status) => `Cannot approve a request with status "${status}"`,
  noCropWiseRateFoundFor: "No crop-wise rate found for this labor group on the requested crop(s) and no transport cost",
  thisRequestUsedAnOthersLabor: "This request used an 'Others' labor group — no rate table to calculate a payment from",
  labourRequestApprovedSuccessfully: "Labour request approved successfully",
  cannotRejectARequestWithStatus: (status) => `Cannot reject a request with status "${status}"`,
  labourRequestRejected: "Labour request rejected",
};

module.exports = { labourRequestMessages };
