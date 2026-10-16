"use strict";

// Response messages for controller/taskTypeController.js.
// Functions build messages that include values (counts, codes, statuses).
const taskTypeMessages = {
  taskTypesFetchedSuccessfully: "Task types fetched successfully",
  idIsRequired: "id is required",
  taskTypeNotFound: "Task type not found",
  taskTypeFetchedSuccessfully: "Task type fetched successfully",
  nameIsRequired: "name is required",
  aTaskTypeWithThisName: "A task type with this name already exists",
  taskTypeCreatedSuccessfully: "Task type created successfully",
  taskTypeUpdatedSuccessfully: "Task type updated successfully",
};

module.exports = { taskTypeMessages };
