"use strict";
const path = require("path");
const fs = require("fs");
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
const { respondedBySql, getMyNotificationCounts } = require("../utils/notificationCounts");
const { LEGACY_UPLOAD_ROOT } = require("../middleWare/upload.middleware");
const { keyFromStored, signedUrl, isCloudFrontConfigured } = require("../utils/s3");
const SENDER_INCLUDE = {
  model: Employee,
  as: "sender",
  attributes: ["id", "empId", "name", "level"],
};

/**
 * Attachment columns from the uploaded files (image + document) — CloudFront
 * URLs (S3: notifications/). Only includes what was actually uploaded, so an
 * update keeps existing files.
 */
function attachmentFields(files = {}) {
  const image = files.image?.[0];
  const document = files.document?.[0];
  return {
    ...(image && { imageUrl: image.url }),
    ...(document && {
      documentUrl: document.url,
      documentName: document.originalname,
    }),
  };
}

/** Search on message / notification ID — shared by the admin and "my" lists. */
function searchWhere(search) {
  if (!search) return {};
  const term = `%${search.trim()}%`;
  return {
    [Op.or]: [
      { message: { [Op.like]: term } },
      { notificationId: { [Op.like]: term } },
    ],
  };
}

/**
 * Card counts for the list page:
 * - unreadCount: notifications with zero responses so far ("awaiting acknowledgement")
 * - l1Count / l2Count / l3Count: notifications visible to that level —
 *   i.e. sent directly to it, OR sent "to All" (matches the reference UI:
 *   one "to All" notification bumps every level's count by one).
 */
const getNotificationSummary = async () => {
  const [unreadCount, l1Count, l2Count, l3Count] = await Promise.all([
    Notification.count({
      where: sequelize.literal(
        "NOT EXISTS (SELECT 1 FROM `NotificationResponses` AS nr WHERE nr.notificationId = `Notification`.`id`)",
      ),
    }),
    Notification.count({ where: { toLevel: { [Op.in]: ["L1", "All"] } } }),
    Notification.count({ where: { toLevel: { [Op.in]: ["L2", "All"] } } }),
    Notification.count({ where: { toLevel: { [Op.in]: ["L3", "All"] } } }),
  ]);

  return { unreadCount, l1Count, l2Count, l3Count };
};

/** GET /api/notifications/summary — Notifications page KPI cards on their own. */
const getNotificationsSummary = async (req, res, next) => {
  try {
    const data = await getNotificationSummary();
    return success(res, 200, "Notification summary fetched successfully", { data });
  } catch (err) {
    next(err);
  }
};

/** GET /api/notifications?search=kharif&toLevel=L3&page=1&limit=20 */
const getAllNotifications = async (req, res, next) => {
  try {
    const { search, toLevel } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const where = searchWhere(search);

    if (toLevel) {
      where.toLevel = toLevel;
    }

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
              sequelize.literal(`
                (
                  SELECT COUNT(*)
                  FROM \`NotificationResponses\` AS nr
                  WHERE nr.notificationId = \`Notification\`.id
                )
              `),
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
 * GET /api/notifications/my-notifications?search=&page=&limit=
 * Notifications for the logged-in user's level: sent to their level or to
 * "All". Each row says whether they have already responded.
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const where = {
      ...searchWhere(req.query.search),
      toLevel: { [Op.in]: [req.employee.level, "All"] },
    };

    const [result, summary] = await Promise.all([
      Notification.findAndCountAll({
        where,
        include: [SENDER_INCLUDE],
        attributes: {
          include: [[sequelize.literal(respondedBySql(req.employee.id)), "respondedByMe"]],
        },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      }),
      // Badge counts for this user (ignore search): all of theirs / not yet responded to.
      getMyNotificationCounts(req.employee),
    ]);

    const response = buildPaginatedResponse(result, page, limit);
    response.data = result.rows.map((row) => {
      const json = row.toJSON();
      return { ...json, respondedByMe: Boolean(Number(json.respondedByMe)) };
    });
    response.summary = summary;
    return success(res, 200, "Notifications fetched successfully", response);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/:id/document — downloads the attached document
 * under its original file name.
 */
const downloadNotificationDocument = async (req, res, next) => {
  try {
    const notification = await Notification.findByPk(req.params.id, {
      attributes: ["id", "documentUrl", "documentName"],
    });
    if (!notification) return error(res, 404, "Notification not found");
    const stored = notification.getDataValue("documentUrl"); // raw value: S3 key, URL or /uploads path
    if (!stored) return error(res, 404, "This notification has no document");
    const downloadName = notification.documentName || path.basename(stored);

    // S3: CloudFront URL when configured (the object carries Content-Disposition:
    // attachment + original name); until then a short-lived signed S3 link.
    const key = keyFromStored(stored);
    if (key) {
      return res.redirect(
        isCloudFrontConfigured() ? notification.documentUrl : await signedUrl(key, { downloadName }),
      );
    }
    if (/^https?:\/\//.test(stored)) return res.redirect(stored);

    // Local file (uploaded before S3, or with the local fallback). Resolve from
    // the stored file name only, so the path can't escape the uploads folder.
    const filePath = path.join(LEGACY_UPLOAD_ROOT, "notifications", path.basename(stored));
    if (!fs.existsSync(filePath)) return error(res, 404, "Document file is missing on the server");

    return res.download(filePath, downloadName);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications (multipart/form-data if a file is attached)
 * fields: toLevel ('L1'|'L2'|'L3'|'All'), message,
 *         image (optional image), document (optional pdf/word/excel/csv/... file)
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

    const notification = await Notification.create({
      sentBy: req.employee.id,
      toLevel,
      message,
      ...attachmentFields(req.files),
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

    await notification.update({
      ...(toLevel !== undefined && { toLevel }),
      ...(message !== undefined && { message }),
      ...attachmentFields(req.files), // a new image/document replaces the old one
    });

    return success(res, 200, "Notification updated successfully", {
      data: notification,
    });
  } catch (err) {
    next(err);
  }
};

// Controller function to get the responses of particular notification
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
 * POST create Notification
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
  getNotificationsSummary,
  getAllNotifications,
  getMyNotifications,
  downloadNotificationDocument,
  getNotificationById,
  createNotification,
  updateNotification,
  getResponsesByNotification,
  createNotificationResponse,
};
