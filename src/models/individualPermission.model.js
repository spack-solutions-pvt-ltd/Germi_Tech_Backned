"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class IndividualPermission extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "employeeId" });
      this.belongsTo(models.Permission, { foreignKey: "permissionId" });
    }
  }

  IndividualPermission.init(
    {
      employeeId: DataTypes.INTEGER,
      permissionId: DataTypes.INTEGER,
      effect: {
        type: DataTypes.ENUM("grant", "revoke"),
        allowNull: false,
        defaultValue: "grant",
      },
    },
    {
      sequelize,
      modelName: "IndividualPermission",
      indexes: [{ unique: true, fields: ["employeeId", "permissionId"] }],
    }
  );

  return IndividualPermission;
};