"use strict";

// Response messages for controller/taskController.js.
// Functions build messages that include values (counts, codes, statuses).
const taskMessages = {
  myTaskSummaryFetchedSuccessfully: "My task summary fetched successfully",
  myTasksFetchedSuccessfully: "My tasks fetched successfully",
  employeeNotFound: "Employee not found",
  taskSummaryFetchedSuccessfully: "Task summary fetched successfully",
  tasksFetchedSuccessfully: "Tasks fetched successfully",
  idIsRequired: "id is required",
  taskNotFound: "Task not found",
  taskFetchedSuccessfully: "Task fetched successfully",
  assignedToIsRequired: "assignedTo is required",
  taskTypeIdIsRequired: "taskTypeId is required",
  descriptionIsRequired: "description is required",
  dueDateIsRequired: "dueDate is required",
  assignedToEmployeeNotFound: "assignedTo employee not found",
  taskTypeNotFound: "Task type not found",
  taskCreatedSuccessfully: "Task created successfully",
  youNeedTaskManagementEditFor: "You need task_management.edit (for tasks you created) or both task_management.global_view and task_management.edit (to edit any task)",
  cannotEditATaskWithStatus: (status) => `Cannot edit a task with status "${status}". Use reassign or cancel instead.`,
  taskUpdatedSuccessfully: "Task updated successfully",
  actionIsRequired: "action is required",
  onlyTheAssignedEmployeeCanSubmit: "Only the assigned employee can submit this task",
  cannotSubmitATaskWithStatus: (status) => `Cannot submit a task with status "${status}"`,
  noteIsRequiredToSubmitA: "note is required to submit a task",
  onlyTheTaskSCreatorOr: "Only the task's creator or an L1 employee can accept it",
  cannotAcceptATaskWithStatus: (status) => `Cannot accept a task with status "${status}"`,
  cannotReassignATaskWithStatus: (status) => `Cannot reassign a task with status "${status}"`,
  noteIsRequiredToReassignA: "note is required to reassign a task",
  onlyTheTaskSCreatorOr2: "Only the task's creator or an L1 employee can cancel it",
  cannotCancelATaskWithStatus: (status) => `Cannot cancel a task with status "${status}"`,
  actionMustBeOneOfSubmit: "action must be one of: submit, accept, reassign, cancel",
  taskAppliedSuccessfully: (action) => `Task ${action} applied successfully`,
};

module.exports = { taskMessages };
