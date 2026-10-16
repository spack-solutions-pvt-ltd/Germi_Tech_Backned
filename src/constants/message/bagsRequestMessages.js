"use strict";

// Response messages for controller/bagsRequestController.js.
// Functions build messages that include values (counts, codes, statuses).
const bagsRequestMessages = {
  cropEntriesMustBeValidJson: "cropEntries must be valid JSON",
  atLeastOneCropEntryIs: "At least one crop entry is required",
  allotmentVillageIdIsRequiredInEveryCrop: "allotmentVillageId is required in every crop entry",
  requiredBagsMustBeAPositiveWhole: "requiredBags must be a positive whole number in every crop entry",
  allotmentVillageIdAppearsMoreThanOnce: (avId) => `allotmentVillageId ${avId} appears more than once`,
  allotmentVillageNotFound: (avId) => `AllotmentVillage ${avId} not found`,
  employeeIsNotTheAssignedSupervisor: (supervisorId, avId) => `Employee ${supervisorId} is not the assigned supervisor for allotmentVillageId ${avId}`,
  allotmentVillageId: (avId) => `allotmentVillageId ${avId}`,
  bagsRequestsFetchedSuccessfully: "Bags requests fetched successfully",
  bagsRequestNotFound: "Bags request not found",
  youDonTHaveAccessTo: "You don't have access to this bags request",
  bagsRequestFetchedSuccessfully: "Bags request fetched successfully",
  bagsSummaryFetchedSuccessfully: "Bags summary fetched successfully",
  bagsRequestCreatedSuccessfully: "Bags request created successfully",
  bagsRequestsCanOnlyBeEdited: "Bags requests can only be edited while Pending",
  bagsRequestUpdatedSuccessfully: "Bags request updated successfully",
  youCannotProcessYourOwnRequest: "You cannot process your own request",
  onlyL1L2CanProcessAnd: "Only L1/L2 can process and dispatch bags requests",
  onlyTheRequestingSupervisorOrThe: "Only the requesting supervisor or the person who raised the request can confirm receipt",
  youCannotCancelThisBagsRequest: "You cannot cancel this bags request",
  youCannotPerformThisAction: "You cannot perform this action",
  cropEntryDoesNotBelongTo: (id) => `Crop entry ${id} does not belong to this request`,
  requiredBagsMustBeAPositiveWhole2: "requiredBags must be a positive whole number",
  sentBagsMustBeAWholeNumber: "sentBags must be a whole number ≥ 0",
  statusIsRequired: "status is required",
  cropEntriesMustBeAnArray: "cropEntries must be an array",
  cannotMoveABagsRequestFrom: (fromStatus, toStatus) => `Cannot move a bags request from "${fromStatus}" to "${toStatus}"`,
  cropEntriesWithSentbagsAreRequiredFor: "cropEntries with sentBags are required for a new dispatch",
  setSentbagsAtInProcessOr: "Set sentBags (at In process or here) — at least one bag must be sent",
  bagsRequestStatusUpdatedSuccessfully: "Bags request status updated successfully",
};

module.exports = { bagsRequestMessages };
