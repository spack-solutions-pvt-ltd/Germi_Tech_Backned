"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, { foreignKey: "sentBy", as: "sender" });
      this.hasMany(models.NotificationResponse, {
        foreignKey: "notificationId",
        as: "responses",
        onDelete: "CASCADE",
      });
    }
  }

  Notification.init(
    {
      notificationId: DataTypes.STRING(30),
      sentBy: DataTypes.INTEGER,
      toLevel: {
        type: DataTypes.ENUM("L1", "L2", "L3", "All"),
        allowNull: false,
      },
      message: { type: DataTypes.TEXT, allowNull: false },
      imageUrl: DataTypes.STRING(500),
    },
    {
      sequelize,
      modelName: "Notification",
    },
  );

  return Notification;
};
