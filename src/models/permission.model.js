"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Permission extends Model {
    static associate(models) {
      // Normal path: permissions attached to a Role, inherited by every
      // employee who holds that role.
      this.belongsToMany(models.Role, {
        through: models.RolePermission,
        foreignKey: "permissionId",
        otherKey: "roleId",
        as: "roles",
      });

      // Override path: permissions attached directly to one Employee,
      // on top of (or instead of) whatever their Role grants. See
      // IndividualPermission.effect ('grant' | 'revoke').
      this.belongsToMany(models.Employee, {
        through: models.IndividualPermission,
        foreignKey: "permissionId",
        otherKey: "employeeId",
        as: "employees",
      });
    }
  }

  Permission.init(
    {
      module: DataTypes.STRING, // e.g. 'payments'
      action: DataTypes.STRING, // e.g. 'make'
      code: DataTypes.STRING, // e.g. 'payments.make' — unique, used in permission checks
      name: DataTypes.STRING, // display name, e.g. 'Make Payments'
      description: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Permission",
    }
  );

  return Permission;
};