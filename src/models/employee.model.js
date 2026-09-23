"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Employee extends Model {
    static associate(models) {
      this.belongsTo(models.Role, { foreignKey: "roleId", as: "role" });

      this.hasMany(models.EmployeeDocument, {
        foreignKey: "employeeId",
        as: "documents",
        onDelete: "CASCADE",
      });

      this.hasMany(models.EmployeeInsurance, {
        foreignKey: "employeeId",
        as: "insurances",
        onDelete: "CASCADE",
      });

      // Who last edited this employee's bank account card (shown as
      // "Last updated ... <name>" on the employee details page). Self-join
      // on Employee, so it needs its own alias distinct from the "employee"
      // side of the relationship.
      this.belongsTo(models.Employee, { foreignKey: "bankUpdatedBy", as: "bankUpdater" });

      // Direct, per-employee permission overrides (on top of their Role).
      this.belongsToMany(models.Permission, {
        through: models.IndividualPermission,
        foreignKey: "employeeId",
        as: "individualPermissions",
      });

      this.hasMany(models.SeedCompany, {
        foreignKey: "createdBy",
        as: "createdSeedCompany",
      });
      this.hasMany(models.Village, {
        foreignKey: "createdBy",
        as: "createdVillage",
      });
      // Villages this employee is a general assigned supervisor for.
      // this.belongsToMany(models.Village, {
      //   through: models.VillageSupervisor,
      //   foreignKey: "employeeId",
      //   otherKey: "villageId",
      //   as: "supervisedVillages",
      // });

      // Specific allotment-village rows this employee supervises.
      this.hasMany(models.AllotmentVillage, {
        foreignKey: "supervisorId",
        as: "allotmentSupervisions",
      });
      // Sub organizers this employee created/onboarded.
      this.hasMany(models.SubOrganizer, {
        foreignKey: "createdBy",
        as: "createdSubOrganizers",
      });

      // Labor groups this employee created/onboarded.
      this.hasMany(models.LaborGroup, {
        foreignKey: "createdBy",
        as: "createdLaborGroups",
      });
      // Notifications this employee has broadcast
      this.hasMany(models.Notification, {
        foreignKey: "sentBy",
        as: "sentNotifications",
      });
      this.hasMany(models.NotificationResponse, {
        foreignKey: "respondedBy",
        as: "notificationResponses",
      });
      // Task management — independent module, only ever touches Employee.
      this.hasMany(models.Task, {
        foreignKey: "assignedBy",
        as: "tasksCreated",
      });
      this.hasMany(models.Task, {
        foreignKey: "assignedTo",
        as: "tasksAssigned",
      });
      this.hasMany(models.Task, {
        foreignKey: "approvedBy",
        as: "tasksApproved",
      });
      this.hasMany(models.TaskNote, {
        foreignKey: "authorId",
        as: "taskNotes",
      });
      this.hasMany(models.LabourRequest, {
        foreignKey: "supervisorId",
        as: "labourRequests",
      });
    }
  }

  Employee.init(
    {
      empId: DataTypes.STRING,
      name: DataTypes.STRING,
      number: DataTypes.STRING,
      alternateNumber: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      level: DataTypes.ENUM("L1", "L2", "L3"),
      roleId: DataTypes.INTEGER,
      joiningDate: DataTypes.DATEONLY,
      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        allowNull: false,
        defaultValue: "Active",
      },
      resetPasswordToken: DataTypes.STRING,
      resetPasswordExpires: DataTypes.DATE,

      // --- Bank account details card ("Salary and reimbursement account") ---
      accountHolderName: DataTypes.STRING(150),
      accountNumber: DataTypes.STRING(50),
      ifscCode: DataTypes.STRING(20),
      bankName: DataTypes.STRING(150),
      upiId: DataTypes.STRING(100),
      bankUpdatedBy: DataTypes.INTEGER, // Employee.id of whoever last saved the bank card
      bankUpdatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Employee",
    },
  );

  return Employee;
};