"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class TaskType extends Model {
    static associate(models) {
      this.hasMany(models.Task, { foreignKey: "taskTypeId", as: "tasks" });
    }
  }

  TaskType.init(
    {
      taskTypeId: DataTypes.STRING,
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      description: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "TaskType",
    },
  );

  return TaskType;
};
