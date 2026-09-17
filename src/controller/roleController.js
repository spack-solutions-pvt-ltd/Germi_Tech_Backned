"use strict";
const { Op } = require("sequelize");
const { Role, Permission, Employee } = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { buildPermissionMap } = require("../utils/permissionMap");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");


function serializeRole(role) {
  const json = role.toJSON();
  return { ...json, permissionMap: buildPermissionMap(json.permissions) };
}

async function getRoleKpis(req, res, next) {
  try {
    const [totalRoles, totalPermissions, activeRoles, inactiveRoles] =
      await Promise.all([
        Role.count(),
        Permission.count(),
        Role.count({ where: { status: "Active" } }),
        Role.count({ where: { status: "Inactive" } }),
      ]);

    return success(res, 200, "Role KPIs fetched successfully", {
      data: { totalRoles, totalPermissions, activeRoles, inactiveRoles },
    });
  } catch (err) {
    next(err);
  }
}

/** GET all roles */
const getAllRoles = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: term } },
        { roleId: { [Op.like]: term } },
      ];
    }
    if (status) {
      where.status = status;
    }
    const result = await Role.findAndCountAll({
      where,
      include: [
        {
          model: Permission,
          as: "permissions",
        },
      ],
      order: [["createdAt", "DESC"]],
      distinct: true,
      limit,
      offset,
    });

    const rows = await Promise.all(
      result.rows.map(async (role) => {
        const employeeCount = await Employee.count({
          where: {
            roleId: role.id,
          },
        });

        return {
          ...serializeRole(role),
          employeeCount,
        };
      }),
    );

    return success(
      res,
      200,
      "Roles fetched successfully",
      buildPaginatedResponse(
        {
          rows,
          count: result.count,
        },
        page,
        limit,
      ),
    );
  } catch (err) {
    next(err);
  }
};

/** GET /api/roles/:id */
async function getRoleById(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const role = await Role.findByPk(id, {
      include: [
        { model: Permission, as: "permissions" },
        {
          model: Employee,
          as: "employees",
          attributes: ["id", "empId", "name"],
        },
      ],
    });

    if (!role) return error(res, 404, "Role not found");

    return success(res, 200, "Role fetched successfully", {
      data: serializeRole(role),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/roles
 * body: { name, description, status, permissionCodes: string[] }
 */
async function createRole(req, res, next) {
  try {
    const { name, description, status, permissionCodes = [] } = req.body;

    if (!name) return error(res, 400, "name is required");

    let permissions = [];
    if (permissionCodes.length) {
      permissions = await Permission.findAll({
        where: { code: permissionCodes },
      });

      const foundCodes = permissions.map((p) => p.code);
      const missing = permissionCodes.filter(
        (code) => !foundCodes.includes(code),
      );
      if (missing.length) {
        return error(
          res,
          404,
          `Unknown permission code(s): ${missing.join(", ")}`,
        );
      }
    }

    const role = await Role.create({
      name,
      description,
      status: status || "Active",
    });
    const roleId = generateId("RL", role?.id);
    await role.update({ roleId });

    if (permissions.length) {
      await role.setPermissions(permissions);
    }

    const created = await Role.findByPk(role.id, {
      include: [{ model: Permission, as: "permissions" }],
    });

    return success(res, 201, "Role created successfully", {
      data: serializeRole(created),
    });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return error(res, 409, "A role with this name already exists");
    }
    next(err);
  }
}

/**
 * PUT /api/roles/:id
 */
async function updateRole(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const role = await Role.findByPk(id);
    if (!role) return error(res, 404, "Role not found");

    const { name, description, status, permissionCodes } = req.body;

    if (permissionCodes !== undefined) {
      const permissions = await Permission.findAll({
        where: { code: permissionCodes },
      });
      const foundCodes = permissions.map((p) => p.code);
      const missing = permissionCodes.filter(
        (code) => !foundCodes.includes(code),
      );
      if (missing.length) {
        return error(
          res,
          404,
          `Unknown permission code(s): ${missing.join(", ")}`,
        );
      }
      await role.setPermissions(permissions);
    }

    await role.update({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
    });

    const updated = await Role.findByPk(role.id, {
      include: [{ model: Permission, as: "permissions" }],
    });

    return success(res, 200, "Role updated successfully", {
      data: serializeRole(updated),
    });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return error(res, 409, "A role with this name already exists");
    }
    next(err);
  }
}

const updateRoleStatus = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const { status } = req.body;
    if (!roleId) return error(res, 400, "roleId is required");

    if (!status) return error(res, 400, "status is required");

    if (!["Active", "Inactive"].includes(status))
      return error(res, 400, "Invalid status");

    const role = await Role.findByPk(roleId);
    if (!role) {
      return error(res, 404, "Role not found");
    }
    await role.update({ status });
    return success(res, 200, "Role status updated successfully");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  updateRoleStatus,
  getRoleKpis,
};
