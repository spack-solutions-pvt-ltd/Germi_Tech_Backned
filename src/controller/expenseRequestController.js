"use strict";
const { ExpenseRequest, Employee } = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { generateId } = require("../utils/generateIds");
const { success, error } = require("../utils/response");
const { createSummaryHandlers } = require("../utils/statusSummary");
const { myRequestsScope, withCreatorFlags } = require("../utils/requestOwnership");
const { createPaymentIfNeeded } = require("../utils/createPayment");
const { Op } = require("sequelize");
const { expenseRequestMessages } = require("../constants/message/expenseRequestMessages");

const INCLUDES = [
  {
    model: Employee,
    as: "requester",
    attributes: ["id", "empId", "name", "level"],
  },
  { model: Employee, as: "verifier", attributes: ["id", "empId", "name","level"] },
  { model: Employee, as: "approver", attributes: ["id", "empId", "name","level"] },
  { model: Employee, as: "rejecter", attributes: ["id", "empId", "name","level"] },
];

/** Shared list logic — `where` is built by the caller so "mine" vs "everyone's" can differ. */
async function listExpenseRequests(where, req, res, next, { viewerId } = {}) {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const { status, search } = req.query;

    if (status) {
      where.status = status;
    }

    if (search?.trim()) {
      const searchTerm = `%${search.trim()}%`;
      where[Op.or] = [
        { requestCode: { [Op.like]: searchTerm } },
        { purpose: { [Op.like]: searchTerm } },
      ];
    }

    const result = await ExpenseRequest.findAndCountAll({
      where,
      include: INCLUDES,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    const response = buildPaginatedResponse(result, page, limit);
    if (viewerId) response.data = withCreatorFlags(result.rows, viewerId); // createdByMe / createdOnBehalf / canEdit
    return success(res, 200, expenseRequestMessages.expenseRequestsFetchedSuccessfully, response);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/expense-requests/my-requests — the "Requests" tab: requests raised
 * for me + requests I created for a supervisor. Each row has createdByMe /
 * createdOnBehalf / canEdit (only the creator edits, while pending).
 */
async function getMyExpenseRequests(req, res, next) {
  return listExpenseRequests(myRequestsScope(req.employee.id), req, res, next, { viewerId: req.employee.id });
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
    if (!id) return error(res, 400, expenseRequestMessages.idIsRequired);

    const request = await ExpenseRequest.findByPk(id, { include: INCLUDES });
    if (!request) return error(res, 404, expenseRequestMessages.expenseRequestNotFound);

    return success(res, 200, expenseRequestMessages.expenseRequestFetchedSuccessfully, {
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

    if (!purpose) return error(res, 400, expenseRequestMessages.purposeIsRequired);
    if (!amount) return error(res, 400, expenseRequestMessages.amountIsRequired);

    let requestedBy = req.employee.id;
    const { requestedBy: onBehalfOf } = req.body;
    if (onBehalfOf && Number(onBehalfOf) !== req.employee.id) {
      if (!["L1", "L2"].includes(req.employee.level)) {
        return error(
          res,
          403,
          expenseRequestMessages.onlyL1OrL2EmployeesCan,
        );
      }
      const targetEmployee = await Employee.findByPk(onBehalfOf);
      if (!targetEmployee)
        return error(res, 404, expenseRequestMessages.requestedByEmployeeNotFound);
      requestedBy = Number(onBehalfOf);
    }

    const bill = req.file;

    const request = await ExpenseRequest.create({
      requestedBy,
      createdBy: req.employee.id,
      purpose,
      amount,
      billUrl: bill ? bill.key : null, // S3 key (or local /uploads path)
      note,
      status: "pending",
    });
    const requestCode = await generateId("EX", request?.id);
    await request.update({ requestCode });

    const created = await ExpenseRequest.findByPk(request.id, {
      include: INCLUDES,
    });

    return success(res, 201, expenseRequestMessages.expenseRequestCreatedSuccessfully, {
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
    if (!id) return error(res, 400, expenseRequestMessages.idIsRequired);

    const request = await ExpenseRequest.findByPk(id);
    if (!request) return error(res, 404, expenseRequestMessages.expenseRequestNotFound);

    if (request.status !== "pending") {
      return error(
        res,
        409,
        expenseRequestMessages.expenseRequestsCanOnlyBeEdited,
      );
    }

    const { purpose, amount, note } = req.body;
    const bill = req.file;

    await request.update({
      ...(purpose !== undefined && { purpose }),
      ...(amount !== undefined && { amount }),
      ...(note !== undefined && { note }),
      ...(bill && { billUrl: bill.key }),
    });

    return success(res, 200, expenseRequestMessages.expenseRequestUpdatedSuccessfully, {
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
    if (!request) return error(res, 404, expenseRequestMessages.expenseRequestNotFound);

    if (request.status !== "pending") {
      return error(
        res,
        409,
        expenseRequestMessages.cannotVerifyARequestWithStatus(request.status),
      );
    }

    await request.update({
      status: "verified",
      verifiedBy: req.employee.id,
      verifiedAt: new Date(),
    });

    return success(res, 200, expenseRequestMessages.expenseRequestVerifiedSuccessfully, {
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
    if (!request) return error(res, 404, expenseRequestMessages.expenseRequestNotFound);

    if (request.status !== "verified") {
      return error(
        res,
        409,
        expenseRequestMessages.cannotApproveARequestWithStatus(request.status),
      );
    }

    await request.update({
      status: "approved",
      approvedBy: req.employee.id,
      approvedAt: new Date(),
    });

    const payment = await createPaymentIfNeeded({
      type: "supervisor",
      sourceRequestType: "expense_request",
      sourceRequestId: request.id,
      recipientType: "supervisor",
      recipientId: request.requestedBy,
      amount: request.amount,
      createdBy: req.employee.id,
    });

    const updated = await ExpenseRequest.findByPk(id, { include: INCLUDES });

    return success(res, 200, expenseRequestMessages.expenseRequestApprovedSuccessfully, {
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
    if (!request) return error(res, 404, expenseRequestMessages.expenseRequestNotFound);

    if (["approved", "rejected", "paid"].includes(request.status)) {
      return error(
        res,
        409,
        expenseRequestMessages.cannotRejectARequestWithStatus(request.status),
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

    return success(res, 200, expenseRequestMessages.expenseRequestRejected, { data: request });
  } catch (err) {
    next(err);
  }
}

/**
 * KPI cards — GET /my-summary (Requests page, own requests) and
 * GET /summary (Verifications / Approvals pages, everyone's).
 * Returns { total, pending, verified, approved, rejected, paid }.
 */
const {
  getMySummary: getMyExpenseSummary,
  getSummary: getExpenseSummary,
} = createSummaryHandlers(ExpenseRequest, ["pending", "verified", "approved", "rejected", "paid"], { label: "Expense request" });

module.exports = {
  getMyExpenseSummary,
  getExpenseSummary,
  getMyExpenseRequests,
  getAllExpenseRequests,
  getExpenseRequestById,
  createExpenseRequest,
  updateExpenseRequest,
  verifyExpenseRequest,
  approveExpenseRequest,
  rejectExpenseRequest,
};
