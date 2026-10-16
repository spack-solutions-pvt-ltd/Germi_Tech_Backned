"use strict";

// Response messages for controller/bagsTransferController.js.
// Functions build messages that include values (counts, codes, statuses).
const bagsTransferMessages = {
  bagsTransfersFetchedSuccessfully: "Bags transfers fetched successfully",
  toCompanyTypeMustBeGermitechOrSeed: "toCompanyType must be \"germitech\" or \"seed_company\"",
  companyBagsTransferSummaryFetchedSuccessfully: "Company bags transfer summary fetched successfully",
  bagsTransferNotFound: "Bags transfer not found",
  youDonTHaveAccessTo: "You don't have access to this bags transfer",
  bagsTransferFetchedSuccessfully: "Bags transfer fetched successfully",
  bagsTransferSummaryFetchedSuccessfully: "Bags transfer summary fetched successfully",
  allotmentsFetchedSuccessfully: "Allotments fetched successfully",
  allotmentVillageNotFound: "Allotment-village not found",
  youAreNotTheSupervisorOf: "You are not the supervisor of this allotment",
  bagsBalanceFetchedSuccessfully: "Bags balance fetched successfully",
  companiesFetchedSuccessfully: "Companies fetched successfully",
  supervisorsFetchedSuccessfully: "Supervisors fetched successfully",
  bagsMustBeAPositiveWhole: "bags must be a positive whole number",
  fromAllotmentVillageIdIsRequired: "fromAllotmentVillageId is required",
  theSelectedAllotmentIsNotAssigned: "The selected allotment is not assigned to the sending supervisor",
  fromAllotment: "From allotment",
  seedCompanyNotFound: "Seed company not found",
  toSupervisorIdIsRequired: "toSupervisorId is required",
  bagsCannotBeSentToThe: "Bags cannot be sent to the same supervisor",
  supervisorNotFound: "Supervisor not found",
  // Receiving supervisor picks their allotment when marking a transfer received
  toAllotmentVillageIdRequiredToReceive: "Select the allotment (toAllotmentVillageId) these bags go into to mark them received",
  receivingAllotmentNotFound: "Allotment not found",
  receivingAllotmentNotYours: "The selected allotment is not assigned to you",
  toAllotment: "To allotment",
  sendToMustBeCompanyOrSupervisor: "sendTo must be \"company\" or \"supervisor\"",
  onlyBagsCanBeSentFrom: (sendable) => `Only ${sendable} bags can be sent from this allotment`,
  bagsSentSuccessfully: "Bags sent successfully",
  transfersCanOnlyBeEditedWhile: "Transfers can only be edited while Pending",
  bagsTransferUpdatedSuccessfully: "Bags transfer updated successfully",
  youCannotConfirmYourOwnTransfer: "You cannot confirm your own transfer",
  onlyTheReceivingSupervisorCanConfirm: "Only the receiving supervisor can confirm these bags",
  onlyL1L2CanConfirmBags: "Only L1/L2 can confirm bags returned to a company",
  youCannotCancelThisTransfer: "You cannot cancel this transfer",
  youCannotPerformThisAction: "You cannot perform this action",
  statusIsRequired: "status is required",
  cannotMoveATransferFromTo: (fromStatus, toStatus) => `Cannot move a transfer from "${fromStatus}" to "${toStatus}"`,
  bagsTransferStatusUpdatedSuccessfully: "Bags transfer status updated successfully",
};

module.exports = { bagsTransferMessages };
