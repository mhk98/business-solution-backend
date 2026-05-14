// notification.service.js
const { Op } = require("sequelize");
const db = require("../../../models");
const paginationHelpers = require("../../../helpers/paginationHelper");
const Notification = db.notification;
const User = db.user;

// 🔹 Get all notifications (userId optional, branch+role match)
const getNotificationByUser = async (payload, options) => {
  const { page, limit, skip } = paginationHelpers.calculatePagination(options);

  // Destructuring is correct, but let's ensure the values are ready for the query
  const { userId } = payload;

  const result = await Notification.findAll({
    where: {
      userId: userId,
    },
    offset: skip,
    limit,
    order: [["createdAt", "DESC"]],
  });

  let count = await Notification.count({
    where: {
      userId: userId,
    },
  });

  return {
    meta: { count, page, limit },
    data: result,
  };
};

const createNotification = async ({ message, url, userId }) => {
  console.log("notificationInfo", message, url, userId);

  const users = await User.findAll({
    where: {
      id: { [Op.ne]: userId }, // 👈 Exclude sender
      role: { [Op.in]: ["superAdmin", "admin", "accountant", "inventor"] },
    },
  });

  console.log("Target users:", users);

  if (!users.length) {
    console.log("No users found for notification.");
    return [];
  }

  const notifications = await Promise.all(
    users.map((user) =>
      Notification.create({
        userId: user.id,
        message,
        url,
      }),
    ),
  );

  console.log("Notifications created:", notifications.length);
  return notifications;
};

// 🔹 Mark notification as read for specific user
const markAsReadNotification = async (id, userId) => {
  const notif = await Notification.findOne({
    where: { id, userId },
  });

  if (!notif) return null;

  notif.isRead = true;
  await notif.save();
  return notif;
};

const NotificationService = {
  getNotificationByUser,
  createNotification,
  markAsReadNotification,
};

module.exports = NotificationService;
