"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class NotificationResponse extends Model {
    static associate(models) {
      this.belongsTo(models.Notification, { foreignKey: "notificationId", as: "notification" });
      this.belongsTo(models.Employee, { foreignKey: "respondedBy", as: "responder" });
    }
  }

  NotificationResponse.init(
    {
      notificationId: DataTypes.INTEGER,
      respondedBy: DataTypes.INTEGER,
      message: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      sequelize,
      modelName: "NotificationResponse",
    }
  );

  return NotificationResponse;
};