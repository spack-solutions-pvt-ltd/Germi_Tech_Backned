"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RolePermission extends Model {
    static associate(models) {
      // pure join table — associations are declared on Role and Permission instead
    }
  }

  RolePermission.init(
    {
      roleId: DataTypes.INTEGER,
      permissionId: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "RolePermission",
      indexes: [{ unique: true, fields: ["roleId", "permissionId"] }],
    },
  );

  return RolePermission;
};
