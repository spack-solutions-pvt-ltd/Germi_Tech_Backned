"use strict";
const { Op } = require("sequelize");
const {
  sequelize,
  Notification,
  NotificationResponse,
  Employee,
} = require("../models");
const {
  getPagination,
  buildPaginatedResponse,
} = require("../utils/pagination");
const { success, error } = require("../utils/response");
const { generateId } = require("../utils/generateIds");

/**
 * Card counts for the list page:
 * - unreadCount: notifications with zero responses so far ("awaiting acknowledgement")
 * - l1Count / l2Count / l3Count: notifications visible to that level —
 *   i.e. sent directly to it, OR sent "to All" (matches the reference UI:
 *   one "to All" notification bumps every level's count by one).
 */
const getNotificationSummary = async () => {
  const [unreadRows] = await sequelize.query(
    `SELECT COUNT(*) as count FROM notifications n
     WHERE NOT EXISTS (SELECT 1 FROM notificationresponses r WHERE r.notificationId = n.id)`,
  );

  const [l1Count, l2Count, l3Count] = await Promise.all([
    Notification.count({ where: { toLevel: { [Op.in]: ["L1", "All"] } } }),
    Notification.count({ where: { toLevel: { [Op.in]: ["L2", "All"] } } }),
    Notification.count({ where: { toLevel: { [Op.in]: ["L3", "All"] } } }),
  ]);

  return {
    unreadCount: Number(unreadRows[0].count),
    l1Count,
    l2Count,
    l3Count,
  };
};

/** GET /api/notifications?search=kharif&toLevel=L3&page=1&limit=20 */
const getAllNotifications = async (req, res, next) => {
  try {
    const { search, toLevel } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = {};
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { message: { [Op.like]: term } },
        { notificationId: { [Op.like]: term } },
      ];
    }
    if (toLevel) where.toLevel = toLevel;

    const [result, summary] = await Promise.all([
      Notification.findAndCountAll({
        where,
        include: [
          {
            model: Employee,
            as: "sender",
            attributes: ["id", "empId", "name", "level"],
          },
        ],
        attributes: {
          include: [
            [
              sequelize.literal(
                "(SELECT COUNT(*) FROM notificationresponses WHERE notificationresponses.notificationId = Notification.id)",
              ),
              "responsesCount",
            ],
          ],
        },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      }),
      getNotificationSummary(),
    ]);

    return success(res, 200, "Notifications fetched successfully", {
      ...buildPaginatedResponse(result, page, limit),
      summary,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/notifications/:id — the "View Page": details + responses together */
const getNotificationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const notification = await Notification.findByPk(id, {
      include: [
        {
          model: Employee,
          as: "sender",
          attributes: ["id", "empId", "name", "level"],
        },
        {
          model: NotificationResponse,
          as: "responses",
          include: [
            {
              model: Employee,
              as: "responder",
              attributes: ["id", "empId", "name", "level"],
            },
          ],
          separate: true,
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    if (!notification) return error(res, 404, "Notification not found");

    return success(res, 200, "Notification fetched successfully", {
      data: {
        ...notification.toJSON(),
        responsesCount: notification.responses.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications (multipart/form-data if an image is attached)
 * fields: toLevel ('L1'|'L2'|'L3'|'All'), message, image (optional file)
 */
const createNotification = async (req, res, next) => {
  try {
    if (!req.employee) {
      return error(res, 401, "Authentication required to send a notification");
    }

    const { toLevel, message } = req.body;

    if (!toLevel) return error(res, 400, "toLevel is required");
    if (!["L1", "L2", "L3", "All"].includes(toLevel)) {
      return error(res, 400, "toLevel must be one of L1, L2, L3, All");
    }
    if (!message) return error(res, 400, "message is required");

    const imageUrl = req.file
      ? `/uploads/notifications/${req.file.filename}`
      : null;

    const notification = await Notification.create({
      sentBy: req.employee.id,
      toLevel,
      message,
      imageUrl,
    });
    const notificationId = generateId("NT", notification.id);
    await notification.update({ notificationId });

    const created = await Notification.findByPk(notification.id, {
      include: [
        {
          model: Employee,
          as: "sender",
          attributes: ["id", "empId", "name", "level"],
        },
      ],
    });

    return success(res, 201, "Notification sent successfully", {
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT/PATCH /api/notifications/:id
 * Blocked once responses exist — editing a broadcast after people have
 * already replied to it would be misleading. Remove this guard if you'd
 * rather allow it.
 */
const updateNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) return error(res, 400, "id is required");

    const notification = await Notification.findByPk(id, {
      include: [{ model: NotificationResponse, as: "responses" }],
    });
    if (!notification) return error(res, 404, "Notification not found");

    if (notification.responses.length > 0) {
      return error(
        res,
        409,
        "Cannot edit a notification that already has responses",
      );
    }

    const { toLevel, message } = req.body;

    if (toLevel !== undefined && !["L1", "L2", "L3", "All"].includes(toLevel)) {
      return error(res, 400, "toLevel must be one of L1, L2, L3, All");
    }

    const imageUrl = req.file
      ? `/uploads/notifications/${req.file.filename}`
      : undefined;

    await notification.update({
      ...(toLevel !== undefined && { toLevel }),
      ...(message !== undefined && { message }),
      ...(imageUrl !== undefined && { imageUrl }),
    });

    return success(res, 200, "Notification updated successfully", {
      data: notification,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /api/notifications/:notificationId/responses?page=1&limit=20 */
const getResponsesByNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    if (!notificationId) return error(res, 400, "notificationId is required");

    const notification = await Notification.findByPk(notificationId);
    if (!notification) return error(res, 404, "Notification not found");

    const { page, limit, offset } = getPagination(req.query);

    const result = await NotificationResponse.findAndCountAll({
      where: { notificationId },
      include: [
        {
          model: Employee,
          as: "responder",
          attributes: ["id", "empId", "name", "level"],
        },
      ],
      order: [["createdAt", "ASC"]],
      limit,
      offset,
    });

    return success(
      res,
      200,
      "Notification responses fetched successfully",
      buildPaginatedResponse(result, page, limit),
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications/:notificationId/responses
 * Not in your original list, but needed for the Response Table to ever have
 * rows — this is how a recipient (L1/L2/L3) submits their reply.
 * body: { message }
 */
const createNotificationResponse = async (req, res, next) => {
  try {
    if (!req.employee) {
      return error(
        res,
        401,
        "Authentication required to respond to a notification",
      );
    }

    const { notificationId } = req.params;
    if (!notificationId) return error(res, 400, "notificationId is required");

    const notification = await Notification.findByPk(notificationId);
    if (!notification) return error(res, 404, "Notification not found");

    const { message } = req.body;
    if (!message) return error(res, 400, "message is required");

    const response = await NotificationResponse.create({
      notificationId,
      respondedBy: req.employee.id,
      message,
    });

    const created = await NotificationResponse.findByPk(response.id, {
      include: [
        {
          model: Employee,
          as: "responder",
          attributes: ["id", "empId", "name", "level"],
        },
      ],
    });

    return success(res, 201, "Response submitted successfully", {
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  getResponsesByNotification,
  createNotificationResponse,
};
