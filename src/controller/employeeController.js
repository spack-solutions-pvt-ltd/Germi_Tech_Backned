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
const {welcomeEmailTemplate} = require("../templates/welcomeEmail")


// 
async function getEmployeeKpis(req, res, next) {
  try {
    const [totalEmployees, l2Employees, l3Employees, inactiveEmployees] = await Promise.all([
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

/** GET /api/employees/:id */
async function getEmployeeById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const employee = await Employee.findByPk(id, {
      include: [
        { model: Role, as: "role" },
        { model: EmployeeDocument, as: "documents" },
        { model: EmployeeInsurance, as: "insurances" },
      ],
    });

    if (!employee) return error(res, 404, "Employee not found");

    return success(res, 200, "Employee fetched successfully", {
      data: employee,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/employees
 */
async function createEmployee(req, res, next) {
  try {
    const { name, number, alternateNumber, email, level, roleId, status } =
      req.body;

    // --- manual scenario checks, before anything touches the DB in a way that could throw ---
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

    const created = await Employee.findByPk(employee.id, {
      include: [{ model: Role, as: "role" }],
    });

    return success(res, 201, "Employee created successfully");
  } catch (err) {
    next(err);
  }
}

/**
 * PUT/PATCH /api/employees/:id
 * Basic profile fields only. Not password, not documents/insurance — those
 * go through their own endpoints.
 */
async function updateEmployee(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const employee = await Employee.findByPk(id);
    if (!employee) return error(res, 404, "Employee not found");

    const { name, number, alternateNumber, email, level, roleId, status } =
      req.body;

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
    });

    return success(res, 200, "Employee updated successfully", {
      data: employee,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/employees/:id/documents (multipart/form-data)
 * Fields: aadhar, drivers_license, rc, other — each an optional file.
 */
const uploadEmployeeDocuments = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const employee = await Employee.findByPk(id);
    if (!employee) return error(res, 404, "Employee not found");

    const files = req.files || {};
    const documentTypes = ["aadhar", "drivers_license", "rc", "other"];
    const uploaded = [];

    for (const type of documentTypes) {
      const fileEntry = files[type] && files[type][0];
      if (!fileEntry) continue;

      const fileUrl = `/uploads/employee-documents/${fileEntry.filename}`;
      const documentNumber = req.body[`${type}Number`];
      const label = type === "other" ? req.body.otherLabel : undefined;

      const [record, created] = await EmployeeDocument.findOrCreate({
        where: { employeeId: id, type },
        defaults: { employeeId: id, type, fileUrl, documentNumber, label },
      });

      if (!created) {
        await record.update({
          fileUrl,
          ...(documentNumber !== undefined && { documentNumber }),
          ...(label !== undefined && { label }),
        });
      }

      uploaded.push(record);
    }

    if (!uploaded.length) {
      return error(res, 400, "No document files were uploaded");
    }

    return success(res, 200, "Documents uploaded successfully", {
      data: uploaded,
    });
  } catch (err) {
    next(err);
  }
};

const updateEmployeeStatus = async (req, res, next) => {
  try {
    const { empId } = req.params;
    const { status } = req.body;
    if (!empId) return error(res, 400, "EmployeeId is required");

    if (!status) return error(res, 400, "status is required");

    if (!["Active", "Inactive"].includes(status))
      return error(res, 400, "Invalid status");

    const employee = await Employee.findByPk(empId);
    if (!employee) {
      return error(res, 404, "Employee not found");
    }
    await employee.update({ status });
    return success(res, 200, "Employee status updated successfully");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  uploadEmployeeDocuments,
  updateEmployeeStatus,
  getEmployeeKpis
};
