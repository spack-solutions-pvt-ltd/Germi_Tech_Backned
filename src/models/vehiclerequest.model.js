"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class VehicleRequest extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "requestedBy", as: "requester" });
      this.belongsTo(models.Employee, { foreignKey: "createdBy", as: "creator" });
      this.belongsTo(models.Employee, { foreignKey: "assignedBy", as: "assigner" });
      this.belongsTo(models.Employee, { foreignKey: "cancelledBy", as: "canceller" });
      this.belongsTo(models.AllotmentVillage, { foreignKey: "allotmentVillageId", as: "allotmentVillage" });
      this.belongsTo(models.Warehouse, { foreignKey: "toWarehouseId", as: "toWarehouse" });
      this.belongsTo(models.LogisticsPartner, { foreignKey: "logisticsPartnerId", as: "logisticsPartner" });
      this.belongsTo(models.Vehicle, { foreignKey: "vehicleId", as: "vehicle" });
    }
  }

  VehicleRequest.init(
    {
      requestCode: { type: DataTypes.STRING(30), allowNull: false, unique: true },
      requestedBy: DataTypes.INTEGER, //(the supervisor)
      createdBy: DataTypes.INTEGER, // who actually submitted it — differs when L1/L2 create it on a supervisor's behalf
      allotmentVillageId: DataTypes.INTEGER,
      toWarehouseId: DataTypes.INTEGER,
      approxBags: DataTypes.INTEGER,
      approxQtyKgs: DataTypes.DECIMAL(10, 2),
      note: DataTypes.TEXT,
      status: {
        type: DataTypes.ENUM("pending", "in_process", "assigned", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      assignedBy: DataTypes.INTEGER,
      logisticsPartnerId: DataTypes.INTEGER,
      vehicleId: DataTypes.INTEGER,
      cancelledBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "VehicleRequest",
      tableName: "vehicle_requests",
    }
  );

  return VehicleRequest;
};