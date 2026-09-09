"use strict";
const bcrypt = require("bcrypt");
const { Employee, Role, Permission } = require("../../models");

module.exports = {
  async up(queryInterface, Sequelize) {
    const allPermissions = await Permission.findAll();

    const [adminRole] = await Role.findOrCreate({
      where: { name: "Admin" },
      defaults: {
        name: "Admin",
        level: "L1",
        description:
          "Full system access. Every permission is enabled by default.",
        status: "Active",
      },
    });

    await adminRole.setPermissions(allPermissions);

    const existing = await Employee.findOne({
      where: { empId: "EMP-0001" },
    });

    if (existing) {
      console.log("Admin employee already exists, skipping.");
    } else {
      const rawPassword = process.env.ADMIN_SEED_PASSWORD || "ChangeMe@123";
      const passwordHash = await bcrypt.hash(rawPassword, 10);

      await Employee.create({
        empId: "EMP-0001",
        name: "Super Admin",
        number: "9999999999",
        email: "admin@germitech.com",
        password: passwordHash,
        level: "L1",
        roleId: adminRole.id,
        status: "Active",
      });

      console.log(
        `Admin employee created (empId: EMP-0001). Login password: ${rawPassword} — change this immediately after first login.`,
      );
    }

    console.log(
      `Admin role ready with ${allPermissions.length} permissions attached.`,
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("employees", { empId: "EMP-0001" }, {});
    await queryInterface.bulkDelete("roles", { name: "Admin" }, {});
  },
};
