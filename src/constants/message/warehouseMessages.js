"use strict";

// Response messages for controller/warehouseController.js.
// Functions build messages that include values (counts, codes, statuses).
const warehouseMessages = {
  warehousesFetchedSuccessfully: "Warehouses fetched successfully",
  seedCompanyIdIsRequired: "seedCompanyId is required",
  seedCompanyNotFound: "Seed company not found",
  warehouseIdIsRequired: "warehouseId is required",
  warehouseNotFound: "Warehouse not found",
  warehouseFetchedSuccessfully: "Warehouse fetched successfully",
  companyIdIsRequired: "companyId is required",
  locationNameIsRequired: "locationName is required",
  warehouseCreatedSuccessfully: "Warehouse created successfully",
  warehouseUpdatedSuccessfully: "Warehouse updated successfully",
};

module.exports = { warehouseMessages };
