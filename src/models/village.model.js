"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Village extends Model {
    static associate(models) {
      this.belongsTo(models.State, { foreignKey: "stateId", as: "state" });
    //   this.hasMany(models.SubOrganizer, { foreignKey: "villageId", as: "subOrganizers" });

    //   this.hasMany(models.AllotmentVillage, { foreignKey: "villageId", as: "allotmentVillages" });
    //   this.belongsToMany(models.Employee, {
    //     through: models.VillageSupervisor,
    //     foreignKey: "villageId",
    //     otherKey: "employeeId",
    //     as: "supervisors",
    //   });
    }
  }

  Village.init(
    {
      villageId: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true,
      },
      name: DataTypes.STRING(150),
      mandal: DataTypes.STRING(100),
      district: DataTypes.STRING(100),
      pincode: DataTypes.STRING(10),
      stateId: DataTypes.INTEGER,
      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
    },
    {
      sequelize,
      modelName: "Village",
    }
  );

  return Village;
};