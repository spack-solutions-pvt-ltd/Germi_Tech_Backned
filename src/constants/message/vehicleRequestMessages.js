"use strict";

// Response messages for controller/vehicleRequestController.js.
// Functions build messages that include values (counts, codes, statuses).
const vehicleRequestMessages = {
  vehicleRequestsFetchedSuccessfully: "Vehicle requests fetched successfully",
  authenticationRequired: "Authentication required",
  idIsRequired: "id is required",
  vehicleRequestNotFound: "Vehicle request not found",
  vehicleRequestFetchedSuccessfully: "Vehicle request fetched successfully",
  allotmentVillageIdIsRequired: "allotmentVillageId is required",
  allotmentVillageNotFound: "AllotmentVillage not found",
  thisAllotmentVillageHasNoLinked: "This allotment-village has no linked allotment",
  warehousesFetchedSuccessfully: "Warehouses fetched successfully",
  toWarehouseIdIsRequired: "toWarehouseId is required",
  onlyL1OrL2EmployeesCan: "Only L1 or L2 employees can create a request on behalf of someone else",
  requestedByEmployeeNotFound: "requestedBy employee not found",
  employeeIsNotTheAssignedSupervisor: (requestedBy) => `Employee ${requestedBy} is not the assigned supervisor for this allotment-village`,
  thisAllotmentIsClosedChooseAn: "This allotment is closed — choose an open allotment",
  warehouseNotFound: "Warehouse not found",
  thisWarehouseDoesNotBelongTo: "This warehouse does not belong to the allotment's seed company",
  vehicleRequestCreatedSuccessfully: "Vehicle request created successfully",
  vehicleRequestsCanOnlyBeEdited: "Vehicle requests can only be edited while Pending",
  vehicleRequestUpdatedSuccessfully: "Vehicle request updated successfully",
  cannotMarkInProcessARequest: (status) => `Cannot mark in-process a request with status "${status}"`,
  vehicleRequestMarkedInProcess: "Vehicle request marked in process",
  logisticsPartnerIdIsRequired: "logisticsPartnerId is required",
  vehicleIdIsRequired: "vehicleId is required",
  cannotAssignAVehicleToA: (status) => `Cannot assign a vehicle to a request with status "${status}"`,
  logisticsPartnerNotFound: "Logistics partner not found",
  vehicleNotFound: "Vehicle not found",
  thisVehicleDoesNotBelongTo: "This vehicle does not belong to the selected logistics partner",
  vehicleAssignedSuccessfully: "Vehicle assigned successfully",
  cannotCancelARequestWithStatus: (status) => `Cannot cancel a request with status "${status}"`,
  vehicleRequestCancelled: "Vehicle request cancelled",
};

module.exports = { vehicleRequestMessages };
