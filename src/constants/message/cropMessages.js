"use strict";

// Response messages for controller/cropController.js.
// Functions build messages that include values (counts, codes, statuses).
const cropMessages = {
  cropFetchMsg: "Crops fetched successfully",
  pageAndLimitMustBePositive: "page and limit must be positive integers",
  cropIdReqMsg: "cropId is required",
  cropNotFound: "Crop not found",
  cropFetchMsgById: "Crop fetched",
  failedToFetchMsg: "Failed to fetch crop",
  validationFailed: "Validation failed",
  cropCreated: "Crop created",
  cropUpdated: "Crop updated!",
  aCropWithThisNameAlready: "A crop with this name already exists",
  failedToUpdateCrop: "Failed to update crop",
  statusUpdatedSuccessfully: "Status updated successfully!",
  cropSummaryFetchedSuccessfully: "Crop summary fetched successfully",
};

module.exports = { cropMessages };
