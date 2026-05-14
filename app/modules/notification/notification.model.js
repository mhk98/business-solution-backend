// // models/notification.js
// module.exports = (sequelize, DataTypes) => {
//   const Notification = sequelize.define(
//     "Notification",
//     {
//       userId: {
//         type: DataTypes.STRING,
//         allowNull: false,
//       },
//       url: {
//         type: DataTypes.STRING,
//         allowNull: false, // Enquiries, Tasks, Payments etc.
//       },
//       message: {
//         type: DataTypes.STRING,
//         allowNull: false,
//       },
//       isRead: {
//         type: DataTypes.BOOLEAN,
//         defaultValue: false,
//       },
//     },
//     {
//       tableName: "notifications", // চাইলে custom নাম
//       timestamps: true, // createdAt & updatedAt আসবে
//     },
//   );

//   return Notification;
// };

const sendEmail = require("../../middlewares/sendEmail");
const notificationEmailTemplate = require("../../utils/emailTemplates/notificationEmail");

const IMPORTANT_NOTIFICATION_KEYWORDS = [
  "approval",
  "approve",
  "approved",
  "reject",
  "rejected",
  "request",
  "delete",
  "update",
  "updated",
  "due",
  "payment",
  "paid",
  "unpaid",
  "transaction",
  "cash",
  "expense",
  "payable",
  "receivable",
  "petty",
  "accounting",
  "assigned",
  "task",
  "deadline",
  "requisition",
];

const IMPORTANT_NOTIFICATION_URLS = [
  "/book",
  "/cash",
  "/credit-ledger",
  "/supplier-history",
  "/payable",
  "/receiveable",
  "/expense",
  "/petty-cash",
  "/petty-cash-requisition",
  "/tasks",
  "/assets-requisition",
  "/purchase-requisition",
];

const isNotificationEmailEnabled = () =>
  String(process.env.NOTIFICATION_EMAIL_ENABLED || "true").toLowerCase() ===
  "true";

const shouldEmailNotification = (notification) => {
  if (!isNotificationEmailEnabled()) return false;

  const message = String(notification?.message || "").toLowerCase();
  const url = String(notification?.url || "").toLowerCase();

  if (url.includes("/chat")) return false;

  return (
    IMPORTANT_NOTIFICATION_KEYWORDS.some((keyword) =>
      message.includes(keyword),
    ) ||
    IMPORTANT_NOTIFICATION_URLS.some((path) => url.includes(path))
  );
};

const sendNotificationEmail = async (notification, sequelize) => {
  if (!shouldEmailNotification(notification)) return;

  try {
    const User = sequelize.models.User;
    const user = await User.findByPk(notification.userId);

    if (!user?.Email) return;

    const name =
      [user.FirstName, user.LastName].filter(Boolean).join(" ") || "User";

    await sendEmail({
      to: user.Email,
      subject: `New notification - ${process.env.MAIL_BRAND_NAME || "Business Solution"}`,
      htmlContent: notificationEmailTemplate({
        name,
        message: notification.message,
        url: notification.url,
      }),
    });
  } catch (error) {
    console.error("Notification email error:", error?.message || error);
  }
};

// models/notification.js
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "Notification",
    {
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
      tableName: "Notifications",
      hooks: {
        afterCreate: (notification) => {
          setImmediate(() => {
            sendNotificationEmail(notification, sequelize);
          });
        },
      },
    },
  );

  return Notification;
};
