"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    static associate(models) {
      this.hasMany(models.Employee, { foreignKey: "roleId", as: "employees" });
      this.belongsToMany(models.Permission, {
        through: models.RolePermission,
        foreignKey: "roleId",
        otherKey: "permissionId",
        as: "permissions",
      });
    }
  }

  Role.init(
    {
      roleId: DataTypes.STRING,
      name: { type: DataTypes.STRING, unique: true },
      description: DataTypes.STRING,
      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
    },
    {
      sequelize,
      modelName: "Role",
    },
  );

  return Role;
};
