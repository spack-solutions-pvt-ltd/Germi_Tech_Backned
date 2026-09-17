"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  // The reassign <-> reply thread. The task's initial description lives on
  // Task.description itself — this table only holds what happens *after*
  // that: an employee's submission note, an assigner's reassignment note
  // (which the employee's next submission effectively "replies" to), or a
  // cancellation note. Unbounded — a task can be reassigned N times.
  class TaskNote extends Model {
    static associate(models) {
      this.belongsTo(models.Task, { foreignKey: "taskId", as: "task" });
      this.belongsTo(models.Employee, { foreignKey: "authorId", as: "author" });
    }
  }

  TaskNote.init(
    {
      taskId: DataTypes.INTEGER,
      authorId: DataTypes.INTEGER,
      noteType: {
        type: DataTypes.ENUM("submission", "reassign", "cancel"),
        allowNull: false,
      },
      message: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      sequelize,
      modelName: "TaskNote",
    }
  );

  return TaskNote;
};