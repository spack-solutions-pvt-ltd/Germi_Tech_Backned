"use strict";

// Response messages for controller/expenseRequestController.js.
// Functions build messages that include values (counts, codes, statuses).
const expenseRequestMessages = {
  expenseRequestsFetchedSuccessfully: "Expense requests fetched successfully",
  idIsRequired: "id is required",
  expenseRequestNotFound: "Expense request not found",
  expenseRequestFetchedSuccessfully: "Expense request fetched successfully",
  purposeIsRequired: "purpose is required",
  amountIsRequired: "amount is required",
  onlyL1OrL2EmployeesCan: "Only L1 or L2 employees can create a request on behalf of someone else",
  requestedByEmployeeNotFound: "requestedBy employee not found",
  expenseRequestCreatedSuccessfully: "Expense request created successfully",
  expenseRequestsCanOnlyBeEdited: "Expense requests can only be edited while Pending (not yet verified)",
  expenseRequestUpdatedSuccessfully: "Expense request updated successfully",
  cannotVerifyARequestWithStatus: (status) => `Cannot verify a request with status "${status}"`,
  expenseRequestVerifiedSuccessfully: "Expense request verified successfully",
  cannotApproveARequestWithStatus: (status) => `Cannot approve a request with status "${status}"`,
  expenseRequestApprovedSuccessfully: "Expense request approved successfully",
  cannotRejectARequestWithStatus: (status) => `Cannot reject a request with status "${status}"`,
  expenseRequestRejected: "Expense request rejected",
};

module.exports = { expenseRequestMessages };
