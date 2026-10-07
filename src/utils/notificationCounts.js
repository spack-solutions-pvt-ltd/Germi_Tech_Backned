"use strict";
const { Op } = require("sequelize");
const { sequelize, Notification } = require("../models");

// Counts for "my notifications": everything sent to the employee's level or
// to "All", and the part of it they haven't responded to yet (unread).
// Used by GET /auth/me (bell badge) and GET /notifications/my-notifications.

/** SQL: has this employee responded to the current Notification row? */
function respondedBySql(employeeId) {
  return `EXISTS (
    SELECT 1 FROM \`NotificationResponses\` AS nr
    WHERE nr.notificationId = \`Notification\`.id
      AND nr.respondedBy = ${sequelize.escape(employeeId)}
  )`;
}

const forLevel = (level) => ({ toLevel: { [Op.in]: [level, "All"] } });

/** { total, unread } for one employee ({ id, level }). */
async function getMyNotificationCounts(employee) {
  const [total, unread] = await Promise.all([
    Notification.count({ where: forLevel(employee.level) }),
    Notification.count({
      where: {
        [Op.and]: [forLevel(employee.level), sequelize.literal(`NOT ${respondedBySql(employee.id)}`)],
      },
    }),
  ]);
  return { total, unread };
}

module.exports = { respondedBySql, getMyNotificationCounts };
