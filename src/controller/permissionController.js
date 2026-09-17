"use strict";
const { Employee, Role, Permission } = require("../models");
const { PERMISSION_MODULES } = require("../constants/permissions");
const { buildPermissionMap } = require("../utils/permissionMap");
const { success, error } = require("../utils/response");

function humanizeModule(moduleKey) {
  return moduleKey
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * GET /api/permissions
 * The full catalog, grouped by module — exactly what the Create Role screen
 * needs to render: one heading per module, one radio button per option.
 * Not tied to any specific role; this is just "what exists to choose from."
 */
async function getAllPermissions(req, res, next) {
  try {
    const permissions = await Permission.findAll({});

    const moduleLabels = Object.fromEntries(
      PERMISSION_MODULES.map((m) => [m.module, m.label]),
    );

    const grouped = permissions.reduce((acc, p) => {
      if (!acc[p.module]) {
        acc[p.module] = {
          module: p.module,
          label: moduleLabels[p.module] || humanizeModule(p.module),
          options: [],
        };
      }
      acc[p.module].options.push({
        code: p.code,
        action: p.action,
        name: p.name,
        description: p.description,
      });
      return acc;
    }, {});

    return success(res, 200, "Permissions fetched successfully", {
      data: Object.values(grouped),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/employees/me/permissions
 * Requires auth middleware to have set req.employee = { id: <employeeId>, ... }
 */
async function getMyPermissions(req, res, next) {
  try {
    if (!req.employee) return error(res, 401, "Authentication required");

    const employee = await Employee.findByPk(req.employee.id, {
      include: {
        model: Role,
        as: "role",
        include: { model: Permission, as: "permissions" },
      },
    });
    if (!employee) return error(res, 404, "Employee not found");

    return success(
      res,
      200,
      "Permissions fetched successfully",
      formatPermissionResponse(employee.role),
    );
  } catch (err) {
    next(err);
  }
}

/** GET /api/employees/:id/permissions */
async function getEmployeePermissions(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const employee = await Employee.findByPk(id, {
      include: {
        model: Role,
        as: "role",
        include: { model: Permission, as: "permissions" },
      },
    });
    if (!employee) return error(res, 404, "Employee not found");

    return success(
      res,
      200,
      "Permissions fetched successfully",
      formatPermissionResponse(employee.role),
    );
  } catch (err) {
    next(err);
  }
}

function formatPermissionResponse(role) {
  const permissions = role.permissions.map((p) => ({
    code: p.code,
    module: p.module,
    action: p.action,
    name: p.name,
  }));

  return {
    data: {
      role: { id: role.id, name: role.name },
      permissions,
      permissionMap: buildPermissionMap(permissions),
    },
  };
}

module.exports = {
  getAllPermissions,
  getMyPermissions,
  getEmployeePermissions,
};
