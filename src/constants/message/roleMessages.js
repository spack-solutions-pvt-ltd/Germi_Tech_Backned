"use strict";

// Response messages for controller/roleController.js.
// Functions build messages that include values (counts, codes, statuses).
const roleMessages = {
  roleKpisFetchedSuccessfully: "Role KPIs fetched successfully",
  rolesFetchedSuccessfully: "Roles fetched successfully",
  idIsRequired: "id is required",
  roleNotFound: "Role not found",
  roleFetchedSuccessfully: "Role fetched successfully",
  nameIsRequired: "name is required",
  unknownPermissionCodeS: (missing) => `Unknown permission code(s): ${missing}`,
  roleCreatedSuccessfully: "Role created successfully",
  aRoleWithThisNameAlready: "A role with this name already exists",
  roleUpdatedSuccessfully: "Role updated successfully",
  roleIdIsRequired: "roleId is required",
  statusIsRequired: "status is required",
  invalidStatus: "Invalid status",
  roleStatusUpdatedSuccessfully: "Role status updated successfully",
};

module.exports = { roleMessages };
