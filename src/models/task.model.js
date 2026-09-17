"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // Independent of every other module — only ever references Employee and
  // its own TaskType.
  class Task extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, {
        foreignKey: "assignedBy",
        as: "assignedByEmployee",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "assignedTo",
        as: "assignedToEmployee",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "approvedBy",
        as: "approvedByEmployee",
      });
      this.belongsTo(models.TaskType, {
        foreignKey: "taskTypeId",
        as: "taskType",
      });
      this.hasMany(models.TaskNote, {
        foreignKey: "taskId",
        as: "notes",
        onDelete: "CASCADE",
      });
    }
  }

  Task.init(
    {
      taskId: DataTypes.STRING(30),
      assignedBy: DataTypes.INTEGER,
      assignedTo: DataTypes.INTEGER,
      taskTypeId: DataTypes.INTEGER,
      description: { type: DataTypes.TEXT, allowNull: false },
      assignedDate: DataTypes.DATE,
      dueDate: { type: DataTypes.DATE, allowNull: false },
      status: {
        type: DataTypes.ENUM(
          "Pending",
          "Approval",
          "Completed",
          "Overdue",
          "Cancelled",
        ),
        allowNull: false,
        defaultValue: "Pending",
      },
      reassignCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      approvedBy: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: "Task",
    },
  );

  return Task;
};
