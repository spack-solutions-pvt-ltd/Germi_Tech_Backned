"use strict";

// Response messages for controller/companyCropVariety.js.
// Functions build messages that include values (counts, codes, statuses).
const companyCropVarietyMessages = {
  cropFetchSuccess: "Crop varieties fetched successfully",
  idRequired: "id is required",
  cropVarietyNotFound: "Crop variety not found",
  getCropSuccess: "Crop variety fetched successfully",
  companyIdReq: "companyId is required",
  cropIdReq: "cropId is required",
  varietyNameReq: "varietyName is required",
  seedComNotFound: "Seed company not found",
  cropNotFound: "Crop not found",
  createMessage: "Crop variety created successfully",
  updatedMessage: "Crop variety updated successfully",
  cropVarietyFound: "This company already has this crop/variety combination",
  seedVarietyIdReq: "Seed varieties id is required",
  statusReqMsg: "status is required",
  companyCropNotFound: "Company crop not found",
  companyStatusUpdateMsg: "CompanyCrop status updated successfully",
};

module.exports = { companyCropVarietyMessages };
