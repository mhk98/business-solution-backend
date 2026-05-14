// notification.controller.js
const catchAsync = require("../../../shared/catchAsync");
const pick = require("../../../shared/pick");
const sendResponse = require("../../../shared/sendResponse");
const NotificationService = require("./notification.service");

// 🔹 Get notifications for current user

const getNotificationByUser = catchAsync(async (req, res) => {
  const options = pick(req.query, ["limit", "page", "sortBy", "sortOrder"]);
  const result = await NotificationService.getNotificationByUser(
    req.params,
    options,
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Notification fetched successfully!!",
    meta: result.meta,
    data: result.data,
  });
});

// 🔹 Create notification for branch + role
const createNotification = async (req, res) => {
  try {
    const { message, userId, url } = req.body;

    const notifications = await NotificationService.createNotification({
      message,
      url,
      userId,
    });

    // Socket emit for each user
    // const io = req.app.get("io");
    // notifications.forEach((notif) => {
    //   io.to(notif.userId.toString()).emit("new_notification", notif);
    // });

    res.status(201).json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔹 Mark notification read for current user
const markAsReadNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // frontend থেকে পাঠাতে হবে
    console.log(req.params, userId);
    const notif = await NotificationService.markAsReadNotification(id, userId);

    if (!notif)
      return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: notif });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const NotificationController = {
  getNotificationByUser,
  createNotification,
  markAsReadNotification,
};

module.exports = NotificationController;
