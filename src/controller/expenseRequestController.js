"use strict";
const { ExpenseRequest, Employee } = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { generateId } = require("../utils/generateIds");
const { success, error } = require("../utils/response");
const { createPaymentIfNeeded } = require("../utils/createPayment");

const INCLUDES = [
  {
    model: Employee,
    as: "requester",
    attributes: ["id", "empId", "name", "level"],
  },
  { model: Employee, as: "verifier", attributes: ["id", "empId", "name"] },
  { model: Employee, as: "approver", attributes: ["id", "empId", "name"] },
];

/** Shared list logic — `where` is built by the caller so "mine" vs "everyone's" can differ. */
async function listExpenseRequests(where, req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status } = req.query;
    if (status) where.status = status;

    const result = await ExpenseRequest.findAndCountAll({
      where,
      include: INCLUDES,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Expense requests fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/expense-requests/my-requests — the L3 "Requests" tab: own requests only */
async function getMyExpenseRequests(req, res, next) {
    return listExpenseRequests({ requestedBy: req.employee.id }, req, res, next);
}

/** GET /api/expense-requests — Verifications/Approvals: every supervisor's requests */
async function getAllExpenseRequests(req, res, next) {
  const { requestedBy } = req.query;
  const where = {};
  if (requestedBy) where.requestedBy = requestedBy;
  return listExpenseRequests(where, req, res, next);
}

/** GET /api/expense-requests/:id */
const getExpenseRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const request = await ExpenseRequest.findByPk(id, { include: INCLUDES });
    if (!request) return error(res, 404, "Expense request not found");

    return success(res, 200, "Expense request fetched successfully", {
      data: request,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/expense-requests (multipart/form-data)
 * fields: purpose, amount, note, requestedBy (optional — see labourRequest.controller.js for the "create on behalf of" rule)
 * files: bill (optional, single file)
 */
async function createExpenseRequest(req, res, next) {
  try {
    
    const { purpose, amount, note } = req.body;

    if (!purpose) return error(res, 400, "purpose is required");
    if (!amount) return error(res, 400, "amount is required");

    let requestedBy = req.employee.id;
    const { requestedBy: onBehalfOf } = req.body;
    if (onBehalfOf && Number(onBehalfOf) !== req.employee.id) {
      if (!["L1", "L2"].includes(req.employee.level)) {
        return error(
          res,
          403,
          "Only L1 or L2 employees can create a request on behalf of someone else",
        );
      }
      const targetEmployee = await Employee.findByPk(onBehalfOf);
      if (!targetEmployee)
        return error(res, 404, "requestedBy employee not found");
      requestedBy = Number(onBehalfOf);
    }

    const requestCode = await generateId(ExpenseRequest, "EX");
    const bill = req.file;

    const request = await ExpenseRequest.create({
      requestCode,
      requestedBy,
      createdBy: req.employee.id,
      purpose,
      amount,
      billUrl: bill ? `/uploads/expense-requests/${bill.filename}` : null,
      note,
      status: "pending",
    });

    const created = await ExpenseRequest.findByPk(request.id, {
      include: INCLUDES,
    });

    return success(res, 201, "Expense request created successfully", {
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

// Controller function to update the expense request
const updateExpenseRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const request = await ExpenseRequest.findByPk(id);
    if (!request) return error(res, 404, "Expense request not found");

    if (request.status !== "pending") {
      return error(
        res,
        409,
        "Expense requests can only be edited while Pending (not yet verified)",
      );
    }

    const { purpose, amount, note } = req.body;
    const bill = req.file;

    await request.update({
      ...(purpose !== undefined && { purpose }),
      ...(amount !== undefined && { amount }),
      ...(note !== undefined && { note }),
      ...(bill && { billUrl: `/uploads/expense-requests/${bill.filename}` }),
    });

    return success(res, 200, "Expense request updated successfully", {
      data: request,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/expense-requests/:id/verify — L2 action */
const verifyExpenseRequest = async (req, res, next) => {
  try {

    const { id } = req.params;
    const request = await ExpenseRequest.findByPk(id);
    if (!request) return error(res, 404, "Expense request not found");

    if (request.status !== "pending") {
      return error(
        res,
        409,
        `Cannot verify a request with status "${request.status}"`,
      );
    }

    await request.update({
      status: "verified",
      verifiedBy: req.employee.id,
      verifiedAt: new Date(),
    });

    return success(res, 200, "Expense request verified successfully", {
      data: request,
    });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/expense-requests/:id/approve — L1 action, creates a Supervisor payment */
async function approveExpenseRequest(req, res, next) {
  try {
    
    const { id } = req.params;
    const request = await ExpenseRequest.findByPk(id);
    if (!request) return error(res, 404, "Expense request not found");

    if (request.status !== "verified") {
      return error(
        res,
        409,
        `Cannot approve a request with status "${request.status}"`,
      );
    }

    await request.update({
      status: "approved",
      approvedBy: req.employee.id,
      approvedAt: new Date(),
    });

    const payment = await createPaymentIfNeeded({
      type: "expense",
      sourceRequestType: "expense_request",
      sourceRequestId: request.id,
      recipientType: "employee",
      recipientId: request.requestedBy,
      amount: request.amount,
      requestedBy: request.requestedBy,
      verifiedBy: request.verifiedBy,
      approvedBy: req.employee.id,
    });

    const updated = await ExpenseRequest.findByPk(id, { include: INCLUDES });

    return success(res, 200, "Expense request approved successfully", {
      data: updated,
      payment,
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/expense-requests/:id/reject — L2 (verification stage) or L1 (approval stage) */
async function rejectExpenseRequest(req, res, next) {
  try {
    
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const request = await ExpenseRequest.findByPk(id);
    if (!request) return error(res, 404, "Expense request not found");

    if (["approved", "rejected"].includes(request.status)) {
      return error(
        res,
        409,
        `Cannot reject a request with status "${request.status}"`,
      );
    }

    const rejectedStage =
      request.status === "pending" ? "verification" : "approval";

    await request.update({
      status: "rejected",
      rejectionReason,
      rejectedBy: req.employee.id,
      rejectedStage,
    });

    return success(res, 200, "Expense request rejected", { data: request });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyExpenseRequests,
  getAllExpenseRequests,
  getExpenseRequestById,
  createExpenseRequest,
  updateExpenseRequest,
  verifyExpenseRequest,
  approveExpenseRequest,
  rejectExpenseRequest,
};
