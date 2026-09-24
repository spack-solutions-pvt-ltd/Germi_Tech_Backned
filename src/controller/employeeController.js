"use strict";
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const {
  Employee,
  EmployeeDocument,
  EmployeeInsurance,
  Role,
} = require("../models");
const { generateDummyPassword } = require("../utils/randomPassword");
const { sendMail } = require("../utils/mailer");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");
const { welcomeEmailTemplate } = require("../templates/welcomeEmail");
const fs = require("fs");
const path = require("path");

const DOCUMENT_LABELS = {
  aadhaar_card: "Aadhaar Card",
  pan_card: "PAN Card",
  drivers_license: "Driver License",
  rc: "RC",
};

const INSURANCE_LABELS = {
  health: "Health",
  life: "Life",
  bike: "Bike",
  accidental: "Accidental",
};

function documentDisplayName(doc) {
  return doc.type === "other" ? doc.label : DOCUMENT_LABELS[doc.type];
}

function insuranceDisplayType(ins) {
  return ins.type === "other" ? ins.otherTypeName : INSURANCE_LABELS[ins.type];
}

const employeeDetailIncludes = [
  { model: Role, as: "role" },
  {
    model: EmployeeDocument,
    as: "documents",
    include: [
      { model: Employee, as: "updater", attributes: ["id", "name", "level"] },
    ],
  },
  {
    model: EmployeeInsurance,
    as: "insurances",
    include: [
      { model: Employee, as: "updater", attributes: ["id", "name", "level"] },
    ],
  },
  { model: Employee, as: "bankUpdater", attributes: ["id", "name", "level"] },
];

// ------------------------------------------------------------------ KPIs --

async function getEmployeeKpis(req, res, next) {
  try {
    const [totalEmployees, l2Employees, l3Employees, inactiveEmployees] =
      await Promise.all([
        Employee.count(),
        Employee.count({ where: { level: "L2" } }),
        Employee.count({ where: { level: "L3" } }),
        Employee.count({ where: { status: "Inactive" } }),
      ]);

    return success(res, 200, "Employee KPIs fetched successfully", {
      data: { totalEmployees, l2Employees, l3Employees, inactiveEmployees },
    });
  } catch (err) {
    next(err);
  }
}

// --------------------------------------------------------------- Listing --

/** GET /api/employees?search=ravi&level=L3&status=Active&roleId=2&page=1&limit=20 */
async function getAllEmployees(req, res, next) {
  try {
    const { search, level, status, roleId } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { empId: { [Op.like]: term } },
      ];
    }
    if (level) where.level = level;
    if (status) where.status = status;
    if (roleId) where.roleId = roleId;

    const result = await Employee.findAndCountAll({
      where,
      include: [{ model: Role, as: "role", attributes: ["id", "name"] }],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Employees fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/employees/:id - full details page: profile, bank card, documents, insurance. */
async function getEmployeeById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const employee = await Employee.findByPk(id, {
      include: employeeDetailIncludes,
    });
    if (!employee) return error(res, 404, "Employee not found");

    const payload = employee.toJSON();
    payload.documents = payload.documents.map((d) => ({
      ...d,
      displayName: documentDisplayName(d),
    }));
    payload.insurances = payload.insurances.map((i) => ({
      ...i,
      displayType: insuranceDisplayType(i),
    }));

    return success(res, 200, "Employee fetched successfully", {
      data: payload,
    });
  } catch (err) {
    next(err);
  }
}

// --------------------------------------------------------------- Profile --

/** POST /api/employees */
async function createEmployee(req, res, next) {
  try {
    const {
      name,
      number,
      alternateNumber,
      email,
      level,
      roleId,
      status,
      joiningDate,
    } = req.body;

    if (!name) return error(res, 400, "name is required");
    if (!number) return error(res, 400, "number is required");
    if (!level) return error(res, 400, "level is required");
    if (!roleId) return error(res, 400, "roleId is required");

    const role = await Role.findByPk(roleId);
    if (!role) return error(res, 404, "Role not found");

    const existingByEmail = await Employee.findOne({ where: { email } });
    if (existingByEmail)
      return error(res, 409, "An employee with this email already exists");

    const plainPassword = generateDummyPassword(10);
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const employee = await Employee.create({
      name,
      number,
      alternateNumber,
      email,
      password: passwordHash,
      level,
      roleId,
      status: status || "Active",
      joiningDate: joiningDate || new Date(),
    });
    const empId = await generateId("EMP", employee?.id);
    await employee.update({ empId });

    let emailSent = true;
    let emailError = null;

    if (email) {
      try {
        await sendMail({
          to: email,
          subject: "Welcome to Germitech — your login details",
          html: welcomeEmailTemplate({
            name,
            empId: employee.empId,
            email,
            password: plainPassword,
            loginUrl:
              process.env.FRONTEND_LOGIN_URL ||
              "https://app.germitech.com/login",
          }),
        });
      } catch (mailErr) {
        emailSent = false;
        emailError = mailErr.message;
      }
    } else {
      emailSent = false;
      emailError =
        "No email provided on this employee — share the password manually.";
    }

    return success(res, 201, "Employee created successfully", {
      emailSent,
      emailError,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT/PATCH /api/employees/:id
 * Basic profile fields only. Not password, not bank/documents/insurance —
 * those go through their own endpoints below.
 */
async function updateEmployee(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const employee = await Employee.findByPk(id);
    if (!employee) return error(res, 404, "Employee not found");

    const {
      name,
      number,
      alternateNumber,
      email,
      level,
      roleId,
      status,
      joiningDate,
    } = req.body;

    if (roleId !== undefined) {
      const role = await Role.findByPk(roleId);
      if (!role) return error(res, 404, "Role not found");
    }

    if (number !== undefined && number !== employee.number) {
      const existingByNumber = await Employee.findOne({
        where: { number, id: { [Op.ne]: id } },
      });
      if (existingByNumber)
        return error(res, 409, "An employee with this number already exists");
    }

    if (email !== undefined && email !== employee.email) {
      const existingByEmail = await Employee.findOne({
        where: { email, id: { [Op.ne]: id } },
      });
      if (existingByEmail)
        return error(res, 409, "An employee with this email already exists");
    }

    await employee.update({
      ...(name !== undefined && { name }),
      ...(number !== undefined && { number }),
      ...(alternateNumber !== undefined && { alternateNumber }),
      ...(email !== undefined && { email }),
      ...(level !== undefined && { level }),
      ...(roleId !== undefined && { roleId }),
      ...(status !== undefined && { status }),
      ...(joiningDate !== undefined && { joiningDate }),
    });

    return success(res, 200, "Employee updated successfully", {
      data: employee,
    });
  } catch (err) {
    next(err);
  }
}

const updateEmployeeStatus = async (req, res, next) => {
  try {
    const { empId } = req.params;
    const { status } = req.body;
    if (!empId) return error(res, 400, "EmployeeId is required");
    if (!status) return error(res, 400, "status is required");
    if (!["Active", "Inactive"].includes(status))
      return error(res, 400, "Invalid status");

    const employee = await Employee.findByPk(empId);
    if (!employee) return error(res, 404, "Employee not found");

    await employee.update({ status });
    return success(res, 200, "Employee status updated successfully");
  } catch (err) {
    next(err);
  }
};

// ----------------------------------------------------------- Bank account --

/**
 * PUT /api/employees/:id/bank-account
 * body: { accountHolderName, accountNumber, ifscCode, bankName, upiId }
 * Powers both "Add account" (fields currently empty) and "Edit" (the same
 * drawer, pre-filled) — same endpoint either way.
 */
async function updateBankAccount(req, res, next) {
  try {
    const { id } = req.params;
    const employee = await Employee.findByPk(id);
    if (!employee) return error(res, 404, "Employee not found");

    const { accountHolderName, accountNumber, ifscCode, bankName, upiId } =
      req.body;
    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return error(
        res,
        400,
        "Account holder name, account number, IFSC code and bank name are required",
      );
    }

    await employee.update({
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
      bankUpdatedBy: req.employee?.id || null,
      bankUpdatedAt: new Date(),
    });

    const updated = await Employee.findByPk(id, {
      include: [
        {
          model: Employee,
          as: "bankUpdater",
          attributes: ["id", "name", "level"],
        },
      ],
    });

    return success(res, 200, "Bank account details updated successfully", {
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------- Documents --

const DOCUMENT_TYPES = [
  "aadhaar_card",
  "pan_card",
  "drivers_license",
  "rc",
  "other",
];

/**
 * POST /api/employees/:id/documents  (multipart/form-data, single file field: "document")
 * body: { type, documentNumber?, label? (required when type = "other") }
 * Always creates a new document row — "Add document".
 */
async function addEmployeeDocument(req, res, next) {
  try {
    const { id } = req.params;
    const employee = await Employee.findByPk(id);
    if (!employee) return error(res, 404, "Employee not found");

    const { type, documentNumber, label } = req.body;
    if (!DOCUMENT_TYPES.includes(type)) {
      return error(
        res,
        400,
        `type must be one of: ${DOCUMENT_TYPES.join(", ")}`,
      );
    }
    if (type === "other" && !label) {
      return error(res, 400, "label is required when type is 'other'");
    }
    if (!req.file) {
      return error(res, 400, "A document file is required");
    }

    const fileUrl = `/uploads/employee-documents/${req.file.filename}`;

    const document = await EmployeeDocument.create({
      employeeId: id,
      type,
      documentNumber,
      label: type === "other" ? label : DOCUMENT_LABELS[type],
      fileUrl,
      originalFileName: req.file.originalname,
      updatedBy: req.employee?.id || null,
    });

    return success(res, 201, "Document added successfully", {
      data: {
        ...document.toJSON(),
        displayName: documentDisplayName(document),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/employees/:id/documents/:documentId  (multipart/form-data, file optional)
 */
async function updateEmployeeDocument(req, res, next) {
  try {
    const { id, documentId } = req.params;
    const document = await EmployeeDocument.findOne({
      where: { id: documentId, employeeId: id },
    });
    if (!document) return error(res, 404, "Document not found");

    const { type, documentNumber, label } = req.body;
    if (type !== undefined && !DOCUMENT_TYPES.includes(type)) {
      return error(
        res,
        400,
        `type must be one of: ${DOCUMENT_TYPES.join(", ")}`,
      );
    }
    const effectiveType = type ?? document.type;
    if (effectiveType === "other" && !(label ?? document.label)) {
      return error(res, 400, "label is required when type is 'other'");
    }

    const patch = {
      ...(type !== undefined && { type }),
      ...(documentNumber !== undefined && { documentNumber }),
      label:
        effectiveType === "other"
          ? (label ?? document.label)
          : DOCUMENT_LABELS[effectiveType],
      updatedBy: req.employee?.id || null,
    };

    if (req.file) {
      patch.fileUrl = `/uploads/employee-documents/${req.file.filename}`;
      patch.originalFileName = req.file.originalname;
    }

    await document.update(patch);

    return success(res, 200, "Document updated successfully", {
      data: {
        ...document.toJSON(),
        displayName: documentDisplayName(document),
      },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/employees/:id/documents/:documentId - "View" drawer. */
async function getEmployeeDocument(req, res, next) {
  try {
    const { id, documentId } = req.params;
    const document = await EmployeeDocument.findOne({
      where: { id: documentId, employeeId: id },
      include: [
        { model: Employee, as: "updater", attributes: ["id", "name", "level"] },
      ],
    });
    if (!document) return error(res, 404, "Document not found");

    return success(res, 200, "Document fetched successfully", {
      data: {
        ...document.toJSON(),
        displayName: documentDisplayName(document),
      },
    });
  } catch (err) {
    next(err);
  }
}

const downloadEmployeeDocument = async (req, res, next) => {
  try {
    const { id, documentId } = req.params;

    const document = await EmployeeDocument.findOne({
      where: {
        id: documentId,
        employeeId: id,
      },
    });

    if (!document) {
      return error(res, 404, "Employee document not found");
    }

    const documentData = document.toJSON();

    console.log("Employee Document:", documentData);

    // Get the stored file path/name.
    // Change these according to the column used in your model.
    const storedPath = documentData.fileUrl;

    if (!storedPath) {
      return error(res, 404, "Document file path is missing");
    }

    // If DB already contains the complete/relative path,
    // resolve it from the project root.
    const filePath = path.isAbsolute(storedPath)
      ? storedPath
      : path.join(process.cwd(), storedPath);

    console.log("Stored path:", storedPath);
    console.log("Resolved file path:", filePath);

    if (!fs.existsSync(filePath)) {
      return error(res, 404, "File not found on server");
    }

    const fileName = path.basename(filePath);

    return res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("File download error:", err);

        if (!res.headersSent) {
          next(err);
        }
      }
    });
  } catch (err) {
    console.error("Download employee document error:", err);
    next(err);
  }
};

async function deleteEmployeeDocument(req, res, next) {
  try {
    const { id, documentId } = req.params;
    const document = await EmployeeDocument.findOne({
      where: { id: documentId, employeeId: id },
    });
    if (!document) return error(res, 404, "Document not found");
    await document.destroy();
    return success(res, 200, "Document deleted successfully");
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------- Insurance --

const INSURANCE_TYPES = ["health", "life", "bike", "accidental", "other"];

/**
 * POST /api/employees/:id/insurance
 * body: { type, otherTypeName? (required when type='other'), provider, startDate, expiryDate, amount }
 */
async function addEmployeeInsurance(req, res, next) {
  try {
    const { id } = req.params;
    const employee = await Employee.findByPk(id);
    if (!employee) return error(res, 404, "Employee not found");

    const { type, otherTypeName, provider, startDate, expiryDate, amount } =
      req.body;
    if (!INSURANCE_TYPES.includes(type)) {
      return error(
        res,
        400,
        `type must be one of: ${INSURANCE_TYPES.join(", ")}`,
      );
    }
    if (type === "other" && !otherTypeName) {
      return error(res, 400, "otherTypeName is required when type is 'other'");
    }
    if (!provider || !startDate || !expiryDate || amount === undefined) {
      return error(
        res,
        400,
        "provider, startDate, expiryDate and amount are required",
      );
    }

    const insurance = await EmployeeInsurance.create({
      employeeId: id,
      type,
      otherTypeName: type === "other" ? otherTypeName : null,
      provider,
      startDate,
      expiryDate,
      amount,
      updatedBy: req.employee?.id || null,
    });

    return success(res, 201, "Insurance added successfully", {
      data: {
        ...insurance.toJSON(),
        displayType: insuranceDisplayType(insurance),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/employees/:id/insurance/:insuranceId
 * body: { type?, otherTypeName?, provider?, startDate?, expiryDate?, amount? }
 */
async function updateEmployeeInsurance(req, res, next) {
  try {
    const { id, insuranceId } = req.params;
    const insurance = await EmployeeInsurance.findOne({
      where: { id: insuranceId, employeeId: id },
    });
    if (!insurance) return error(res, 404, "Insurance record not found");

    const { type, otherTypeName, provider, startDate, expiryDate, amount } =
      req.body;
    if (type !== undefined && !INSURANCE_TYPES.includes(type)) {
      return error(
        res,
        400,
        `type must be one of: ${INSURANCE_TYPES.join(", ")}`,
      );
    }
    const effectiveType = type ?? insurance.type;
    if (
      effectiveType === "other" &&
      !(otherTypeName ?? insurance.otherTypeName)
    ) {
      return error(res, 400, "otherTypeName is required when type is 'other'");
    }

    await insurance.update({
      ...(type !== undefined && { type }),
      otherTypeName:
        effectiveType === "other"
          ? (otherTypeName ?? insurance.otherTypeName)
          : null,
      ...(provider !== undefined && { provider }),
      ...(startDate !== undefined && { startDate }),
      ...(expiryDate !== undefined && { expiryDate }),
      ...(amount !== undefined && { amount }),
      updatedBy: req.employee?.id || null,
    });

    return success(res, 200, "Insurance updated successfully", {
      data: {
        ...insurance.toJSON(),
        displayType: insuranceDisplayType(insurance),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getEmployeeInsurance(req, res, next) {
  try {
    const { id, insuranceId } = req.params;
    const insurance = await EmployeeInsurance.findOne({
      where: { id: insuranceId, employeeId: id },
      include: [
        { model: Employee, as: "updater", attributes: ["id", "name", "level"] },
      ],
    });
    if (!insurance) return error(res, 404, "Insurance record not found");

    return success(res, 200, "Insurance fetched successfully", {
      data: {
        ...insurance.toJSON(),
        displayType: insuranceDisplayType(insurance),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  getEmployeeKpis,
  updateBankAccount,
  addEmployeeDocument,
  updateEmployeeDocument,
  getEmployeeDocument,
  downloadEmployeeDocument,
  deleteEmployeeDocument,
  addEmployeeInsurance,
  updateEmployeeInsurance,
  getEmployeeInsurance,
};
