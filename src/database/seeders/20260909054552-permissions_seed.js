"use strict";
const { PERMISSIONS } = require("../../constants/permissions");

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert(
      "permissions",
      PERMISSIONS.map((p) => ({ ...p, createdAt: now, updatedAt: now })),
      {
        // Ignore duplicates on re-run rather than throwing on the unique `code`.
        ignoreDuplicates: true,
      },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "permissions",
      { code: PERMISSIONS.map((p) => p.code) },
      {},
    );
  },
};
