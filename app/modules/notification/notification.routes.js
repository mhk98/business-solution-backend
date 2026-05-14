const express = require("express");
const auth = require("../../middlewares/auth");
const { requireMenuPermission } = require("../../middlewares/requireMenuPermission");
const router = express.Router();
const NotificationController = require("../notification/notification.controller");

// branch ভিত্তিক notification
router.get(
  "/:userId",
  auth(),
  requireMenuPermission("notifications"),
  NotificationController.getNotificationByUser,
);

// router.post("/", NotificationController.createNotification);
router.put(
  "/:id/read",
  auth(),
  requireMenuPermission("notifications"),
  NotificationController.markAsReadNotification,
);

const NotificationRoutes = router;
module.exports = NotificationRoutes;
