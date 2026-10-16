"use strict";

// Response messages for controller/labourGroupController.js.
// Functions build messages that include values (counts, codes, statuses).
const labourGroupMessages = {
  laborGroupsFetchedSuccessfully: "Labor groups fetched successfully",
  idIsRequired: "id is required",
  laborGroupNotFound: "Labor group not found",
  laborGroupFetchedSuccessfully: "Labor group fetched successfully",
  nameIsRequired: "name is required",
  contactNumberIsRequired: "contactNumber is required",
  cropIdIsRequiredInEveryCroprates: "cropId is required in every cropRates entry",
  pricePerPersonIsRequiredInEveryCroprates: "pricePerPerson is required in every cropRates entry",
  sameCropCannotBeAddedMore: "Same crop cannot be added more than once to the same labor group",
  oneOrMoreCropidValuesIn: "One or more cropId values in cropRates do not exist",
  laborGroupCreatedSuccessfully: "Labor group created successfully",
  laborGroupUpdatedSuccessfully: "Labor group updated successfully",
  labourGroupSummaryFetchedSuccessfully: "Labour group summary fetched successfully",
  paymentNotFoundForThisLabour: "Payment not found for this labour group",
  labourGroupPaymentFetchedSuccessfully: "Labour group payment fetched successfully",
  labourGroupNotFound: "Labour group not found",
  labourGroupPaymentsFetchedSuccessfully: "Labour group payments fetched successfully",
};

module.exports = { labourGroupMessages };
